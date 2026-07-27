import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { QuotaService } from "./quota.service.js";
import type { PrismaService } from "../prisma.service.js";

const mockPrisma = {
    userQuota: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    project: {
        count: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
};

function makeQuota(overrides: Record<string, unknown> = {}) {
    return {
        userId: "user123",
        plan: "free",
        monthlyRenders: 0,
        monthlyProjectMinutes: 0,
        monthlyResetAt: new Date(),
        ...overrides,
    };
}

describe("QuotaService", () => {
    let service: QuotaService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Padrão dos testes de quota: conta verificada. O limite de contas não
        // verificadas tem testes próprios em "conta não verificada".
        mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true });
        service = new QuotaService(mockPrisma as unknown as PrismaService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    describe("checkClipRenderQuota", () => {
        it("should return true when renders are available", async () => {
            const userId = "user123";
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyRenders: 5 }));
            const result = await service.checkClipRenderQuota(userId);
            expect(result).toBe(true);
        });

        it("should return false when renders limit is reached", async () => {
            const userId = "user123";
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyRenders: 20 }));
            const result = await service.checkClipRenderQuota(userId);
            expect(result).toBe(false);
        });
    });

    describe("checkProjectQuota", () => {
        it("should return true when projects are available", async () => {
            const userId = "user123";
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.project.count.mockResolvedValue(2);
            const result = await service.checkProjectQuota(userId);
            expect(result).toBe(true);
        });

        it("should return false when project limit is reached", async () => {
            const userId = "user123";
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.project.count.mockResolvedValue(5); // Free plan max
            const result = await service.checkProjectQuota(userId);
            expect(result).toBe(false);
        });
    });

    describe("ensureCanCreateProject", () => {
        it("should NOT throw when 4 projects exist (5th is allowed)", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.project.count.mockResolvedValue(4); // 5th project will be created
            await expect(service.ensureCanCreateProject("user123")).resolves.not.toThrow();
        });

        it("should throw ForbiddenException when 5 projects already exist (limit reached)", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.project.count.mockResolvedValue(5);
            await expect(service.ensureCanCreateProject("user123")).rejects.toThrow(ForbiddenException);
        });

        it("should NOT check minutes (only project count)", async () => {
            // Even if minutes are exceeded, ensureCanCreateProject should still allow creation
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 999 }));
            mockPrisma.project.count.mockResolvedValue(2);
            await expect(service.ensureCanCreateProject("user123")).resolves.not.toThrow();
        });
    });

    describe("ensureCanStartProcessing", () => {
        it("should NOT throw when minutes are available", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 30 }));
            await expect(service.ensureCanStartProcessing("user123")).resolves.not.toThrow();
        });

        it("should throw ForbiddenException when monthly minutes are exhausted", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 60 }));
            await expect(service.ensureCanStartProcessing("user123")).rejects.toThrow(ForbiddenException);
        });

        it("should NOT check project count (only minutes)", async () => {
            // Even if project count is at the limit, ensureCanStartProcessing should NOT block
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 0 }));
            // No project.count mock needed — ensureCanStartProcessing must not call it
            await expect(service.ensureCanStartProcessing("user123")).resolves.not.toThrow();
            expect(mockPrisma.project.count).not.toHaveBeenCalled();
        });
    });

    describe("Quota double-counting fix: create + upload", () => {
        it("5th project can be created AND processed (no double-count)", async () => {
            // User has 4 projects already created this month
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 0 }));
            mockPrisma.project.count.mockResolvedValue(4);

            // Step 1: Create the 5th project — should be allowed
            await expect(service.ensureCanCreateProject("user123")).resolves.not.toThrow();

            // Step 2: Start processing the new project — project.count is not checked
            // (ensureCanStartProcessing only checks minutes)
            mockPrisma.project.count.mockResolvedValue(5); // now 5 projects exist
            await expect(service.ensureCanStartProcessing("user123")).resolves.not.toThrow();
        });

        it("6th project creation is blocked", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.project.count.mockResolvedValue(5); // already at limit
            await expect(service.ensureCanCreateProject("user123")).rejects.toThrow(ForbiddenException);
        });

        it("retry does not fail due to project count being at limit", async () => {
            // After a failed 5th project, user retries — should only check minutes
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 30 }));
            // ensureCanStartProcessing must not call project.count
            await expect(service.ensureCanStartProcessing("user123")).resolves.not.toThrow();
            expect(mockPrisma.project.count).not.toHaveBeenCalled();
        });

        it("retry is blocked when monthly minutes are exhausted", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 60 }));
            await expect(service.ensureCanStartProcessing("user123")).rejects.toThrow(ForbiddenException);
        });
    });

    describe("ensureCanRender", () => {
        it("should throw when render limit is reached", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyRenders: 20 }));
            await expect(service.ensureCanRender("user123")).rejects.toThrow(ForbiddenException);
        });

        it("should not throw when renders are available", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyRenders: 5 }));
            await expect(service.ensureCanRender("user123")).resolves.not.toThrow();
        });
    });

    describe("ensureCanProcessDuration", () => {
        it("should allow if duration fits in remaining minutes", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 50 }));
            // Free plan has 60 minutes. 50 + 9 mins = 59 < 60.
            await expect(service.ensureCanProcessDuration("user123", 9 * 60)).resolves.not.toThrow();
        });

        it("should throw if duration exceeds remaining minutes", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 50 }));
            // 50 + 11 mins = 61 > 60.
            await expect(service.ensureCanProcessDuration("user123", 11 * 60)).rejects.toThrow(ForbiddenException);
        });
    });

    describe("ensureCanRenderBatch", () => {
        it("should allow if batch fits in remaining renders", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyRenders: 15 }));
            // Free plan has 20 renders. 15 + 5 = 20 <= 20.
            await expect(service.ensureCanRenderBatch("user123", 5)).resolves.not.toThrow();
        });

        it("should throw if batch exceeds remaining renders", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ monthlyRenders: 15 }));
            // 15 + 6 = 21 > 20.
            await expect(service.ensureCanRenderBatch("user123", 6)).rejects.toThrow(ForbiddenException);
        });
    });

    describe("getRemainingQuota", () => {
        it("should return correct remaining quotas", async () => {
            const userId = "user123";
            const now = new Date();
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({
                monthlyRenders: 5,
                monthlyProjectMinutes: 30,
                monthlyResetAt: now,
            }));
            mockPrisma.project.count.mockResolvedValue(2);

            const result = await service.getRemainingQuota(userId);

            expect(result.remainingRenders).toBe(15); // 20 - 5
            expect(result.remainingMinutes).toBe(30); // 60 - 30
            expect(result.remainingProjects).toBe(3); // 5 - 2
            expect(result.plan).toBe("free");
            expect(result.resetAt).toEqual(now);
        });
    });

    describe("consumeProjectMinutes", () => {
        it("should increment monthlyProjectMinutes", async () => {
            const userId = "user123";
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.userQuota.update.mockResolvedValue(makeQuota({ monthlyProjectMinutes: 30 }));

            await service.consumeProjectMinutes(userId, 30);

            expect(mockPrisma.userQuota.update).toHaveBeenCalledWith({
                where: { userId },
                data: { monthlyProjectMinutes: { increment: 30 } },
            });
        });
    });

    describe("consumeClipRender", () => {
        it("should increment monthlyRenders", async () => {
            const userId = "user123";
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.userQuota.update.mockResolvedValue(makeQuota({ monthlyRenders: 1 }));

            await service.consumeClipRender(userId);

            expect(mockPrisma.userQuota.update).toHaveBeenCalledWith({
                where: { userId },
                data: { monthlyRenders: { increment: 1 } },
            });
        });
    });

    describe("conta não verificada", () => {
        // Login não exige e-mail verificado (proposital), mas sem teto uma conta
        // descartável poderia subir vídeos de até 500MB indefinidamente.
        it("bloqueia criação além do teto quando o e-mail não foi verificado", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: false });
            mockPrisma.project.count.mockResolvedValue(2); // teto padrão = 2

            await expect(service.ensureCanCreateProject("user123")).rejects.toThrow(
                ForbiddenException,
            );
        });

        it("permite criar dentro do teto mesmo sem verificar", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: false });
            mockPrisma.project.count.mockResolvedValue(1);

            await expect(service.ensureCanCreateProject("user123")).resolves.not.toThrow();
        });

        it("não aplica o teto quando o e-mail está verificado", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota());
            mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true });
            mockPrisma.project.count.mockResolvedValue(4); // abaixo do limite free (5)

            await expect(service.ensureCanCreateProject("user123")).resolves.not.toThrow();
        });
    });

    describe("master plan", () => {
        it("master plan should not be blocked by project count", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({ plan: "master" }));
            mockPrisma.project.count.mockResolvedValue(9999); // way over free limit
            await expect(service.ensureCanCreateProject("user123")).resolves.not.toThrow();
        });

        it("master plan should not be blocked by minutes", async () => {
            mockPrisma.userQuota.findUnique.mockResolvedValue(makeQuota({
                plan: "master",
                monthlyProjectMinutes: 99999,
            }));
            await expect(service.ensureCanStartProcessing("user123")).resolves.not.toThrow();
        });
    });
});
