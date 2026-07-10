import { Injectable } from "@nestjs/common";

export interface PricingTier {
    id: string;
    name: string;
    price: number;
    currency: string;
    billingPeriod: "month" | "year";
    description: string;
    features: string[];
    limits: {
        maxProjects: number;
        maxMinutes: number;
        maxRenders: number;
        maxClips: number;
    };
}

export interface PricingResponse {
    free: PricingTier;
    pro: PricingTier;
    studio: PricingTier;
    currency: string;
}

export interface CostEstimate {
    cost: number;
    breakdown: {
        projectMinutesPrice: number;
        rendersPrice: number;
        basePrice: number;
    };
}

@Injectable()
export class PricingService {
    private readonly currency = "USD";

    // Pricing tiers - free plan has no monthly cost
    private readonly tiers: Record<string, PricingTier> = {
        free: {
            id: "free",
            name: "Free",
            price: 0,
            currency: this.currency,
            billingPeriod: "month",
            description: "Perfect for getting started",
            features: [
                "Community support",
                "Basic editing tools",
                "Up to 5 projects per month",
                "Up to 60 minutes of processing",
                "Up to 20 renders per month",
                "Up to 10 clips per project",
            ],
            limits: {
                maxProjects: 5,
                maxMinutes: 60,
                maxRenders: 20,
                maxClips: 10,
            },
        },
        pro: {
            id: "pro",
            name: "Pro",
            price: 49,
            currency: this.currency,
            billingPeriod: "month",
            description: "For content creators",
            features: [
                "Email support",
                "Advanced editing tools",
                "Up to 50 projects per month",
                "Up to 600 minutes of processing",
                "Up to 200 renders per month",
                "Up to 100 clips per project",
                "Priority rendering queue",
                "Custom watermarks",
            ],
            limits: {
                maxProjects: 50,
                maxMinutes: 600,
                maxRenders: 200,
                maxClips: 100,
            },
        },
        studio: {
            id: "studio",
            name: "Studio",
            price: 149,
            currency: this.currency,
            billingPeriod: "month",
            description: "For professional studios",
            features: [
                "Priority support",
                "Enterprise editing tools",
                "Up to 500 projects per month",
                "Up to 6000 minutes of processing",
                "Up to 2000 renders per month",
                "Up to 500 clips per project",
                "VIP rendering queue",
                "Custom branding and API access",
                "Team collaboration tools",
                "Advanced analytics",
            ],
            limits: {
                maxProjects: 500,
                maxMinutes: 6000,
                maxRenders: 2000,
                maxClips: 500,
            },
        },
    };

    getPricingTiers(): PricingResponse {
        return {
            free: this.tiers.free,
            pro: this.tiers.pro,
            studio: this.tiers.studio,
            currency: this.currency,
        };
    }

    formatCurrency(amount: number, currency: string = this.currency): string {
        const formatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return formatter.format(amount);
    }

    /**
     * Estimates monthly cost based on usage
     * This is a simplified model - in production, you might have more complex pricing tiers
     */
    estimateMonthlyCost(
        projectDurationMinutes: number,
        rendersCount: number,
    ): CostEstimate {
        // Pricing per additional resource (beyond free tier)
        const minutePricing = 0.05; // $0.05 per minute over 60 minute free limit
        const renderPricing = 0.2; // $0.20 per render over 20 render free limit

        // Calculate overage costs
        const minutesOverage = Math.max(0, projectDurationMinutes - 60);
        const rendersOverage = Math.max(0, rendersCount - 20);

        const projectMinutesPrice = minutesOverage * minutePricing;
        const rendersPrice = rendersOverage * renderPricing;
        const basePrice = 0; // Free tier base

        const cost = projectMinutesPrice + rendersPrice;

        return {
            cost: Math.round(cost * 100) / 100, // Round to 2 decimals
            breakdown: {
                projectMinutesPrice:
                    Math.round(projectMinutesPrice * 100) / 100,
                rendersPrice: Math.round(rendersPrice * 100) / 100,
                basePrice,
            },
        };
    }
}
