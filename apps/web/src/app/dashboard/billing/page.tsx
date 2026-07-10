"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useQuota } from "@/hooks/useQuota";
import { api } from "@/lib/api";

// ----- Planos — espelham exatamente o backend (plans.ts) -----

interface PlanDef {
    id: string;
    name: string;
    price: string;
    priceNote: string;
    description: string;
    features: string[];
    highlight?: boolean;
}

const PLANS: PlanDef[] = [
    {
        id: "free",
        name: "Free",
        price: "R$ 0",
        priceNote: "/ mês",
        description: "Pra experimentar sem cartão.",
        features: [
            "5 vídeos por mês",
            "60 minutos processados",
            "20 renders por mês",
            "10 cortes por vídeo",
            "Suporte via comunidade",
        ],
    },
    {
        id: "pro",
        name: "Pro",
        price: "R$ 49",
        priceNote: "/ mês",
        description: "Pra quem posta todo dia.",
        features: [
            "50 vídeos por mês",
            "600 minutos processados",
            "200 renders por mês",
            "100 cortes por vídeo",
            "Fila de render prioritária",
            "Marca d'água personalizada",
            "Suporte por e-mail",
        ],
        highlight: true,
    },
    {
        id: "studio",
        name: "Studio",
        price: "R$ 149",
        priceNote: "/ mês",
        description: "Pra estúdios e times em operação.",
        features: [
            "500 vídeos por mês",
            "6 000 minutos processados",
            "2 000 renders por mês",
            "500 cortes por vídeo",
            "Fila VIP de render",
            "Brand kits ilimitados",
            "Acesso à API pública",
            "Analytics avançado",
            "Suporte prioritário",
        ],
    },
];

const statusLabels: Record<string, string> = {
    active: "Ativa",
    trialing: "Trial",
    past_due: "Pagamento pendente",
    canceled: "Cancelada",
    inactive: "Inativa",
    unpaid: "Não paga",
};

