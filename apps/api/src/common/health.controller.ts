import {
    Controller,
    Get,
    Logger,
    ServiceUnavailableException,
} from "@nestjs/common";
import { access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { REDIS_CONFIG } from "@viralforge/shared";
import { PrismaService } from "../prisma.service.js";

@Controller("health")
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(private readonly prisma: PrismaService) {}

    @Get()
    async check() {
        return this.ready();
    }

    @Get("live")
    live() {
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
        };
    }

    @Get("ready")
    async ready() {
        const checks: Record<string, "ok" | "error"> = {};
        let healthy = true;

        try {
            await this.prisma.$queryRaw`SELECT 1`;
            checks.database = "ok";
        } catch (err) {
            checks.database = "error";
            healthy = false;
            this.logger.error({
                msg: "Health check DB failed",
                error: err instanceof Error ? err.message : err,
            });
        }

        try {
            const { Redis } = await import("ioredis");
            const client = new Redis({
                ...REDIS_CONFIG,
                lazyConnect: true,
            });
            try {
                await client.connect();
                await client.ping();
            } finally {
                await client.disconnect();
            }
            checks.redis = "ok";
        } catch (err) {
            checks.redis = "error";
            healthy = false;
            this.logger.error({
                msg: "Health check Redis failed",
                error: err instanceof Error ? err.message : err,
            });
        }

        try {
            const root = resolve(process.env.STORAGE_ROOT ?? "storage/uploads");
            await mkdir(root, { recursive: true });
            await access(root);
            checks.storage = "ok";
        } catch {
            checks.storage = "error";
            healthy = false;
        }

        const payload = {
            status: healthy ? "ok" : "degraded",
            timestamp: new Date().toISOString(),
            checks,
        };

        if (!healthy) {
            throw new ServiceUnavailableException(payload);
        }

        return payload;
    }
}
