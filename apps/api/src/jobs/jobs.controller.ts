import { ApiTags } from '@nestjs/swagger';
import {
    Controller,
    Get,
    Header,
    Param,
    Post,
    Req,
    Res,
    UseGuards,
    Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/current-user.decorator.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { SseAuthGuard } from "../common/sse-auth.guard.js";
import type { RequestUser } from "../common/request-user.js";
import { JobsService } from "./jobs.service.js";
import { Redis } from "ioredis";
import { createRedisConnectionConfig } from "@viralforge/shared";

const SSE_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const SSE_HEARTBEAT_INTERVAL_MS = 25_000;

@ApiTags('jobs')
@Controller("jobs")
export class JobsController {
    private readonly logger = new Logger(JobsController.name);

    constructor(private readonly jobsService: JobsService) {}

    @Get(":projectId")
    @UseGuards(JwtAuthGuard)
    status(
        @CurrentUser() user: RequestUser,
        @Param("projectId") projectId: string,
    ) {
        return this.jobsService.status(user.id, projectId);
    }

    @Post(":projectId/sse-ticket")
    @UseGuards(JwtAuthGuard)
    getSseTicket(
        @CurrentUser() user: RequestUser,
        @Param("projectId") projectId: string,
    ) {
        return this.jobsService.createSseTicket(user.id, projectId);
    }

    @Get(":projectId/stream")
    @UseGuards(SseAuthGuard)
    @Header("Content-Type", "text/event-stream")
    @Header("Cache-Control", "no-cache")
    @Header("Connection", "keep-alive")
    async streamProgress(
        @CurrentUser() user: RequestUser,
        @Param("projectId") projectId: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const initial = await this.jobsService.status(user.id, projectId);
        res.flushHeaders();
        res.write(`data: ${JSON.stringify(initial)}\n\n`);

        if (initial.status === "COMPLETED" || initial.status === "FAILED") {
            res.end();
            return;
        }

        const subscriber = new Redis(createRedisConnectionConfig());
        let closed = false;

        const cleanup = (reason: string) => {
            if (closed) return;
            closed = true;
            this.logger.debug(`SSE closed [${reason}] project=${projectId}`);
            subscriber.quit().catch(() => {});
            if (!res.writableEnded) res.end();
        };

        subscriber.on("error", (err) => {
            this.logger.warn(`SSE Redis subscriber error project=${projectId}: ${err.message}`);
            cleanup("redis-error");
        });

        subscriber.subscribe(`project:${projectId}:updates`).catch((err: Error) => {
            this.logger.warn(`SSE subscribe failed project=${projectId}: ${err.message}`);
            cleanup("subscribe-error");
        });

        subscriber.on("message", async () => {
            if (closed) return;
            try {
                const data = await this.jobsService.status(user.id, projectId);
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                }
                if (data.status === "COMPLETED" || data.status === "FAILED") {
                    cleanup("job-finished");
                }
            } catch (err) {
                this.logger.warn(`SSE status fetch failed project=${projectId}: ${String(err)}`);
            }
        });

        // Heartbeat to keep connection alive through proxies/load balancers
        const heartbeat = setInterval(() => {
            if (closed || res.writableEnded) {
                clearInterval(heartbeat);
                return;
            }
            res.write(`: heartbeat\n\n`);
        }, SSE_HEARTBEAT_INTERVAL_MS);

        // Hard timeout: close SSE after max duration
        const timeout = setTimeout(() => {
            clearInterval(heartbeat);
            cleanup("timeout");
        }, SSE_MAX_DURATION_MS);

        req.on("close", () => {
            clearInterval(heartbeat);
            clearTimeout(timeout);
            cleanup("client-disconnect");
        });
    }
}