function UsageBar({
    used,
    limit,
    label,
}: {
    used: number;
    limit: number;
    label: string;
}) {
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-xs text-ink-secondary">
                <span>{label}</span>
                <span className="font-mono font-bold tabular-nums text-ink-primary">
                    {used.toLocaleString("pt-BR")}/
                    {limit.toLocaleString("pt-BR")}
                </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-elevated">
                <div
                    className="h-full rounded-pill bg-progress-viral transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export default function BillingPage() {
    const queryClient = useQueryClient();
    const { data: quota, isLoading: quotaLoading } = useQuota();
    const { data: billingStatus, isLoading: statusLoading } = useQuery({
        queryKey: ["billing-status"],
        queryFn: () => api.billing.status(),
        staleTime: 60_000,
    });

    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);

    const cancelMutation = useMutation({
        mutationFn: () => api.billing.cancel(),
        onSuccess: () => {
            toast.success(
                "Assinatura cancelada. Você continua com acesso até o fim do período.",
            );
            setConfirmCancel(false);
            queryClient.invalidateQueries({ queryKey: ["billing-status"] });
            queryClient.invalidateQueries({ queryKey: ["quota"] });
        },
        onError: () => {
            toast.error("Erro ao cancelar assinatura. Tente pelo portal.");
        },
    });

    const handleCheckout = async (planId: string) => {
        if (planId === "free") return;
        setCheckoutLoading(planId);
        try {
            const data = await api.billing.checkout(planId);
            if (data.url) window.location.href = data.url;
        } catch {
            toast.error(
                "Erro ao iniciar checkout. Verifique se o Stripe está configurado.",
            );
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handlePortal = async () => {
        setCheckoutLoading("portal");
        try {
            const data = await api.billing.portal();
            if (data.url) window.location.href = data.url;
        } catch {
            toast.error("Erro ao abrir portal de gerenciamento.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    const currentPlan = (
        billingStatus?.plan ??
        quota?.plan ??
        "free"
    ).toLowerCase();
    const isSubscribed =
        currentPlan !== "free" && billingStatus?.status === "active";
    const isLoading = quotaLoading || statusLoading;
    const currentPlanDef =
        PLANS.find((plan) => plan.id === currentPlan) ?? PLANS[0];
    const recommendedPlan =
        currentPlan === "free"
            ? PLANS[1]
            : currentPlan === "pro"
              ? PLANS[2]
              : null;
    const otherPlans = PLANS.filter(
        (plan) => plan.id !== currentPlan && plan.id !== recommendedPlan?.id,
    );

    return (
        <div className="mx-auto max-w-[1100px] px-1 py-2 md:px-4 md:py-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">
                sem surpresa na fatura
            </p>
            <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">
                Plano
            </h1>

            {billingStatus?.status === "past_due" && (
                <div className="mt-6 flex items-center gap-3 rounded-input border border-[rgba(255,79,90,0.35)] bg-[rgba(255,79,90,0.1)] px-4 py-3 text-sm text-ink-secondary">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF8A8A]" />
                    <span>
                        Teu pagamento está pendente. Atualiza o método de
                        pagamento pra manter o acesso.
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="ml-auto shrink-0"
                        onClick={handlePortal}
                        loading={checkoutLoading === "portal"}
                    >
                        Atualizar pagamento
                    </Button>
                </div>
            )}

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
                {/* Plano atual */}
                <section className="flex flex-col rounded-card border border-hairline-subtle bg-surface p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                plano atual
                            </p>
                            <div className="mt-2 flex items-baseline gap-2">
                                <h2 className="font-display text-heading-md font-extrabold text-ink-primary">
                                    {currentPlanDef.name}
                                </h2>
                                <span className="font-mono text-sm text-ink-tertiary">
                                    {currentPlanDef.price}
                                    {currentPlanDef.priceNote}
                                </span>
                            </div>
                        </div>
                        {billingStatus?.status &&
                            billingStatus.status !== "inactive" && (
                                <span className="rounded-pill border border-hairline-subtle px-2.5 py-1 text-xs font-semibold text-ink-secondary">
                                    {statusLabels[billingStatus.status] ??
                                        billingStatus.status}
                                </span>
                            )}
                    </div>

                    {quota && !quotaLoading && (
                        <div className="mt-6 space-y-4">
                            <UsageBar
                                used={quota.projectsUsed}
                                limit={quota.projectsLimit}
                                label="Vídeos processados"
                            />
                            <UsageBar
                                used={Math.ceil(quota.minutesUsed)}
                                limit={Math.ceil(quota.minutesLimit)}
                                label="Minutos processados"
                            />
                            <UsageBar
                                used={quota.rendersUsed}
                                limit={quota.rendersLimit}
                                label="Renders gerados"
                            />
                            {quota.resetAt && (
                                <p className="font-mono text-micro text-ink-tertiary">
                                    renova em{" "}
                                    {new Date(
                                        quota.resetAt,
                                    ).toLocaleDateString("pt-BR", {
                                        day: "2-digit",
                                        month: "short",
                                    })}
                                </p>
                            )}
                        </div>
                    )}

                    <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-secondary">
                        {currentPlanDef.features.map((feature) => (
                            <li
                                key={feature}
                                className="flex items-start gap-2"
                            >
                                <Check
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--accent-text)]"
                                    strokeWidth={2.4}
                                />
                                {feature}
                            </li>
                        ))}
                    </ul>

                    <div className="mt-auto pt-6">
                        {isSubscribed ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handlePortal}
                                    loading={checkoutLoading === "portal"}
                                >
                                    Gerenciar assinatura
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setConfirmCancel(true)}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        ) : (
                            <p className="font-mono text-micro text-ink-tertiary">
                                Sem faturas ainda.
                            </p>
                        )}
                        {confirmCancel && (
                            <div className="mt-4 rounded-input border border-[rgba(255,79,90,0.35)] bg-[rgba(255,79,90,0.08)] p-4">
                                <p className="text-sm text-ink-secondary">
                                    Certeza? Você perde os recursos premium no
                                    fim do período já pago.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        loading={cancelMutation.isPending}
                                        onClick={() => cancelMutation.mutate()}
                                    >
                                        Confirmar cancelamento
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setConfirmCancel(false)}
                                    >
                                        Manter assinatura
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Plano recomendado */}
                {recommendedPlan ? (
                    <section className="relative flex flex-col rounded-card border-[1.5px] border-accent bg-surface p-6 shadow-glow">
                        <span className="absolute -top-3 left-6 rounded-pill bg-accent px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#10120A]">
                            recomendado
                        </span>
                        <h2 className="font-display text-heading-md font-extrabold text-ink-primary">
                            {recommendedPlan.name}
                        </h2>
                        <div className="mt-3 flex items-baseline gap-1.5">
                            <span className="font-display text-[44px] font-extrabold leading-none text-[color:var(--accent-text)]">
                                {recommendedPlan.price}
                            </span>
                            <span className="font-mono text-sm text-ink-tertiary">
                                {recommendedPlan.priceNote}
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-ink-secondary">
                            {recommendedPlan.description}
                        </p>
                        <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-secondary">
                            {recommendedPlan.features.map((feature) => (
                                <li
                                    key={feature}
                                    className="flex items-start gap-2"
                                >
                                    <Check
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--accent-text)]"
                                        strokeWidth={2.4}
                                    />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-auto pt-6">
                            <Button
                                className="w-full"
                                loading={checkoutLoading === recommendedPlan.id}
                                onClick={() =>
                                    handleCheckout(recommendedPlan.id)
                                }
                            >
                                {currentPlan === "free"
                                    ? "Virar Pro agora"
                                    : `Mudar para ${recommendedPlan.name}`}
                            </Button>
                        </div>
                    </section>
                ) : (
                    <section className="flex flex-col items-center justify-center rounded-card border border-hairline-subtle bg-surface p-6 text-center">
                        <p className="font-display text-lg font-bold text-ink-primary">
                            Você está no topo ✦
                        </p>
                        <p className="mt-2 max-w-xs text-sm text-ink-secondary">
                            O Studio é o nosso maior plano. Precisa de mais?
                            Fala com a gente.
                        </p>
                    </section>
                )}
            </div>

            {/* Outros planos */}
            {otherPlans.length > 0 && (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                    {otherPlans.map((plan) => (
                        <section
                            key={plan.id}
                            className="flex items-center justify-between gap-4 rounded-card border border-hairline-subtle bg-surface p-5"
                        >
                            <div>
                                <h3 className="font-display text-base font-bold text-ink-primary">
                                    {plan.name}
                                </h3>
                                <p className="mt-1 font-mono text-sm text-ink-tertiary">
                                    {plan.price}
                                    {plan.priceNote}
                                </p>
                                <p className="mt-1 text-xs text-ink-secondary">
                                    {plan.description}
                                </p>
                            </div>
                            {plan.id === "free" ? (
                                isSubscribed ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setConfirmCancel(true)}
                                    >
                                        Fazer downgrade
                                    </Button>
                                ) : null
                            ) : (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={checkoutLoading === plan.id}
                                    onClick={() => handleCheckout(plan.id)}
                                >
                                    {isSubscribed
                                        ? `Mudar para ${plan.name}`
                                        : `Assinar ${plan.name}`}
                                </Button>
                            )}
                        </section>
                    ))}
                </div>
            )}

            {/* FAQ rápido */}
            <section className="mt-10 space-y-4 rounded-card border border-hairline-subtle bg-surface p-6">
                <h2 className="font-display text-base font-bold text-ink-primary">
                    Perguntas frequentes
                </h2>
                <div className="grid gap-4 text-sm text-ink-secondary sm:grid-cols-2">
                    <div>
                        <p className="font-semibold text-ink-primary">
                            Os limites resetam quando?
                        </p>
                        <p className="mt-1">
                            No início de cada mês, na data de renovação da sua
                            assinatura.
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold text-ink-primary">
                            Posso cancelar a qualquer momento?
                        </p>
                        <p className="mt-1">
                            Sim. Você mantém o acesso até o fim do período já
                            pago e não há multa.
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold text-ink-primary">
                            O que acontece se eu atingir os limites?
                        </p>
                        <p className="mt-1">
                            Novos processamentos são bloqueados até o reset
                            mensal ou upgrade de plano.
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold text-ink-primary">
                            As chaves de API contam nos limites?
                        </p>
                        <p className="mt-1">
                            Não. As chaves DeepSeek e OpenAI são suas. Os
                            limites se referem ao uso da plataforma.
                        </p>
                    </div>
                </div>
            </section>

            {!isLoading && !isSubscribed && (
                <p className="mt-6 font-mono text-micro text-ink-tertiary">
                    grátis · sem cartão · upgrade quando quiser
                </p>
            )}
        </div>
    );
}
