import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import Stripe from "stripe";

function getPlanFromStripeSubscription(
    subscription: Stripe.Subscription,
): string {
    const item = subscription.items.data[0];
    if (!item) return "free";

    const priceId = (item.price as { id?: string }).id;

    if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
    if (priceId === process.env.STRIPE_PRICE_STUDIO) return "studio";

    return "free";
}

const PLANS: Record<
    string,
    {
        priceId: string;
        quotas: {
            maxProjectsPerMonth: number;
            maxProjectMinutesPerMonth: number;
            maxRendersPerMonth: number;
        };
    }
> = {
    free: {
        priceId: "",
        quotas: {
            maxProjectsPerMonth: 5,
            maxProjectMinutesPerMonth: 60,
            maxRendersPerMonth: 20,
        },
    },
    pro: {
        priceId: process.env.STRIPE_PRICE_PRO || "",
        quotas: {
            maxProjectsPerMonth: 50,
            maxProjectMinutesPerMonth: 600,
            maxRendersPerMonth: 200,
        },
    },
    studio: {
        priceId: process.env.STRIPE_PRICE_STUDIO || "",
        quotas: {
            maxProjectsPerMonth: 500,
            maxProjectMinutesPerMonth: 6000,
            maxRendersPerMonth: 2000,
        },
    },
};

function webOrigin() {
    return (
        (process.env.WEB_ORIGIN ?? "http://localhost:3000")
            .split(",")[0]
            .trim() || "http://localhost:3000"
    );
}

@Injectable()
export class BillingService {
    static getPlanFromStripeSubscription = getPlanFromStripeSubscription;
    private readonly logger = new Logger(BillingService.name);
    private readonly stripe?: Stripe;

    constructor(private readonly prisma: PrismaService) {
        const key = process.env.STRIPE_SECRET_KEY;
        this.stripe = key ? new Stripe(key) : undefined;
    }

