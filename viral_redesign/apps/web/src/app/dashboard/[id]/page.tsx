"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    ArrowLeft,
    Download,
    FileVideo,
    RotateCcw,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipGrid } from "@/components/clip/ClipGrid";
import { Skeleton } from "@/components/common/Skeleton";
import { ProcessingExperience } from "@/components/processing/ProcessingExperience";
import { StatusBadge } from "@/components/project/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useClips } from "@/hooks/useClips";
import { useProject } from "@/hooks/useProject";
import { useProjectPolling } from "@/hooks/useProjectPolling";
import { capture } from "@/lib/analytics";
import { api, authenticatedFetch } from "@/lib/api";
import { formatDuration, timeAgo } from "@/lib/format";

export default function ProjectDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const projectId = params?.id ?? "";
    const queryClient = useQueryClient();
    const projectQuery = useProject(projectId);
    const pollingQuery = useProjectPolling(projectId);
    const [deletingProject, setDeletingProject] = useState(false);
    const [exporting, setExporting] = useState<string | null>(null);
    const completedViewCaptured = useRef(false);
    const processingViewCaptured = useRef(false);
    const status = pollingQuery.data?.status ?? projectQuery.data?.status;
    const progress =
        pollingQuery.data?.progress ?? projectQuery.data?.progress ?? 0;
    const clipsQuery = useClips(projectId, status === "COMPLETED");

    useEffect(() => {
        if (
            pollingQuery.data?.status === "COMPLETED" ||
            pollingQuery.data?.status === "FAILED"
        ) {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId],
            });
            void queryClient.invalidateQueries({
                queryKey: ["clips", projectId],
            });
        }
    }, [projectId, pollingQuery.data?.status, queryClient]);

    useEffect(() => {
        if (
            (status === "PROCESSING" || status === "PENDING") &&
            !processingViewCaptured.current
        ) {
            processingViewCaptured.current = true;
            capture("project_processing_viewed", {
                projectId,
                status,
                progress,
            });
        }
    }, [projectId, progress, status]);

    useEffect(() => {
        if (
            pollingQuery.data?.status === "COMPLETED" &&
            !completedViewCaptured.current
        ) {
            completedViewCaptured.current = true;
            capture("project_completed_view", {
                projectId,
                totalClipsGenerated:
                    projectQuery.data?._count?.clips ??
                    projectQuery.data?.clips?.length ??
                    null,
                progress: pollingQuery.data.progress,
            });
        }
    }, [
        projectId,
        pollingQuery.data?.progress,
        pollingQuery.data?.status,
        projectQuery.data?._count?.clips,
        projectQuery.data?.clips?.length,
    ]);

    if (projectQuery.isLoading || !projectQuery.data) {
        return <Skeleton className="h-[620px] rounded-2xl" />;
    }

    const project = projectQuery.data;
    const clips = clipsQuery.data ?? project.clips ?? [];

    async function deleteProject() {
        const confirmed = window.confirm(
            `Apagar o projeto "${project.title}" e todos os ${clips.length} cortes? Essa ação não pode ser desfeita.`,
        );
        if (!confirmed) return;

        setDeletingProject(true);
        try {
            await api.projects.remove(project.id);
            capture("project_deleted", {
                projectId: project.id,
                status: project.status,
                clipCount: clips.length,
                from: "project_detail",
            });
            queryClient.removeQueries({ queryKey: ["project", project.id] });
            queryClient.removeQueries({ queryKey: ["clips", project.id] });
            queryClient.setQueryData<import("@/types/api.types").Project[]>(
                ["projects"],
                (current) =>
                    current?.filter((item) => item.id !== project.id) ??
                    current,
            );
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Projeto apagado");
            router.replace("/dashboard");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Falha ao apagar projeto",
            );
        } finally {
            setDeletingProject(false);
        }
    }

    if (status === "FAILED") {
        return (
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/dashboard"
                    className="mb-6 inline-flex items-center gap-2 text-sm text-ink-tertiary transition hover:text-ink-primary"
                >
                    <ArrowLeft className="h-4 w-4" /> Projetos
                </Link>
                <div className="overflow-hidden rounded-2xl border border-danger/30 bg-danger/10 shadow-elevated">
                    <div className="border-b border-danger/20 p-6 md:p-8">
                        <AlertTriangle className="mb-5 h-10 w-10 text-red-300" />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
                            Falha no processamento
                        </p>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-primary">
                            {project.title}
                        </h1>
                        <p className="mt-4 text-sm leading-relaxed text-red-100">
                            {pollingQuery.data?.errorMessage ??
                                project.errorMessage}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 p-6">
                        <Button
                            type="button"
                            onClick={async () => {
                                try {
                                    await api.projects.retry(projectId);
                                    await queryClient.invalidateQueries({
                                        queryKey: ["project", projectId],
                                    });
                                    await queryClient.invalidateQueries({
                                        queryKey: ["job", projectId],
                                    });
                                } catch (error) {
                                    toast.error(
                                        error instanceof Error
                                            ? error.message
                                            : "Falha ao reprocessar",
                                    );
                                }
                            }}
                        >
                            <RotateCcw className="h-4 w-4" /> Tentar novamente
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={deleteProject}
                            loading={deletingProject}
                        >
                            <Trash2 className="h-4 w-4" /> Apagar projeto
                        </Button>
                        <Link href="/dashboard">
                            <Button type="button" variant="secondary">
                                Voltar aos projetos
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "COMPLETED") {
        const topClip = clips[0];
        const topScore = topClip
            ? topClip.finalScore || topClip.viralScore
            : "-";
        return (
            <div className="mx-auto max-w-[1400px] space-y-0">
                <Link
                    href="/dashboard"
                    className="mb-6 inline-flex items-center gap-2 text-caption text-ink-tertiary transition hover:text-ink-secondary"
                >
                    <ArrowLeft className="h-4 w-4" /> Todos os projetos
                </Link>
                <section className="mb-12 grid grid-cols-12 items-start gap-8">
                    <div className="col-span-12 lg:col-span-8">
                        <span className="text-micro uppercase tracking-[0.18em] text-ink-tertiary">
                            {project.contentType} · fonte de{" "}
                            {formatDuration(project.durationSeconds)} ·{" "}
                            {timeAgo(project.updatedAt)}
                        </span>
                        <h1 className="mt-3 text-display-md text-ink-primary">
                            {project.title}
                        </h1>
                        <p className="mt-5 max-w-2xl text-body text-ink-secondary">
                            {clips.length} momentos encontrados. Revise, baixe
                            um corte por vez ou abra o editor para ajustes
                            avançados.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                            <StatusBadge status="COMPLETED" />
                            <span className="rounded-full border border-hairline bg-elevated px-2.5 py-1 text-caption text-ink-secondary">
                                Resultados
                            </span>
                            <span className="rounded-full border border-hairline bg-elevated px-2.5 py-1 text-caption text-ink-secondary">
                                {project.language}
                            </span>
                        </div>
                    </div>
                    <aside className="col-span-12 rounded-lg border border-hairline bg-surface p-6 lg:col-span-4">
                        <div className="text-micro uppercase tracking-[0.12em] text-ink-tertiary">
                            Top momento
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-heading-sm text-ink-primary">
                            {topClip?.title ?? "Sem cortes"}
                        </h3>
                        <div className="mt-5">
                            <div className="flex items-end gap-3">
                                <span className="font-mono-num text-4xl font-semibold leading-none text-accent">
                                    {topScore}
                                </span>
                                <span className="pb-1 text-caption text-ink-tertiary">
                                    Força do Momento
                                </span>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
                                <div
                                    className="h-full rounded-full bg-accent"
                                    style={{
                                        width: `${Math.max(0, Math.min(100, Number(topScore) || 0))}%`,
                                    }}
                                />
                            </div>
                        </div>
                        {topClip && (
                            <Link
                                href={`/dashboard/${projectId}/editor/${topClip.id}`}
                            >
                                <Button
                                    variant="secondary"
                                    className="mt-6 h-8 px-3 text-caption"
                                >
                                    Abrir editor profissional
                                </Button>
                            </Link>
                        )}
                        <div className="mt-3 flex flex-col gap-2">
                            <Button
                                variant="ghost"
                                className="h-8 px-3 text-caption justify-start"
                                loading={exporting === "premiere"}
                                onClick={async () => {
                                    setExporting("premiere");
                                    try {
                                        const response =
                                            await authenticatedFetch(
                                                api.clips.exportPremiereUrl(
                                                    projectId,
                                                ),
                                            );
                                        if (!response.ok)
                                            throw new Error(
                                                "Falha ao exportar",
                                            );
                                        const blob = await response.blob();
                                        const url = URL.createObjectURL(blob);
                                        const anchor =
                                            document.createElement("a");
                                        anchor.href = url;
                                        anchor.download = `project-${projectId.slice(0, 8)}-premiere.xml`;
                                        anchor.click();
                                        URL.revokeObjectURL(url);
                                    } catch (error) {
                                        toast.error(
                                            error instanceof Error
                                                ? error.message
                                                : "Falha ao exportar",
                                        );
                                    } finally {
                                        setExporting(null);
                                    }
                                }}
                            >
                                <Download className="h-3.5 w-3.5" /> Exportar
                                Premiere XML
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-8 px-3 text-caption justify-start"
                                loading={exporting === "davinci"}
                                onClick={async () => {
                                    setExporting("davinci");
                                    try {
                                        const response =
                                            await authenticatedFetch(
                                                api.clips.exportDavinciUrl(
                                                    projectId,
                                                ),
                                            );
                                        if (!response.ok)
                                            throw new Error(
                                                "Falha ao exportar",
                                            );
                                        const blob = await response.blob();
                                        const url = URL.createObjectURL(blob);
                                        const anchor =
                                            document.createElement("a");
                                        anchor.href = url;
                                        anchor.download = `project-${projectId.slice(0, 8)}-davinci.edl`;
                                        anchor.click();
                                        URL.revokeObjectURL(url);
                                    } catch (error) {
                                        toast.error(
                                            error instanceof Error
                                                ? error.message
                                                : "Falha ao exportar",
                                        );
                                    } finally {
                                        setExporting(null);
                                    }
                                }}
                            >
                                <FileVideo className="h-3.5 w-3.5" /> Exportar
                                DaVinci EDL
                            </Button>
                        </div>
                    </aside>
                </section>
                <ClipGrid clips={clips} />
            </div>
        );
    }

    return (
        <ProcessingExperience
            project={project}
            status={status}
            progress={progress}
            jobStage={pollingQuery.data?.job?.stage ?? null}
            deletingProject={deletingProject}
            onDelete={deleteProject}
        />
    );
}
