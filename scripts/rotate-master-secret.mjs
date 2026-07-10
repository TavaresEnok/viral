#!/usr/bin/env node
/**
 * Rotate the encryption secret used for credentials at rest.
 *
 * Re-encrypts every stored secret (LLM/transcription API keys and social OAuth
 * tokens) from the OLD secret to a NEW one. Runs a dry-run first that verifies
 * every record decrypts with OLD and round-trips with NEW; only `--apply`
 * writes to the database, inside a single transaction.
 *
 * Usage:
 *   # dry-run (no writes). OLD comes from MASTER_SECRET/API_KEY_ENCRYPTION_SECRET in env.
 *   node scripts/rotate-master-secret.mjs --new <NEW_SECRET>
 *
 *   # generate a strong NEW secret automatically (printed at the end), dry-run:
 *   node scripts/rotate-master-secret.mjs --generate
 *
 *   # actually rotate:
 *   node scripts/rotate-master-secret.mjs --new <NEW_SECRET> --apply
 *
 * After --apply succeeds, set MASTER_SECRET=<NEW_SECRET> in your .env and
 * restart the API and worker. Keep the OLD value until the rotation is verified.
 */
import { PrismaClient } from "@prisma/client";
import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";

const ALG = "aes-256-gcm";
const keyOf = (s) => createHash("sha256").update(s).digest();

function decrypt(value, secret) {
    if (!value) return null;
    const [ivHex, tagHex, encHex] = value.split(":");
    if (!ivHex || !tagHex || !encHex) return null;
    const d = createDecipheriv(ALG, keyOf(secret), Buffer.from(ivHex, "hex"));
    d.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
        d.update(Buffer.from(encHex, "hex")),
        d.final(),
    ]).toString("utf8");
}

function encrypt(value, secret) {
    const iv = randomBytes(12);
    const c = createCipheriv(ALG, keyOf(secret), iv);
    const enc = Buffer.concat([c.update(value, "utf8"), c.final()]);
    return `${iv.toString("hex")}:${c.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const generate = args.includes("--generate");
const newIdx = args.indexOf("--new");
let NEW = newIdx >= 0 ? args[newIdx + 1] : null;
if (generate && !NEW) NEW = randomBytes(48).toString("base64url");

const OLD =
    process.env.MASTER_SECRET ?? process.env.API_KEY_ENCRYPTION_SECRET ?? null;

if (!OLD) {
    console.error("OLD secret missing: set MASTER_SECRET or API_KEY_ENCRYPTION_SECRET in env.");
    process.exit(1);
}
if (!NEW) {
    console.error("NEW secret missing: pass --new <secret> or --generate.");
    process.exit(1);
}
if (NEW === OLD) {
    console.error("NEW secret equals OLD secret; nothing to rotate.");
    process.exit(1);
}

// [model, idField, secretField] for every encrypted column in the schema.
const TARGETS = [
    ["aiProviderIntegration", "id", "encryptedApiKey"],
    ["user", "id", "deepseekApiKeyEncrypted"],
    ["user", "id", "openaiApiKeyEncrypted"],
    ["socialAccount", "id", "accessTokenEncrypted"],
    ["socialAccount", "id", "refreshTokenEncrypted"],
];

const prisma = new PrismaClient();
const ops = [];
let ok = 0,
    skip = 0,
    fail = 0;

for (const [model, idField, field] of TARGETS) {
    const rows = await prisma[model].findMany({
        where: { [field]: { not: null } },
        select: { [idField]: true, [field]: true },
    });
    for (const row of rows) {
        const cipher = row[field];
        try {
            const plain = decrypt(cipher, OLD);
            if (plain == null) {
                skip += 1;
                continue;
            }
            const re = encrypt(plain, NEW);
            if (decrypt(re, NEW) !== plain) {
                throw new Error("round-trip mismatch");
            }
            ok += 1;
            ops.push(
                prisma[model].update({
                    where: { [idField]: row[idField] },
                    data: { [field]: re },
                }),
            );
        } catch (error) {
            fail += 1;
            console.error(`FAIL ${model}.${field} ${row[idField]}: ${error.message}`);
        }
    }
}

console.log(`Verified: ok=${ok} skip=${skip} fail=${fail}`);
if (fail > 0) {
    console.error("Aborting: some records could not be re-encrypted. No changes written.");
    await prisma.$disconnect();
    process.exit(1);
}

if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write changes.");
    if (generate) console.log(`Generated NEW secret: ${NEW}`);
    await prisma.$disconnect();
    process.exit(0);
}

await prisma.$transaction(ops);
console.log(`Applied: re-encrypted ${ops.length} record(s) to the new secret.`);
console.log("Next: set MASTER_SECRET to the new value in .env and restart API + worker.");
if (generate) console.log(`NEW secret: ${NEW}`);
await prisma.$disconnect();
