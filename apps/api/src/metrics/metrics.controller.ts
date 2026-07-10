import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { MasterSecretGuard } from "../common/master-secret.guard.js";
import { MetricsService } from "./metrics.service.js";

@ApiTags("metrics")
@Controller("metrics")
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) {}

    @UseGuards(MasterSecretGuard)
    @Get()
    async getMetrics(@Res() res: Response): Promise<void> {
        const metrics = await this.metricsService.getMetrics();
        res.setHeader("Content-Type", this.metricsService.contentType);
        res.end(metrics);
    }
}