    async createCheckoutSession(userId: string, plan: string) {
        const cfg = PLANS[plan];
        if (!cfg || !cfg.priceId)
            throw new BadRequestException("Plano inválido ou não configurado");

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { quota: true },
        });
        if (!user) throw new NotFoundException("Usuário não encontrado");

        const customerId = user.quota?.stripeCustomerId || undefined;

        const stripe = this.getStripe();
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: cfg.priceId, quantity: 1 }],
            customer: customerId,
            client_reference_id: userId,
            metadata: { userId, plan },
            success_url: `${webOrigin()}/dashboard/billing?success=true`,
            cancel_url: `${webOrigin()}/dashboard/billing?canceled=true`,
        });

        return { url: session.url };
    }

    async createPortalSession(userId: string) {
        const quota = await this.prisma.userQuota.findUnique({
            where: { userId },
        });
        if (!quota?.stripeCustomerId)
            throw new BadRequestException(
                "Usuário não possui assinatura ativa",
            );

        const stripe = this.getStripe();
        const session = await stripe.billingPortal.sessions.create({
            customer: quota.stripeCustomerId,
            return_url: `${webOrigin()}/dashboard/billing`,
        });

        return { url: session.url };
    }

    async getSubscriptionStatus(userId: string) {
        const quota = await this.prisma.userQuota.findUnique({
            where: { userId },
        });
        if (!quota) {
            return {
                plan: "free",
                status: "inactive",
                subscriptionId: null,
                customerId: null,
            };
        }

        return {
            plan: quota.plan || "free",
            status: quota.subscriptionStatus || "inactive",
            subscriptionId: quota.stripeSubscriptionId,
            customerId: quota.stripeCustomerId,
        };
    }

    async syncSubscriptionStatus(
        userId: string,
        subscriptionId: string,
    ): Promise<void> {
        const stripe = this.getStripe();
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = getPlanFromStripeSubscription(sub);

        if (sub.status === "canceled" || sub.status === "unpaid") {
            await this.downgradeToFree(userId);
        } else {
            const cfg = PLANS[plan];
            if (!cfg) return;

            await this.prisma.userQuota.update({
                where: { userId },
                data: {
                    plan,
                    subscriptionStatus: sub.status,
                    maxProjectsPerMonth: cfg.quotas.maxProjectsPerMonth,
                    maxProjectMinutesPerMonth:
                        cfg.quotas.maxProjectMinutesPerMonth,
                    maxRendersPerMonth: cfg.quotas.maxRendersPerMonth,
                },
            });
        }
    }

    async cancelSubscription(userId: string): Promise<{ success: boolean }> {
        const quota = await this.prisma.userQuota.findUnique({
            where: { userId },
        });
        if (!quota?.stripeSubscriptionId) {
            throw new BadRequestException(
                "Usuário não possui assinatura ativa",
            );
        }

        const stripe = this.getStripe();
        await stripe.subscriptions.cancel(quota.stripeSubscriptionId);
        await this.downgradeToFree(userId);

        return { success: true };
    }

    async handleWebhook(rawBody: Buffer, signature: string) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret)
            throw new Error("STRIPE_WEBHOOK_SECRET não configurado");

        const stripe = this.getStripe();
        const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            webhookSecret,
        );

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const plan = session.metadata?.plan;
                if (userId && plan)
                    await this.activateSubscription(userId, plan, session);
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                const userId =
                    sub.metadata?.userId ||
                    (await this.findUserIdByCustomer(sub.customer as string));
                if (userId) {
                    await this.updateSubscriptionStatus(userId, sub.status);
                    if (sub.status === "canceled" || sub.status === "unpaid") {
                        await this.downgradeToFree(userId);
                    }
                }
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const userId =
                    invoice.metadata?.userId ||
                    (await this.findUserIdByCustomer(
                        invoice.customer as string,
                    ));
                if (userId)
                    this.logger.warn({ msg: "Pagamento falhou", userId });
                break;
            }
        }

        return { received: true };
    }

    private async activateSubscription(
        userId: string,
        plan: string,
        session: Stripe.Checkout.Session,
    ) {
        if (!session.subscription) return;
        const subId =
            typeof session.subscription === "string"
                ? session.subscription
                : session.subscription.id;
        const customerId =
            typeof session.customer === "string"
                ? session.customer
                : session.customer?.toString() || "";

        const sub = await this.getStripe().subscriptions.retrieve(subId);
        const cfg = PLANS[plan];
        if (!cfg) return;

        await this.prisma.userQuota.upsert({
            where: { userId },
            update: {
                plan,
                stripeSubscriptionId: subId,
                stripeCustomerId: customerId,
                subscriptionStatus: sub.status,
                maxProjectsPerMonth: cfg.quotas.maxProjectsPerMonth,
                maxProjectMinutesPerMonth: cfg.quotas.maxProjectMinutesPerMonth,
                maxRendersPerMonth: cfg.quotas.maxRendersPerMonth,
            },
            create: {
                userId,
                plan,
                stripeSubscriptionId: subId,
                stripeCustomerId: customerId,
                subscriptionStatus: sub.status,
                maxProjectsPerMonth: cfg.quotas.maxProjectsPerMonth,
                maxProjectMinutesPerMonth: cfg.quotas.maxProjectMinutesPerMonth,
                maxRendersPerMonth: cfg.quotas.maxRendersPerMonth,
            },
        });
    }

    private async updateSubscriptionStatus(
        userId: string,
        status: Stripe.Subscription.Status,
    ) {
        await this.prisma.userQuota.update({
            where: { userId },
            data: { subscriptionStatus: status },
        });
    }

    private async downgradeToFree(userId: string) {
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
    }

    private async findUserIdByCustomer(
        customerId: string,
    ): Promise<string | null> {
        const quota = await this.prisma.userQuota.findFirst({
            where: { stripeCustomerId: customerId },
        });
        return quota?.userId ?? null;
    }

    private getStripe(): Stripe {
        if (!this.stripe) {
            throw new BadRequestException("Stripe não está configurado");
        }
        return this.stripe;
    }
}
