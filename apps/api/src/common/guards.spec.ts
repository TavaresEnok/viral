import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { SseAuthGuard } from "./sse-auth.guard.js";
import { MasterSecretGuard } from "./master-secret.guard.js";

function makeCtx(overrides: {
  authorization?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  ip?: string;
  user?: unknown;
} = {}): ExecutionContext {
  const req = {
    headers: {
      authorization: overrides.authorization,
      ...overrides.headers,
    },
    query: overrides.query ?? {},
    ip: overrides.ip ?? "127.0.0.1",
    user: overrides.user,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

const fakeVerify = vi.fn();
const jwtService = { verifyAsync: fakeVerify } as unknown as JwtService;

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  beforeEach(() => { guard = new JwtAuthGuard(jwtService); });

  it("accepts a valid Bearer token", async () => {
    fakeVerify.mockResolvedValue({ sub: "u1", email: "a@b.com" });
    const ctx = makeCtx({ authorization: "Bearer valid-token" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("rejects when no token is provided", async () => {
    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an expired/invalid token", async () => {
    fakeVerify.mockRejectedValue(new Error("jwt expired"));
    const ctx = makeCtx({ authorization: "Bearer bad-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("MUST reject ?token= query param (no JWT leakage via URL)", async () => {
    // This is the critical security test: JwtAuthGuard must NOT accept ?token=
    const ctx = makeCtx({ query: { token: "sneaky-token" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    // verifyAsync must never have been called with the query token
    expect(fakeVerify).not.toHaveBeenCalled();
  });

  it("ignores ?token= even when a Bearer header is also missing", async () => {
    const ctx = makeCtx({
      query: { token: "valid-query-token" },
      // authorization header deliberately absent
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe("SseAuthGuard", () => {
  let guard: SseAuthGuard;
  beforeEach(() => { guard = new SseAuthGuard(jwtService); });

  it("accepts a valid Bearer header token", async () => {
    fakeVerify.mockResolvedValue({ sub: "u1", email: "a@b.com" });
    const ctx = makeCtx({ authorization: "Bearer valid-token" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("accepts a valid ?token= query param (EventSource compatibility)", async () => {
    fakeVerify.mockResolvedValue({ sub: "u1", email: "a@b.com" });
    const ctx = makeCtx({ query: { token: "valid-query-token" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(fakeVerify).toHaveBeenCalledWith("valid-query-token");
  });

  it("prefers Bearer header over ?token= when both are present", async () => {
    fakeVerify.mockResolvedValue({ sub: "u1", email: "a@b.com" });
    const ctx = makeCtx({
      authorization: "Bearer header-token",
      query: { token: "query-token" },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(fakeVerify).toHaveBeenCalledWith("header-token");
  });

  it("rejects when neither header nor query param is present", async () => {
    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an invalid/expired token from query param", async () => {
    fakeVerify.mockRejectedValue(new Error("jwt expired"));
    const ctx = makeCtx({ query: { token: "expired-token" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe("MasterSecretGuard", () => {
  const MASTER = "test-master-secret-value-32chars!";

  beforeEach(() => {
    process.env.MASTER_SECRET = MASTER;
  });

  it("allows request with correct x-master-secret header", () => {
    const guard = new MasterSecretGuard();
    const ctx = makeCtx({ headers: { "x-master-secret": MASTER } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("rejects request with wrong secret", () => {
    const guard = new MasterSecretGuard();
    const ctx = makeCtx({ headers: { "x-master-secret": "wrong-secret" } });
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it("rejects request with no x-master-secret header", () => {
    const guard = new MasterSecretGuard();
    const ctx = makeCtx();
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it("rejects when MASTER_SECRET env var is not set", () => {
    delete process.env.MASTER_SECRET;
    const guard = new MasterSecretGuard();
    const ctx = makeCtx({ headers: { "x-master-secret": "any-value" } });
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});
