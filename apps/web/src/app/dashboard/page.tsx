"use client";

import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/common/Skeleton";
import { ProjectGrid } from "@/components/project/ProjectGrid";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useProjects } from "@/hooks/useProjects";
import { capture } from "@/lib/analytics";
import { cn } from "@/lib/cn";

// Estimativa de tempo de edição manual economizado por corte (achar o trecho,
// cortar, legendar e reenquadrar à mão). Usado só para a métrica de valor.
const MINUTES_SAVED_PER_CLIP = 15;

function HeroStat({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
    return (
        <div className="min-w-[84px]">
            <p
                className={cn(
                    "font-display text-3xl font-extrabold leading-none tabular-nums md:text-4xl",
                    accent ? "text-[color:var(--accent-text)]" : "text-ink-primary",
                )}
            >
                {value}
            </p>
            <p className="mt-1.5 text-xs text-ink-tertiary">{label}</p>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: projects = [], isLoading } = useProjects();
    const [query, setQuery] = useState("");
    const [url, setUrl] = useState("");

    useEffect(() => {
        if (searchParams?.get("new") === "1") {
            router.replace("/dashboard/new");
        }
    }, [router, searchParams]);

    const filteredProjects = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return projects;
        return projects.filter((project) =>
            `${project.title} ${project.language} ${project.contentType} ${project.clipStyle}`
                .toLowerCase()
                .includes(normalized),
        );
    }, [projects, query]);

    const totalClips = projects.reduce(
        (sum, project) =>
            sum + (project._count?.clips ?? project.clips?.length ?? 0),
        0,
    );

    const avgScore = useMemo(() => {
        const scores = projects
            .map((project) => {
                const clip = project.clips?.[0];
                return clip ? clip.finalScore || clip.viralScore : 0;
            })
            .filter((score) => score > 0);
        if (!scores.length) return 0;
        return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }, [projects]);

    const hoursSaved = Math.round((totalClips * MINUTES_SAVED_PER_CLIP) / 60);

    function generate() {
        const trimmed = url.trim();
        capture("dashboard_hero_generate_clicked", { hasUrl: Boolean(trimmed) });
        router.push(trimmed ? `/dashboard/new?url=${encodeURIComponent(trimmed)}` : "/dashboard/new");
    }

    return (
        <div className="mx-auto max-w-[1280px] space-y-7 px-1 py-2 md:px-4 md:py-4">
            <OnboardingFlow />

            <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">
                        seu estúdio
                    </p>
                    <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">
                        Bora viralizar hoje?
                    </h1>
                </div>
                {totalClips > 0 && (
                    <div className="flex items-end gap-7 md:gap-9">
                        <HeroStat value={totalClips} label="cortes gerados" />
                        <HeroStat value={avgScore} label="score médio" accent />
                        <HeroStat value={`${hoursSaved}h`} label="de edição economizadas" />
                    </div>
                )}
            </section>

            <section className="rounded-card border border-hairline-subtle bg-surface p-5 shadow-elevated md:p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">
                    cola o link. a ia faz o resto.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") generate();
                        }}
                        aria-label="Link do vídeo"
                        placeholder="https://youtube.com/watch?v=..."
                        className="h-14 flex-1 rounded-input border border-hairline-subtle bg-base px-4 text-sm text-ink-primary outline-none transition placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25"
                    />
                    <button
                        type="button"
                        onClick={generate}
                        className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-input bg-accent px-7 text-sm font-bold text-[#10120A] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    >
                        Gerar cortes
                        <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => router.push("/dashboard/new")}
                    className="mt-3 text-left text-xs text-ink-tertiary transition hover:text-ink-secondary"
                >
                    ou arrasta um vídeo aqui — MP4, MOV até 500MB
                    <span className="mx-2 text-hairline-strong">·</span>
                    vídeo de 1h fica pronto em ~8 min
                </button>
            </section>

            <section className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Buscar vídeo"
                    placeholder="Buscar vídeo..."
                    className="h-11 w-full rounded-pill border border-hairline-subtle bg-surface pl-11 pr-4 text-sm text-ink-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
                />
            </section>

            {isLoading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-72 rounded-card" />
                    ))}
                </div>
            ) : query.trim() && !filteredProjects.length ? (
                <div className="rounded-card border border-hairline-subtle bg-surface p-10 text-center text-sm text-ink-secondary">
                    Nenhum vídeo bate com a busca.
                </div>
            ) : (
                <ProjectGrid projects={filteredProjects} />
            )}
        </div>
    );
}
