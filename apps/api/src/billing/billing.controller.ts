import { ApiTags } from '@nestjs/swagger';
import {
    Controller,
    Post,
    Get,
    Req,
    Headers,
    Body,
    UseGuards,
    RawBodyRequest,
} from "@nestjs/common";
import { IsString, IsNotEmpty } from "class-validator";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { CurrentUser } from "../common/current-user.decorator.js";
import type { RequestUser } from "../common/request-user.js";
import { BillingService } from "./billing.service.js";

class CreateCheckoutDto {
    @IsString()
    @IsNotEmpty()
    plan!: string;
}

@ApiTags('billing')
@Controller("billing")
export class BillingController {
    constructor(private readonly billingService: BillingService) {}

    @Post("checkout")
    @UseGuards(JwtAuthGuard)
    createCheckout(
        @CurrentUser() user: RequestUser,
        @Body() dto: CreateCheckoutDto,
    ) {
        return this.billingService.createCheckoutSession(user.id, dto.plan);
    }

    @Post("portal")
    @UseGuards(JwtAuthGuard)
    createPortal(@CurrentUser() user: RequestUser) {
        return this.billingService.createPortalSession(user.id);
    }

    @Get("status")
    @UseGuards(JwtAuthGuard)
    getStatus(@CurrentUser() user: RequestUser) {
        return this.billingService.getSubscriptionStatus(user.id);
    }

    @Post("cancel")
    @UseGuards(JwtAuthGuard)
    cancelSubscription(@CurrentUser() user: RequestUser) {
        return this.billingService.cancelSubscription(user.id);
    }

    @Post("webhook")
    async webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers("stripe-signature") signature: string,
    ) {
        return this.billingService.handleWebhook(
            req.rawBody ?? Buffer.from(""),
            signature,
        );
    }
}
