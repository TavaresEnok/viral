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
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [completedBanner, setCompletedBanner] = useState(false);
    const completedViewCaptured = useRef(false);
    const processingViewCaptured = useRef(false);
    const sawProcessing = useRef(false);
    const status = pollingQuery.data?.status ?? projectQuery.data?.status;
    const progress =
        pollingQuery.data?.progress ?? projectQuery.data?.progress ?? 0;
    const clipsQuery = useClips(projectId, status === "COMPLETED");

    useEffect(() => {
        if (status === "PROCESSING" || status === "PENDING") {
            sawProcessing.current = true;
        }
        // Quem acompanhou o processamento vê o banner "cortes prontos"
        // em vez de cair direto nos resultados.
        if (status === "COMPLETED" && sawProcessing.current) {
            setCompletedBanner(true);
            sawProcessing.current = false;
        }
    }, [status]);

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
        return <Skeleton className="h-[620px] rounded-card" />;
    }

    const project = projectQuery.data;
    const clips = clipsQuery.data ?? project.clips ?? [];

    async function deleteProject() {
        const confirmed = window.confirm(
            `Apagar o vídeo "${project.title}" e todos os ${clips.length} cortes? Essa ação não pode ser desfeita.`,
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
            toast.success("Vídeo apagado");
            router.replace("/dashboard");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Falha ao apagar vídeo",
            );
        } finally {
            setDeletingProject(false);
        }
    }

    async function exportTimeline(kind: "premiere" | "davinci") {
        setExporting(kind);
        try {
            const response = await authenticatedFetch(
                kind === "premiere"
                    ? api.clips.exportPremiereUrl(projectId)
                    : api.clips.exportDavinciUrl(projectId),
            );
            if (!response.ok) throw new Error("Falha ao exportar");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download =
                kind === "premiere"
                    ? `project-${projectId.slice(0, 8)}-premiere.xml`
                    : `project-${projectId.slice(0, 8)}-davinci.edl`;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Falha ao exportar",
            );
        } finally {
            setExporting(null);
        }
    }

    async function downloadAll() {
        const ready = clips.filter((clip) => clip.status === "COMPLETED");
        if (!ready.length) {
            toast.error("Nenhum corte pronto para baixar");
            return;
        }
        setDownloadingAll(true);
        try {
            for (const clip of ready) {
                const response = await authenticatedFetch(
                    api.clips.downloadUrl(clip.id),
                );
                if (!response.ok) continue;
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${clip.title.replace(/[^\w.-]+/g, "-").toLowerCase()}.mp4`;
                anchor.click();
                URL.revokeObjectURL(url);
            }
            capture("project_all_clips_downloaded", {
                projectId,
                clipCount: ready.length,
            });
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Falha ao baixar",
            );
        } finally {
            setDownloadingAll(false);
        }
    }

    if (status === "FAILED") {
        return (
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/dashboard"
                    className="mb-6 inline-flex items-center gap-2 text-sm text-ink-tertiary transition hover:text-ink-primary"
                >
                    <ArrowLeft className="h-4 w-4" /> Todos os vídeos
                </Link>
                <div className="overflow-hidden rounded-card border border-[rgba(255,79,90,0.35)] bg-[rgba(255,79,90,0.08)]">
                    <div className="border-b border-[rgba(255,79,90,0.2)] p-6 md:p-8">
                        <AlertTriangle
                            className="mb-5 h-10 w-10 text-[#FF8A8A]"
                            strokeWidth={1.6}
                        />
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#FF8A8A]">
                            falha no processamento
                        </p>
                        <h1 className="mt-3 font-display text-heading-md font-bold tracking-tight text-ink-primary">
                            {project.title}
                        </h1>
                        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
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
                            <RotateCcw className="h-4 w-4" strokeWidth={2} />{" "}
                            Tentar de novo
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={deleteProject}
                            loading={deletingProject}
                        >
                            <Trash2 className="h-4 w-4" strokeWidth={1.6} />{" "}
                            Apagar vídeo
                        </Button>
                        <Link href="/dashboard">
                            <Button type="button" variant="secondary">
                                Voltar aos cortes
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "COMPLETED" && !completedBanner) {
        const topClip = clips[0];
        const topScore = topClip
            ? topClip.finalScore || topClip.viralScore
            : null;
        return (
            <div className="mx-auto max-w-[1280px]">
                <Link
                    href="/dashboard"
                    className="mb-5 inline-flex items-center gap-2 text-sm text-ink-tertiary transition hover:text-ink-primary"
                >
                    <ArrowLeft className="h-4 w-4" /> Todos os vídeos
                </Link>
                <section className="mb-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
                    <div className="min-w-0">
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink-tertiary">
                            {project.contentType} ·{" "}
                            {formatDuration(project.durationSeconds)} ·{" "}
                            {timeAgo(project.updatedAt)}
                        </p>
                        <h1 className="mt-3 font-display text-[36px] font-extrabold leading-[1.1] tracking-tight text-ink-primary">
                            {project.title}
                        </h1>
                        <p className="mt-4 max-w-2xl text-body text-ink-secondary">
                            {clips.length}{" "}
                            {clips.length === 1
                                ? "momento encontrado"
                                : "momentos encontrados"}
                            . Baixa, edita ou posta direto.
                        </p>
                    </div>
                    <aside className="flex shrink-0 items-center gap-6 rounded-card border border-hairline-subtle bg-surface p-5">
                        <div>
                            <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                top score
                            </p>
                            <p className="mt-1 font-display text-[44px] font-extrabold leading-none text-[color:var(--accent-text)]">
                                {topScore ?? "—"}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                size="sm"
                                loading={downloadingAll}
                                onClick={downloadAll}
                            >
                                <Download
                                    className="h-4 w-4"
                                    strokeWidth={2}
                                />{" "}
                                Baixar todos
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                loading={exporting === "premiere"}
                                onClick={() => exportTimeline("premiere")}
                            >
                                <FileVideo
                                    className="h-4 w-4"
                                    strokeWidth={1.6}
                                />{" "}
                                Premiere XML
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                loading={exporting === "davinci"}
                                onClick={() => exportTimeline("davinci")}
                            >
                                <FileVideo
                                    className="h-4 w-4"
                                    strokeWidth={1.6}
                                />{" "}
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
            clipCount={clips.length}
            onSeeClips={() => setCompletedBanner(false)}
        />
    );
}
