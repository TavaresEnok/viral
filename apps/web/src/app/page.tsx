"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { TrackedLink } from "@/components/common/TrackedLink";
import { Logo } from "@/components/layout/Logo";
import { capture } from "@/lib/analytics";
import { cn } from "@/lib/cn";

const phones: Array<{
    tilt: string;
    duration: string;
    score: string;
    caption: string;
    gradient: string;
}> = [
    {
        tilt: "-7deg",
        duration: "5.4s",
        score: "▲ 91",
        caption: "ISSO MUDA TUDO",
        gradient: "linear-gradient(160deg, #1B2412, #0C0C11 60%, #16101C)",
    },
    {
        tilt: "0deg",
        duration: "6s",
        score: "▲ 96",
        caption: "PARA TUDO E OUVE",
        gradient: "linear-gradient(160deg, #161620, #0C0C11 55%, #1B2412)",
    },
    {
        tilt: "7deg",
        duration: "5s",
        score: "▲ 93",
        caption: "O SEGREDO REVELADO",
        gradient: "linear-gradient(160deg, #20141C, #0C0C11 60%, #14201E)",
    },
];

const steps: Array<[string, string, string]> = [
    [
        "01",
        "Cola o link",
        "YouTube, live ou podcast. Ou sobe o arquivo direto do computador.",
    ],
    [
        "02",
        "A IA caça os momentos",
        "Transcreve tudo, pontua cada trecho e corta só o que tem gancho forte.",
    ],
    [
        "03",
        "Baixa ou posta direto",
        "Cortes 9:16 com legenda queimada, prontos pra TikTok, Reels e Shorts.",
    ],
];

const faqs: Array<[string, string]> = [
    [
        "A IA entende português do Brasil mesmo?",
        "Sim. O fluxo foi calibrado pra PT-BR: gírias, cortes de podcast, entrevistas e vídeos longos em português.",
    ],
    [
        "Só escolhe os cortes ou também renderiza?",
        "Encontra os melhores momentos, gera legenda, renderiza os cortes em 9:16 e deixa tudo pronto pra postar.",
    ],
    [
        "Posso editar os cortes antes de baixar?",
        "Pode. Cada corte abre no editor pra ajustar início/fim, layout, legenda e renderizar de novo.",
    ],
    [
        "Preciso de cartão pra começar?",
        "Não. O plano Free dá 5 vídeos por mês, sem cartão. Upgrade só quando fizer sentido.",
    ],
];

