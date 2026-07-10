"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronRight, Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
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
        description: "Para experimentar a plataforma.",
        features: [
            "5 projetos por mês",
            "60 minutos processados",
            "20 renders por mês",
            "10 clips por projeto",
            "Suporte via comunidade",
        ],
    },
    {
        id: "pro",
        name: "Pro",
        price: "R$ 49",
        priceNote: "/ mês",
        description: "Para criadores de conteúdo ativos.",
        features: [
            "50 projetos por mês",
            "600 minutos processados",
            "200 renders por mês",
            "100 clips por projeto",
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
        description: "Para estúdios e times em operação.",
        features: [
            "500 projetos por mês",
            "6 000 minutos processados",
            "2 000 renders por mês",
            "500 clips por projeto",
            "Fila VIP de render",
            "Brand kits ilimitados",
            "Acesso à API pública",
            "Analytics avançado",
            "Suporte prioritário",
        ],
    },
];

// ----- Sub-componentes -----

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
    const color =
        pct >= 90
            ? "bg-signal-danger"
            : pct >= 70
              ? "bg-signal-caution"
              : "bg-accent";
    return (
        <div>
            <div className="flex items-center justify-between text-xs text-ink-secondary">
                <span>{label}</span>
                <span className="tabular-nums">
                    {used.toLocaleString("pt-BR")} /{" "}
                    {limit.toLocaleString("pt-BR")}
                </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-hairline-subtle">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
    const map: Record<
        string,
        { label: string; variant: "accent" | "default" | "danger" }
    > = {
        active: { label: "Ativa", variant: "accent" },
        trialing: { label: "Trial", variant: "accent" },
        past_due: { label: "Pagamento pendente", variant: "danger" },
        canceled: { label: "Cancelada", variant: "default" },
        inactive: { label: "Inativa", variant: "default" },
        unpaid: { label: "Não paga", variant: "danger" },
    };
    const cfg = map[status] ?? { label: status, variant: "default" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ----- Página -----

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
                "Assinatura cancelada. Você continuará com acesso até o fim do período.",
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

    const currentPlan = billingStatus?.plan ?? quota?.plan ?? "free";
    const isSubscribed =
        currentPlan !== "free" && billingStatus?.status === "active";
    const isLoading = quotaLoading || statusLoading;

    return (
        <div className="mx-auto max-w-[1400px] px-1 py-2 md:px-4 md:py-6">
            {/* Aviso plano free */}
            {!isLoading && !isSubscribed && (
                <div className="mb-6 flex items-center gap-3 rounded-lg border border-signal-caution/30 bg-signal-caution/10 px-4 py-3 text-sm text-ink-secondary">
                    <Timer className="h-4 w-4 shrink-0 text-yellow-400" />
                    <span>
                        Você está no plano gratuito. Faça upgrade para aumentar
                        seus limites.
                    </span>
                </div>
            )}

            {/* Aviso pagamento pendente */}
            {billingStatus?.status === "past_due" && (
                <div className="mb-6 flex items-center gap-3 rounded-lg border border-signal-danger/30 bg-signal-danger/10 px-4 py-3 text-sm text-ink-secondary">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>
                        Seu pagamento está pendente. Atualize o método de
                        pagamento para continuar com acesso.
                    </span>
                    <Button
                        variant="secondary"
                        className="ml-auto shrink-0"
                        onClick={handlePortal}
                    >
                        Atualizar pagamento
                    </Button>
                </div>
            )}

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">
                Conta
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-ink-primary md:text-5xl">
                Cobrança
            </h1>

            {/* Assinatura atual */}
            {isSubscribed && billingStatus && (
                <section className="mt-6 rounded-lg border border-accent/30 bg-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs text-ink-tertiary uppercase tracking-[0.15em] font-semibold">
                                Assinatura atual
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-lg font-semibold capitalize text-ink-primary">
                                    {currentPlan}
                                </span>
                                <SubscriptionStatusBadge
                                    status={billingStatus.status}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                onClick={handlePortal}
                                loading={checkoutLoading === "portal"}
                            >
                                Gerenciar assinatura{" "}
                                <ChevronRight className="ml-1 h-3 w-3" />
                            </Button>
                            <Button
                                variant="secondary"
                                className="text-signal-danger hover:border-signal-danger/40"
                                onClick={() => setConfirmCancel(true)}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>

                    {/* Confirmação de cancelamento inline */}
                    {confirmCancel && (
                        <div className="mt-4 rounded-md border border-signal-danger/30 bg-signal-danger/5 p-4">
                            <p className="text-sm text-ink-secondary">
                                Tem certeza? Você perderá acesso às
                                funcionalidades premium ao final do período já
                                pago.
                            </p>
                            <div className="mt-3 flex gap-2">
                                <Button
                                    variant="primary"
                                    className="bg-signal-danger hover:bg-signal-danger/90"
                                    loading={cancelMutation.isPending}
                                    onClick={() => cancelMutation.mutate()}
                                >
                                    Confirmar cancelamento
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setConfirmCancel(false)}
                                >
                                    Manter assinatura
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Uso do período */}
            {quota && !quotaLoading && (
                <section className="mt-6 rounded-lg border border-hairline-subtle bg-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-ink-primary">
                            Uso do período atual
                        </h2>
                        {quota.resetAt && (
                            <p className="text-xs text-ink-tertiary">
                                Renova em{" "}
                                <span className="font-medium text-ink-secondary">
                                    {new Date(quota.resetAt).toLocaleDateString(
                                        "pt-BR",
                                        {
                                            day: "2-digit",
                                            month: "short",
                                        },
                                    )}
                                </span>
                            </p>
                        )}
                    </div>
                    <div className="mt-4 flex flex-col gap-3">
                        <UsageBar
                            used={quota.projectsUsed}
                            limit={quota.projectsLimit}
                            label="Projetos processados"
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
                    </div>
                </section>
            )}

            {/* Planos */}
            <h2 className="mt-10 text-lg font-semibold text-ink-primary">
                Planos
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
                Todos os planos incluem acesso às funcionalidades core. Upgrade
                ou downgrade a qualquer momento.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
                {PLANS.map((plan) => {
                    const isActive = currentPlan === plan.id;
                    const isPaid = plan.id !== "free";

                    return (
                        <section
                            key={plan.id}
                            className={`relative flex flex-col rounded-lg border bg-surface p-6 transition-shadow hover:shadow-sm ${
                                isActive
                                    ? "border-accent shadow-sm"
                                    : plan.highlight
                                      ? "border-hairline-subtle ring-1 ring-accent/20"
                                      : "border-hairline-subtle"
                            }`}
                        >
                            {plan.highlight && !isActive && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
                                        Mais popular
                                    </span>
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                                <h3 className="text-xl font-semibold text-ink-primary">
                                    {plan.name}
                                </h3>
                                {isActive && (
                                    <Badge variant="accent">Atual</Badge>
                                )}
                            </div>

                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="font-mono text-4xl font-light text-ink-primary">
                                    {plan.price}
                                </span>
                                <span className="font-mono text-xs text-ink-tertiary">
                                    {plan.priceNote}
                                </span>
                            </div>

                            <p className="mt-2 text-xs text-ink-secondary">
                                {plan.description}
                            </p>

                            <ul className="mt-5 flex flex-col gap-2 text-sm text-ink-secondary">
                                {plan.features.map((feature) => (
                                    <li
                                        key={feature}
                                        className="flex items-start gap-2"
                                    >
                                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-auto pt-6">
                                {isActive ? (
                                    isSubscribed ? (
                                        <Button
                                            variant="secondary"
                                            className="w-full"
                                            onClick={handlePortal}
                                            loading={
                                                checkoutLoading === "portal"
                                            }
                                        >
                                            Gerenciar
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="secondary"
                                            className="w-full"
                                            disabled
                                        >
                                            Plano atual
                                        </Button>
                                    )
                                ) : isPaid ? (
                                    <Button
                                        variant={
                                            plan.highlight
                                                ? "primary"
                                                : "secondary"
                                        }
                                        className="w-full"
                                        loading={checkoutLoading === plan.id}
                                        onClick={() => handleCheckout(plan.id)}
                                    >
                                        {isSubscribed
                                            ? `Mudar para ${plan.name}`
                                            : `Assinar ${plan.name}`}
                                    </Button>
                                ) : // Downgrade para free
                                isSubscribed ? (
                                    <Button
                                        variant="secondary"
                                        className="w-full text-ink-tertiary"
                                        onClick={() => setConfirmCancel(true)}
                                    >
                                        Fazer downgrade
                                    </Button>
                                ) : null}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* FAQ rápido */}
            <section className="mt-10 space-y-4 rounded-lg border border-hairline-subtle bg-surface p-6">
                <h2 className="text-sm font-semibold text-ink-primary">
                    Perguntas frequentes
                </h2>
                <div className="grid gap-4 text-sm text-ink-secondary sm:grid-cols-2">
                    <div>
                        <p className="font-medium text-ink-primary">
                            Os limites resetam quando?
                        </p>
                        <p className="mt-1">
                            No início de cada mês, na data de renovação da sua
                            assinatura.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-ink-primary">
                            Posso cancelar a qualquer momento?
                        </p>
                        <p className="mt-1">
                            Sim. Você mantém o acesso até o fim do período já
                            pago e não há multa.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-ink-primary">
                            O que acontece se eu atingir os limites?
                        </p>
                        <p className="mt-1">
                            Novos processamentos são bloqueados até o reset
                            mensal ou upgrade de plano.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-ink-primary">
                            As chaves de API contam nos limites?
                        </p>
                        <p className="mt-1">
                            Não. As chaves DeepSeek e OpenAI são suas. Os
                            limites se referem ao uso da plataforma.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
