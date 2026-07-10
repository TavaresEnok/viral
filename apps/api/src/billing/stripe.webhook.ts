import { Logger } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma.service.js";
import { BillingService } from "./billing.service.js";

/**
 * Stripe webhook handlers for subscription and invoice events
 */
export class StripeWebhookHandler {
    private readonly logger = new Logger(StripeWebhookHandler.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Handle customer.subscription.updated event
     */
    async handleSubscriptionUpdated(
        subscription: Stripe.Subscription,
    ): Promise<void> {
        const userId = await this.findUserIdByCustomer(
            subscription.customer as string,
        );
        if (!userId) {
            this.logger.warn(
                `Could not find user for customer ${subscription.customer}`,
            );
            return;
        }

        const plan = this.getPlanFromSubscription(subscription);

        await this.prisma.userQuota.update({
            where: { userId },
            data: {
                plan,
                subscriptionStatus: subscription.status,
            },
        });

        this.logger.log(
            `Subscription updated for user ${userId}: ${subscription.status}`,
        );
    }

    /**
     * Handle customer.subscription.deleted event
     */
    async handleSubscriptionDeleted(
        subscription: Stripe.Subscription,
    ): Promise<void> {
        const userId = await this.findUserIdByCustomer(
            subscription.customer as string,
        );
        if (!userId) {
            this.logger.warn(
                `Could not find user for customer ${subscription.customer}`,
            );
            return;
        }

        await this.prisma.userQuota.update({
            where: { userId },
            data: {
                plan: "free",
                stripeSubscriptionId: null,
                subscriptionStatus: "canceled",
                maxProjectsPerMonth: 5,
                maxProjectMinutesPerMonth: 60,
                maxRendersPerMonth: 20,
            },
        });

        this.logger.log(`Subscription deleted for user ${userId}`);
    }

    /**
     * Handle invoice.payment_failed event
     */
    async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        const userId = await this.findUserIdByCustomer(
            invoice.customer as string,
        );
        if (!userId) {
            this.logger.warn(
                `Could not find user for customer ${invoice.customer}`,
            );
            return;
        }

        this.logger.warn(`Payment failed for user ${userId}: ${invoice.id}`);

        // You might want to downgrade the user or send a notification here
        // For now, just logging the event
    }

    private getPlanFromSubscription(subscription: Stripe.Subscription): string {
        return BillingService.getPlanFromStripeSubscription(subscription);
    }

    private async findUserIdByCustomer(
        customerId: string,
    ): Promise<string | null> {
        const quota = await this.prisma.userQuota.findFirst({
            where: { stripeCustomerId: customerId },
        });
        return quota?.userId ?? null;
    }
}
