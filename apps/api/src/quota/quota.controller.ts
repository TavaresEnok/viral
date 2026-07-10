import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import type { RequestUser } from "../common/request-user.js";
import { QuotaService } from "./quota.service.js";

@ApiTags('quota')
@Controller()
@UseGuards(JwtAuthGuard)
export class QuotaController {
    constructor(private readonly quotaService: QuotaService) {}

    @Get("quota")
    getQuota(@CurrentUser() user: RequestUser) {
        return this.quotaService.getQuota(user.id);
    }

    @Get("users/me/quota")
    async getMyQuota(@CurrentUser() user: RequestUser) {
        return this.quotaService.getRemainingQuota(user.id);
    }
}
