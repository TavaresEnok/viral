import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { JwtConfigModule } from "../common/jwt-config.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";
import { StripeWebhookHandler } from "./stripe.webhook.js";

@Module({
    imports: [JwtConfigModule],
    controllers: [BillingController],
    providers: [BillingService, StripeWebhookHandler, PrismaService],
    exports: [BillingService],
})
export class BillingModule {}
