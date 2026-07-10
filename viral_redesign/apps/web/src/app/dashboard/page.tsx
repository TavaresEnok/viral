"use client";

import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/project/EmptyState";
import { NewProjectModal } from "@/components/project/NewProjectModal";
import { ProjectGrid } from "@/components/project/ProjectGrid";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { capture } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { useProjects } from "@/hooks/useProjects";

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: projects = [], isLoading } = useProjects();
    const [newProjectOpen, setNewProjectOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [view, setView] = useState<"grid" | "list">("grid");

    useEffect(() => {
        if (searchParams?.get("new") === "1") {
            setNewProjectOpen(true);
            router.replace("/dashboard");
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

    return (
        <div className="mx-auto max-w-[1400px] space-y-8 px-1 py-2 md:px-4 md:py-6">
            <OnboardingFlow />
            <section>
                <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">
                            Estúdio
                        </p>
                        <h1 className="mt-3 text-4xl font-semibold text-ink-primary md:text-5xl">
                            Projetos
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            onClick={() => {
                                capture("dashboard_new_project_clicked", {
                                    placement: "dashboard_hero",
                                });
                                setNewProjectOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4" /> Novo projeto
                        </Button>
                    </div>
                </div>
                <p className="mt-4 text-sm text-ink-tertiary">
                    {filteredProjects.length} fontes · {totalClips} momentos
                    pontuados este mês
                </p>
            </section>

            <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        aria-label="Filtrar projetos"
                        placeholder="Filtrar por título, idioma ou estilo"
                        className="h-11 w-full rounded-lg border border-hairline-subtle bg-surface pl-10 pr-3 text-sm text-ink-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-hairline-subtle bg-surface p-1">
                        <button
                            type="button"
                            onClick={() => setView("grid")}
                            aria-label="Visualização em grade"
                            className={cn(
                                "grid h-8 w-8 place-items-center rounded-md text-ink-tertiary transition",
                                view === "grid" &&
                                    "bg-overlay text-ink-primary",
                            )}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("list")}
                            aria-label="Visualização em lista"
                            className={cn(
                                "grid h-8 w-8 place-items-center rounded-md text-ink-tertiary transition",
                                view === "list" &&
                                    "bg-overlay text-ink-primary",
                            )}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                    <span className="text-xs text-ink-tertiary">
                        {filteredProjects.length} exibidos
                    </span>
                </div>
            </section>

            {isLoading ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-72 rounded-xl" />
                    ))}
                </div>
            ) : filteredProjects.length ? (
                <ProjectGrid projects={filteredProjects} view={view} />
            ) : projects.length ? (
                <div className="rounded-xl border border-hairline-subtle bg-surface p-10 text-center text-sm text-ink-secondary">
                    Nenhum projeto bate com o filtro atual.
                </div>
            ) : (
                <EmptyState />
            )}
            <NewProjectModal
                open={newProjectOpen}
                onClose={() => setNewProjectOpen(false)}
            />
        </div>
    );
}