export default function LandingPage() {
    const router = useRouter();
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [link, setLink] = useState("");

    function submitLink(event: React.FormEvent) {
        event.preventDefault();
        capture("landing_cta_clicked", {
            placement: "hero_link",
            hasLink: Boolean(link.trim()),
        });
        const target = link.trim()
            ? `/dashboard/new?url=${encodeURIComponent(link.trim())}`
            : "/register";
        router.push(target);
    }

    return (
        <main className="min-h-screen bg-base text-ink-primary">
            {/* Nav */}
            <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5">
                <Logo />
                <div className="hidden items-center gap-7 text-sm font-medium text-ink-secondary md:flex">
                    <a
                        href="#como-funciona"
                        className="transition hover:text-ink-primary"
                    >
                        Como funciona
                    </a>
                    <a
                        href="#precos"
                        className="transition hover:text-ink-primary"
                    >
                        Preços
                    </a>
                    <Link
                        href="/login"
                        className="transition hover:text-ink-primary"
                    >
                        Entrar
                    </Link>
                </div>
                <TrackedLink
                    href="/register"
                    event="landing_cta_clicked"
                    properties={{ placement: "nav" }}
                    className="inline-flex h-10 items-center rounded-pill bg-accent px-5 text-sm font-bold text-[#10120A] transition hover:brightness-105"
                >
                    Criar grátis
                </TrackedLink>
            </nav>

            {/* Hero */}
            <header className="px-4 pb-20 pt-14 text-center md:pt-20">
                <span className="inline-flex items-center gap-2 rounded-pill border border-hairline-strong px-4 py-1.5 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-secondary">
                    <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-pill bg-accent"
                        style={{
                            animation: "vr-blink 1.5s ease-in-out infinite",
                        }}
                    />
                    feito para creators BR
                </span>
                <h1
                    className="mx-auto mt-7 max-w-4xl font-display font-extrabold leading-[1.02] tracking-[-0.03em]"
                    style={{ fontSize: "clamp(44px, 6.4vw, 84px)" }}
                >
                    Vídeo longo vira{" "}
                    <span className="text-[color:var(--accent-text)]">
                        cortes que estouram
                    </span>
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-[19px] leading-relaxed text-ink-secondary">
                    Cola o link, a IA caça os melhores momentos e te devolve
                    cortes 9:16 com legenda, prontos pra postar.
                </p>

                <form
                    onSubmit={submitLink}
                    className="mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-pill border border-hairline-subtle bg-surface p-2 pl-5 focus-within:border-accent"
                >
                    <input
                        value={link}
                        onChange={(event) => setLink(event.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        aria-label="Link do vídeo"
                        className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-ink-primary outline-none placeholder:text-ink-tertiary"
                    />
                    <button
                        type="submit"
                        className="h-11 shrink-0 rounded-pill bg-accent px-5 text-sm font-bold text-[#10120A] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        Gerar cortes
                    </button>
                </form>
                <p className="mt-4 font-mono text-micro uppercase tracking-[0.12em] text-ink-tertiary">
                    grátis · sem cartão · 5 vídeos por mês
                </p>

                {/* 3 celulares flutuando */}
                <div className="mt-16 flex items-center justify-center gap-5 md:gap-8">
                    {phones.map((phone) => (
                        <div
                            key={phone.tilt}
                            className="relative w-[140px] overflow-hidden rounded-[22px] border border-hairline-strong md:w-[170px]"
                            style={
                                {
                                    aspectRatio: "9/16",
                                    background: phone.gradient,
                                    "--tilt": phone.tilt,
                                    animation: `vr-float ${phone.duration} ease-in-out infinite`,
                                } as CSSProperties
                            }
                        >
                            <div
                                className="absolute inset-0 bg-thumb-stripe"
                                aria-hidden="true"
                            />
                            <span className="absolute left-3 top-3 rounded-pill bg-black/65 px-2 py-0.5 font-mono text-[10px] font-bold text-[color:var(--accent-text)] backdrop-blur">
                                {phone.score}
                            </span>
                            <span
                                className="absolute inset-x-2 bottom-6 text-center font-display text-sm font-extrabold uppercase leading-[1.15] text-white"
                                style={{
                                    textShadow:
                                        "2px 2px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000",
                                }}
                            >
                                {phone.caption}
                            </span>
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                                <div className="h-full w-3/4 bg-accent" />
                            </div>
                        </div>
                    ))}
                </div>
            </header>

            {/* Marquee */}
            <div className="overflow-hidden bg-accent py-3">
                <div
                    className="flex w-max whitespace-nowrap"
                    style={{ animation: "vr-marquee 22s linear infinite" }}
                >
                    {[0, 1].map((copy) => (
                        <span
                            key={copy}
                            aria-hidden={copy === 1}
                            className="font-display text-lg font-extrabold uppercase tracking-tight text-[#10120A]"
                        >
                            Podcast → 12 cortes ✦ Live → 8 cortes ✦ Aula → 9
                            cortes ✦ Entrevista → 7 cortes ✦ Vlog → 6 cortes ✦
                            Sermão → 10 cortes ✦{" "}
                        </span>
                    ))}
                </div>
            </div>

            {/* 3 passos */}
            <section
                id="como-funciona"
                className="mx-auto max-w-6xl px-5 py-24"
            >
                <h2 className="text-center font-display text-heading-md font-extrabold tracking-tight md:text-4xl">
                    Do link ao post em 3 passos
                </h2>
                <div className="mt-12 grid gap-5 md:grid-cols-3">
                    {steps.map(([number, title, text]) => (
                        <div
                            key={number}
                            className="rounded-card border border-hairline-subtle bg-surface p-7"
                        >
                            <span className="font-mono text-sm font-bold text-[color:var(--accent-text)]">
                                {number}
                            </span>
                            <h3 className="mt-4 font-display text-lg font-bold tracking-tight">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                                {text}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Preços */}
            <section id="precos" className="mx-auto max-w-4xl px-5 pb-24">
                <h2 className="text-center font-display text-heading-md font-extrabold tracking-tight md:text-4xl">
                    Começa grátis, cresce quando estourar
                </h2>
                <div className="mt-12 grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col rounded-card border border-hairline-subtle bg-surface p-7">
                        <h3 className="font-display text-lg font-bold">
                            Free
                        </h3>
                        <p className="mt-3 font-display text-[44px] font-extrabold leading-none">
                            R$ 0
                            <span className="font-mono text-sm font-medium text-ink-tertiary">
                                {" "}
                                /mês
                            </span>
                        </p>
                        <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                            <li>5 vídeos por mês</li>
                            <li>Cortes 9:16 com legenda</li>
                            <li>Score viral em cada corte</li>
                            <li>Sem cartão de crédito</li>
                        </ul>
                        <TrackedLink
                            href="/register"
                            event="landing_cta_clicked"
                            properties={{ placement: "pricing_free" }}
                            className="mt-auto pt-7"
                        >
                            <span className="inline-flex h-[46px] w-full items-center justify-center rounded-pill border border-hairline-strong text-sm font-semibold text-ink-primary transition hover:bg-elevated/60">
                                Criar grátis
                            </span>
                        </TrackedLink>
                    </div>
                    <div className="relative flex flex-col rounded-card border-[1.5px] border-accent bg-surface p-7 shadow-glow">
                        <span className="absolute -top-3 left-7 rounded-pill bg-accent px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#10120A]">
                            mais usado
                        </span>
                        <h3 className="font-display text-lg font-bold">Pro</h3>
                        <p className="mt-3 font-display text-[44px] font-extrabold leading-none text-[color:var(--accent-text)]">
                            R$ 49
                            <span className="font-mono text-sm font-medium text-ink-tertiary">
                                {" "}
                                /mês
                            </span>
                        </p>
                        <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                            <li>50 vídeos por mês</li>
                            <li>Fila de render prioritária</li>
                            <li>Marca d&apos;água personalizada</li>
                            <li>Postagem direta nas redes</li>
                        </ul>
                        <TrackedLink
                            href="/register"
                            event="landing_cta_clicked"
                            properties={{ placement: "pricing_pro" }}
                            className="mt-auto pt-7"
                        >
                            <span className="inline-flex h-[46px] w-full items-center justify-center rounded-pill bg-accent text-sm font-bold text-[#10120A] transition hover:brightness-105">
                                Virar Pro
                            </span>
                        </TrackedLink>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="mx-auto max-w-3xl px-5 pb-24">
                <h2 className="text-center font-display text-heading-md font-extrabold tracking-tight">
                    Perguntas frequentes
                </h2>
                <div className="mt-10 space-y-3">
                    {faqs.map(([question, answer], index) => (
                        <button
                            key={question}
                            type="button"
                            onClick={() =>
                                setOpenFaq(openFaq === index ? null : index)
                            }
                            className="w-full rounded-card border border-hairline-subtle bg-surface px-6 py-5 text-left transition hover:border-hairline-strong"
                        >
                            <span className="flex items-center justify-between gap-4 font-semibold text-ink-primary">
                                {question}
                                <ChevronDown
                                    className={cn(
                                        "h-5 w-5 shrink-0 text-ink-tertiary transition",
                                        openFaq === index &&
                                            "rotate-180 text-[color:var(--accent-text)]",
                                    )}
                                />
                            </span>
                            {openFaq === index && (
                                <span className="mt-4 block text-sm leading-relaxed text-ink-secondary">
                                    {answer}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            {/* CTA final */}
            <section className="px-4 pb-24 text-center">
                <h2
                    className="mx-auto max-w-3xl font-display font-extrabold leading-[1.05] tracking-[-0.03em]"
                    style={{ fontSize: "clamp(34px, 4.6vw, 60px)" }}
                >
                    O algoritmo ama quem{" "}
                    <span className="text-[color:var(--accent-text)]">
                        posta todo dia
                    </span>
                    .
                </h2>
                <TrackedLink
                    href="/register"
                    event="landing_cta_clicked"
                    properties={{ placement: "final" }}
                    className="mt-10 inline-flex h-[52px] items-center gap-2 rounded-pill bg-accent px-8 text-base font-bold text-[#10120A] transition hover:brightness-105"
                >
                    Criar grátis agora
                </TrackedLink>
                <p className="mt-5 font-mono text-micro uppercase tracking-[0.12em] text-ink-tertiary">
                    grátis · sem cartão · cancela quando quiser
                </p>
            </section>

            {/* Footer */}
            <footer className="border-t border-hairline-subtle px-5 py-10">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
                    <Logo />
                    <div className="flex flex-wrap gap-5 text-sm text-ink-secondary">
                        <a
                            href="#como-funciona"
                            className="transition hover:text-ink-primary"
                        >
                            Como funciona
                        </a>
                        <a
                            href="#precos"
                            className="transition hover:text-ink-primary"
                        >
                            Preços
                        </a>
                        <Link
                            href="/login"
                            className="transition hover:text-ink-primary"
                        >
                            Entrar
                        </Link>
                        <Link
                            href="/privacy"
                            className="transition hover:text-ink-primary"
                        >
                            Privacidade
                        </Link>
                        <Link
                            href="/terms"
                            className="transition hover:text-ink-primary"
                        >
                            Termos
                        </Link>
                    </div>
                    <p className="font-mono text-xs text-ink-tertiary">
                        2026 viral.
                    </p>
                </div>
            </footer>
        </main>
    );
}
