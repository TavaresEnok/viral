"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Pause,
    Play,
    RefreshCw,
    ScanFace,
    Sparkles,
    Timer,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ClipTimeline } from "@/components/clip/ClipTimeline";
import { ViralityScore } from "@/components/clip/ViralityScore";
import { VideoPlayer } from "@/components/clip/VideoPlayer";
import { Skeleton } from "@/components/common/Skeleton";
import {
    CaptionSample,
    LayoutMiniPreview,
    type CaptionPosition,
    type CaptionSize,
} from "@/components/project/visual-previews";
import { PublishDialog } from "@/components/publish/PublishDialog";
import { Button } from "@/components/ui/Button";
import { useClips } from "@/hooks/useClips";
import { useProject } from "@/hooks/useProject";
import { capture } from "@/lib/analytics";
import { api, authenticatedFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import {
    captionThemeOptions,
    renderLayoutOptions,
} from "@/lib/project-options";

// Layouts que usam detecção de rosto (engine C++/OpenCV) — recebem o selo "AI".
const SMART_LAYOUTS = new Set(["SMART_REFRAME", "SMART_CENTER"]);
import type { CaptionTheme, Clip, RenderLayout } from "@/types/api.types";

type InspectorTab = "captions" | "layout" | "cut" | "transcript";
type Handle = "start" | "end";

const tabs: Array<{ id: InspectorTab; label: string }> = [
    { id: "captions", label: "Estilo" },
    { id: "layout", label: "Layout" },
    { id: "cut", label: "Corte" },
    { id: "transcript", label: "Transcrição" },
];

const captionSizes: CaptionSize[] = ["P", "M", "G"];
const captionPositions: Array<{ id: CaptionPosition; label: string }> = [
    { id: "top", label: "Topo" },
    { id: "center", label: "Centro" },
    { id: "bottom", label: "Base" },
];

function parseTime(value: string) {
    return Number(value.replace(",", "."));
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function scoreOf(clip: Clip) {
    return clip.finalScore || clip.viralScore;
}

function formatTimecode(seconds: number) {
    if (!Number.isFinite(seconds)) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${mins}:${secs}`;
}

export default function ClipEditorPage({
    params: paramsPromise,
}: {
    params: Promise<{ id: string; clipId: string }>;
}) {
    const params = use(paramsPromise);
    const router = useRouter();
    const queryClient = useQueryClient();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const projectQuery = useProject(params.id);
    const clipsQuery = useClips(params.id, true);
    const clips = useMemo(
        () => clipsQuery.data ?? projectQuery.data?.clips ?? [],
        [clipsQuery.data, projectQuery.data?.clips],
    );
    // Sem fallback para clips[0]: se o clipId da URL não existe (ex.: apagado
    // em outra aba), cair no primeiro corte fazia a tela operar num clip
    // diferente do da URL — "Apagar"/"Regenerar" agiam no corte errado.
    // `undefined` renderiza o estado "Não encontrei esse corte".
    const selectedClip = useMemo(
        () => clips.find((clip) => clip.id === params.clipId),
        [clips, params.clipId],
    );
    const projectDefaultRenderLayout =
        projectQuery.data?.renderLayout ?? "BLURRED_BACKGROUND";
    const projectDefaultCaptionTheme =
        projectQuery.data?.captionTheme ?? "CLEAN_FOOTER";
    const selectedIndex = Math.max(
        0,
        clips.findIndex((clip) => clip.id === selectedClip?.id),
    );

    const [tab, setTab] = useState<InspectorTab>("captions");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [clipTitle, setClipTitle] = useState("");
    const [captionText, setCaptionText] = useState("");
    const [currentVideoTime, setCurrentVideoTime] = useState(0);
    const [renderLayout, setRenderLayout] =
        useState<RenderLayout>("BLURRED_BACKGROUND");
    const [captionTheme, setCaptionTheme] =
        useState<CaptionTheme>("CLEAN_FOOTER");
    const [capSize, setCapSize] = useState<CaptionSize>("M");
    const [capPos, setCapPos] = useState<CaptionPosition>("bottom");
    const [autoOverlays, setAutoOverlays] = useState(false);
    const [editedSegments, setEditedSegments] = useState<Array<{ start: number; end: number; text: string }> | null>(null);
    const [savingSegments, setSavingSegments] = useState(false);
    const [activeHandle, setActiveHandle] = useState<Handle>("start");
    const [saving, setSaving] = useState(false);
    const [rendering, setRendering] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);

    const { data: accounts } = useQuery({
        queryKey: ["publish-accounts"],
        queryFn: () =>
            api.publish.accounts() as Promise<
                Array<{
                    id: string;
                    platform: string;
                    platformAccountName: string | null;
                    active: boolean;
                }>
            >,
        enabled: publishOpen,
        staleTime: 60_000,
    });

    const clipId = selectedClip?.id;

    const segmentsQuery = useQuery({
        queryKey: ["clip-segments", clipId],
        queryFn: () => api.clips.getSegments(clipId!),
        enabled: !!clipId && tab === "transcript",
        staleTime: 30_000,
        // Enquanto a IA regera a legenda, acompanha até concluir/falhar.
        refetchInterval: (query) =>
            query.state.data?.status === "PROCESSING" ? 3000 : false,
    });
    const subtitleStatus = segmentsQuery.data?.status ?? null;
    const retranscribing = subtitleStatus === "PROCESSING";

    useEffect(() => {
        if (!clipId || !selectedClip) return;
        setStart(selectedClip.start.toFixed(1));
        setEnd(selectedClip.end.toFixed(1));
        setCurrentVideoTime(0);
        setRenderLayout(
            selectedClip.renderLayout ?? projectDefaultRenderLayout,
        );
        setCaptionTheme(
            selectedClip.captionTheme ?? projectDefaultCaptionTheme,
        );
        setClipTitle(selectedClip.title ?? "");
        setCaptionText(selectedClip.suggestedCaptionTitle ?? selectedClip.hook ?? "");
        setEditedSegments(null);
        setActiveHandle("start");
        capture("editor_full_opened", {
            projectId: params.id,
            clipId: selectedClip.id,
            status: selectedClip.status,
            viralScore: selectedClip.viralScore,
            finalScore: scoreOf(selectedClip),
            dedicated: true,
        });
    }, [
        params.id,
        clipId,
        selectedClip,
        projectDefaultRenderLayout,
        projectDefaultCaptionTheme,
    ]);

    const parsedStart = parseTime(start);
    const parsedEnd = parseTime(end);
    const canSave =
        Number.isFinite(parsedStart) &&
        Number.isFinite(parsedEnd) &&
        parsedEnd > parsedStart;
    const selectedDuration = canSave ? parsedEnd - parsedStart : 0;
    const durationError =
        canSave && (selectedDuration < 5 || selectedDuration > 90);
    const durationWarning =
        canSave &&
        !durationError &&
        (selectedDuration < 20 || selectedDuration > 75);
    const reviewStart = Math.max(
        0,
        (selectedClip?.suggestedStart ?? selectedClip?.start ?? 0) - 10,
    );
    const reviewEnd =
        (selectedClip?.suggestedEnd ?? selectedClip?.end ?? 0) + 10;
    const currentAbsoluteTime = (selectedClip?.start ?? 0) + currentVideoTime;
    const captionBlocks = useMemo(() => {
        if (!selectedClip) return [];
        const text = captionText ||
            (selectedClip.suggestedCaptionTitle ?? selectedClip.hook ?? selectedClip.title);
        return [
            {
                start: canSave ? parsedStart : selectedClip.start,
                end: canSave ? parsedEnd : selectedClip.end,
                text,
            },
        ];
    }, [canSave, captionText, parsedEnd, parsedStart, selectedClip]);

    const seekClip = useCallback(
        (delta: number) => {
            const video = videoRef.current;
            if (!video) return;
            video.currentTime = clamp(
                video.currentTime + delta,
                0,
                video.duration || selectedClip?.duration || 0,
            );
        },
        [selectedClip?.duration],
    );

    const seekAbsolute = useCallback(
        (value: number) => {
            const video = videoRef.current;
            if (!video || !selectedClip) return;
            video.currentTime = clamp(
                value - selectedClip.start,
                0,
                video.duration || selectedClip.duration,
            );
        },
        [selectedClip],
    );

    const setTimelineStart = useCallback(
        (value: number) => {
            setStart(value.toFixed(1));
            seekAbsolute(value);
        },
        [seekAbsolute],
    );

    const setTimelineEnd = useCallback(
        (value: number) => {
            setEnd(value.toFixed(1));
            seekAbsolute(value);
        },
        [seekAbsolute],
    );

    const markStart = useCallback(() => {
        if (!selectedClip) return;
        setStart(currentAbsoluteTime.toFixed(1));
        setActiveHandle("start");
    }, [currentAbsoluteTime, selectedClip]);

    const markEnd = useCallback(() => {
        if (!selectedClip) return;
        setEnd(currentAbsoluteTime.toFixed(1));
        setActiveHandle("end");
    }, [currentAbsoluteTime, selectedClip]);

    const resetToAi = useCallback(() => {
        if (!selectedClip) return;
        const aiStart = selectedClip.suggestedStart ?? selectedClip.start;
        const aiEnd = selectedClip.suggestedEnd ?? selectedClip.end;
        setStart(aiStart.toFixed(1));
        setEnd(aiEnd.toFixed(1));
        seekAbsolute(aiStart);
    }, [seekAbsolute, selectedClip]);

    function selectRelativeClip(delta: number) {
        const next = clips[selectedIndex + delta];
        if (next) router.push(`/dashboard/${params.id}/editor/${next.id}`);
    }

    const saveTiming = useCallback(async () => {
        if (!selectedClip || !canSave || durationError) {
            toast.error("Início e fim inválidos");
            return;
        }

        setSaving(true);
        try {
            await api.clips.updateTiming(selectedClip.id, {
                start: parsedStart,
                end: parsedEnd,
                renderLayout,
                captionTheme,
                title: clipTitle || undefined,
                suggestedCaptionTitle: captionText || undefined,
            });
            capture("clip_timing_adjusted", {
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
                previousStart: selectedClip.start,
                previousEnd: selectedClip.end,
                nextStart: parsedStart,
                nextEnd: parsedEnd,
                renderLayout,
                captionTheme,
                dedicatedEditor: true,
            });
            await queryClient.invalidateQueries({
                queryKey: ["clips", selectedClip.projectId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["project", selectedClip.projectId],
            });
            toast.success("Ajuste salvo");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Falha ao salvar ajuste",
            );
        } finally {
            setSaving(false);
        }
    }, [
        canSave,
        captionText,
        captionTheme,
        clipTitle,
        durationError,
        parsedEnd,
        parsedStart,
        queryClient,
        renderLayout,
        selectedClip,
    ]);

    const renderClip = useCallback(async () => {
        if (!selectedClip || !canSave || durationError) {
            toast.error("Início e fim inválidos");
            return;
        }

        setRendering(true);
        try {
            await api.clips.render(selectedClip.id, {
                start: parsedStart,
                end: parsedEnd,
                renderLayout,
                captionTheme,
                autoOverlays: autoOverlays || undefined,
            });
            capture("clip_rerender_requested", {
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
                renderLayout,
                captionTheme,
                durationSec: Math.round((parsedEnd - parsedStart) * 10) / 10,
                dedicatedEditor: true,
            });
            await queryClient.invalidateQueries({
                queryKey: ["clips", selectedClip.projectId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["project", selectedClip.projectId],
            });
            toast.success("Render enviado para a fila");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Falha ao re-renderizar",
            );
        } finally {
            setRendering(false);
        }
    }, [
        autoOverlays,
        canSave,
        captionTheme,
        durationError,
        parsedEnd,
        parsedStart,
        queryClient,
        renderLayout,
        selectedClip,
    ]);

    const previewClip = useCallback(async () => {
        if (!selectedClip || !canSave || durationError) {
            toast.error("Início e fim inválidos");
            return;
        }

        setPreviewing(true);
        try {
            await api.clips.render(selectedClip.id, {
                start: parsedStart,
                end: parsedEnd,
                renderLayout,
                captionTheme,
                previewSeconds: 5,
                autoOverlays: autoOverlays || undefined,
            });
            capture("clip_preview_requested", {
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
                renderLayout,
                captionTheme,
                dedicatedEditor: true,
            });
            await queryClient.invalidateQueries({
                queryKey: ["clips", selectedClip.projectId],
            });
            toast.success("Preview 5s enviado para a fila");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Falha ao solicitar preview",
            );
        } finally {
            setPreviewing(false);
        }
    }, [
        autoOverlays,
        canSave,
        captionTheme,
        durationError,
        parsedEnd,
        parsedStart,
        queryClient,
        renderLayout,
        selectedClip,
    ]);

    async function deleteClip() {
        if (!selectedClip) return;
        const confirmed = window.confirm(
            `Apagar o corte "${selectedClip.title}"? Essa ação não pode ser desfeita.`,
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            const nextClip =
                clips[selectedIndex + 1] ??
                clips[selectedIndex - 1] ??
                clips.find((clip) => clip.id !== selectedClip.id);
            await api.clips.remove(selectedClip.id);
            capture("clip_deleted", {
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
                status: selectedClip.status,
                viralScore: selectedClip.viralScore,
                finalScore: scoreOf(selectedClip),
                dedicatedEditor: true,
            });
            await queryClient.invalidateQueries({
                queryKey: ["clips", selectedClip.projectId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["project", selectedClip.projectId],
            });
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Corte apagado");
            if (nextClip)
                router.replace(`/dashboard/${params.id}/editor/${nextClip.id}`);
            else router.replace(`/dashboard/${params.id}`);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Falha ao apagar corte",
            );
        } finally {
            setDeleting(false);
        }
    }

    async function downloadClip() {
        if (!selectedClip || selectedClip.status !== "COMPLETED") return;

        setDownloading(true);
        try {
            const response = await authenticatedFetch(
                api.clips.downloadUrl(selectedClip.id),
            );
            if (!response.ok) throw new Error("Falha ao baixar MP4");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${selectedClip.title.replace(/[^\w.-]+/g, "-").toLowerCase()}.mp4`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            capture("clip_downloaded", {
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
                viralScore: selectedClip.viralScore,
                finalScore: scoreOf(selectedClip),
                positionInList: selectedIndex + 1,
                dedicatedEditor: true,
            });
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Falha ao baixar MP4",
            );
        } finally {
            setDownloading(false);
        }
    }

    const onKeyDownRef = useRef<(event: KeyboardEvent) => void>(() => {});
    onKeyDownRef.current = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (
            target?.tagName === "INPUT" ||
            target?.tagName === "SELECT" ||
            target?.tagName === "TEXTAREA"
        )
            return;
        if (!selectedClip) return;

        const key = event.key.toLowerCase();
        if (event.code === "Space" || key === "k") {
            event.preventDefault();
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void video.play();
            else video.pause();
            capture("editor_shortcut_used", {
                shortcut: key === "k" ? "k" : "space",
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if (key === "j") {
            event.preventDefault();
            seekClip(-2);
            capture("editor_shortcut_used", {
                shortcut: "j",
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if (key === "l") {
            event.preventDefault();
            seekClip(2);
            capture("editor_shortcut_used", {
                shortcut: "l",
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if (key === "i" || event.key === "[") {
            event.preventDefault();
            markStart();
            capture("editor_shortcut_used", {
                shortcut: key,
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if (key === "o" || event.key === "]") {
            event.preventDefault();
            markEnd();
            capture("editor_shortcut_used", {
                shortcut: key,
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if (key === "r") {
            event.preventDefault();
            resetToAi();
            capture("editor_shortcut_used", {
                shortcut: "r",
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const delta =
                (event.key === "ArrowRight" ? 1 : -1) *
                (event.shiftKey ? 5 : 0.5);
            if (activeHandle === "start")
                setTimelineStart(
                    Math.min(
                        parsedEnd - 1,
                        Math.max(reviewStart, parsedStart + delta),
                    ),
                );
            else
                setTimelineEnd(
                    Math.max(
                        parsedStart + 1,
                        Math.min(reviewEnd, parsedEnd + delta),
                    ),
                );
            capture("editor_shortcut_used", {
                shortcut: event.shiftKey ? `shift+${event.key}` : event.key,
                clipId: selectedClip.id,
                projectId: selectedClip.projectId,
            });
            return;
        }
        if ((event.metaKey || event.ctrlKey) && key === "s") {
            event.preventDefault();
            void saveTiming();
        }
        if ((event.metaKey || event.ctrlKey) && key === "enter") {
            event.preventDefault();
            void renderClip();
        }
    };

    useEffect(() => {
        const handler = (event: KeyboardEvent) => onKeyDownRef.current(event);
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    if (projectQuery.isLoading || clipsQuery.isLoading) {
        return <Skeleton className="h-[620px] rounded-card" />;
    }

    if (!projectQuery.data || !selectedClip) {
        return (
            <div className="rounded-card border border-hairline-subtle bg-surface p-8">
                <p className="text-sm text-ink-secondary">
                    Não encontrei esse corte.
                </p>
                <Link
                    href={`/dashboard/${params.id}`}
                    className="mt-4 inline-flex text-sm font-semibold text-[color:var(--accent-text)]"
                >
                    Voltar aos cortes
                </Link>
            </div>
        );
    }

    const score = scoreOf(selectedClip);

    return (
        <div className="mx-auto max-w-[1280px]">
            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <Link
                    href={`/dashboard/${params.id}`}
                    className="inline-flex items-center gap-2 text-sm text-ink-tertiary transition hover:text-ink-primary"
                >
                    <ArrowLeft className="h-4 w-4" /> Cortes
                </Link>
                <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-tight text-ink-primary">
                    {selectedClip.title}
                </h1>
                <span
                    className={cn(
                        "rounded-pill border border-hairline-subtle px-2.5 py-1 font-mono text-xs font-bold",
                        score >= 90
                            ? "text-[color:var(--accent-text)]"
                            : "text-ink-secondary",
                    )}
                >
                    ▲ {score}
                </span>
                {selectedClip.status === "RENDERING" && (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-elevated px-2.5 py-1 text-micro font-semibold lowercase text-ink-secondary">
                        <Loader2 className="h-3 w-3 animate-spin" />{" "}
                        renderizando
                    </span>
                )}
                {selectedClip.status === "FAILED" && (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-elevated px-2.5 py-1 text-micro font-semibold lowercase text-[#FF8A8A]">
                        <AlertTriangle className="h-3 w-3" /> falhou
                    </span>
                )}
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={selectedClip.status !== "COMPLETED"}
                        onClick={() => setPublishOpen(true)}
                    >
                        Postar agora
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={downloadClip}
                        loading={downloading}
                        disabled={selectedClip.status !== "COMPLETED"}
                    >
                        Baixar MP4
                    </Button>
                </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[330px_minmax(0,1fr)]">
                {/* Celular 9:16 */}
                <aside>
                    <div className="relative mx-auto w-[300px] overflow-hidden rounded-[24px] border border-hairline-strong bg-black">
                        {selectedClip.status === "COMPLETED" ? (
                            <VideoPlayer
                                ref={videoRef}
                                src={`${api.clips.downloadUrl(selectedClip.id)}?v=${encodeURIComponent(String(selectedClip.updatedAt ?? selectedClip.status))}`}
                                poster={
                                    selectedClip.thumbnailPath
                                        ? api.clips.thumbnailUrl(
                                              selectedClip.id,
                                          )
                                        : undefined
                                }
                                onTimeUpdate={setCurrentVideoTime}
                                onPlay={() => {
                                    setIsPlaying(true);
                                    capture("clip_played", {
                                        clipId: selectedClip.id,
                                        projectId: selectedClip.projectId,
                                        viralScore: selectedClip.viralScore,
                                        finalScore: score,
                                        positionInList: selectedIndex + 1,
                                        dedicatedEditor: true,
                                    });
                                }}
                                onPause={() => setIsPlaying(false)}
                            />
                        ) : (
                            <div className="relative grid aspect-[9/16] place-items-center bg-[#101016] px-8 text-center">
                                <div
                                    className="absolute inset-0 bg-thumb-stripe"
                                    aria-hidden="true"
                                />
                                <div className="relative">
                                    {selectedClip.status === "RENDERING" ? (
                                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[color:var(--accent-text)]" />
                                    ) : (
                                        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#FF8A8A]" />
                                    )}
                                    <p className="text-sm text-ink-secondary">
                                        {selectedClip.status === "FAILED"
                                            ? (selectedClip.errorMessage ??
                                              "Render falhou")
                                            : "Renderizando este corte"}
                                    </p>
                                </div>
                            </div>
                        )}
                        {/* Preview ao vivo da legenda enquanto edita o estilo */}
                        {tab === "captions" && !isPlaying && (
                            <div
                                className={cn(
                                    "pointer-events-none absolute inset-x-3 z-10 text-center text-[16px]",
                                    capPos === "top"
                                        ? "top-[12%]"
                                        : capPos === "center"
                                          ? "top-1/2 -translate-y-1/2"
                                          : "bottom-[14%]",
                                )}
                            >
                                <CaptionSample
                                    theme={captionTheme}
                                    size={capSize}
                                />
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                            <div
                                className="h-full bg-accent"
                                style={{
                                    width: `${selectedClip.duration ? Math.min(100, (currentVideoTime / selectedClip.duration) * 100) : 0}%`,
                                }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label="Corte anterior"
                            className="h-9 w-9 p-0"
                            onClick={() => selectRelativeClip(-1)}
                            disabled={selectedIndex <= 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                            className="h-9 w-9 p-0"
                            onClick={() => {
                                const video = videoRef.current;
                                if (!video) return;
                                if (video.paused) void video.play();
                                else video.pause();
                            }}
                        >
                            {isPlaying ? (
                                <Pause className="h-4 w-4" />
                            ) : (
                                <Play className="ml-0.5 h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label="Próximo corte"
                            className="h-9 w-9 p-0"
                            onClick={() => selectRelativeClip(1)}
                            disabled={selectedIndex >= clips.length - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <span className="ml-2 font-mono text-xs text-ink-secondary">
                            {formatDuration(currentAbsoluteTime)} ·{" "}
                            {selectedIndex + 1}/{clips.length}
                        </span>
                    </div>
                </aside>

                {/* Controles em tabs pill */}
                <section className="min-w-0">
                    <div className="inline-flex rounded-pill border border-hairline-subtle bg-surface p-1">
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                className={cn(
                                    "rounded-pill px-5 py-2 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                    tab === item.id
                                        ? "bg-accent font-bold text-[#10120A]"
                                        : "text-ink-secondary hover:text-ink-primary",
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {tab === "captions" && (
                        <div className="mt-6 space-y-7">
                            <div>
                                <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                    estilo
                                </p>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {captionThemeOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() =>
                                                setCaptionTheme(option.value)
                                            }
                                            className={cn(
                                                "rounded-input border-[1.5px] p-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                                captionTheme === option.value
                                                    ? "border-accent bg-[color:var(--accent-glow)]"
                                                    : "border-hairline-subtle bg-surface hover:border-hairline-strong",
                                            )}
                                        >
                                            <div className="relative mb-2 grid h-16 place-items-center overflow-hidden rounded-[8px] bg-[#101016] px-2 text-center text-[11px]">
                                                <div
                                                    className="absolute inset-0 bg-thumb-stripe"
                                                    aria-hidden="true"
                                                />
                                                <CaptionSample
                                                    theme={option.value}
                                                    className="relative"
                                                />
                                            </div>
                                            <p className="text-xs font-semibold text-ink-primary">
                                                {option.label}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-10">
                                <div>
                                    <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                        tamanho
                                    </p>
                                    <div className="flex gap-2">
                                        {captionSizes.map((size) => (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => setCapSize(size)}
                                                className={cn(
                                                    "h-10 w-12 rounded-pill border text-sm font-bold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                                    capSize === size
                                                        ? "border-accent bg-accent text-[#10120A]"
                                                        : "border-hairline-strong text-ink-secondary hover:text-ink-primary",
                                                )}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                        posição
                                    </p>
                                    <div className="flex gap-2">
                                        {captionPositions.map((position) => (
                                            <button
                                                key={position.id}
                                                type="button"
                                                onClick={() =>
                                                    setCapPos(position.id)
                                                }
                                                className={cn(
                                                    "h-10 rounded-pill border px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                                    capPos === position.id
                                                        ? "border-accent bg-accent font-bold text-[#10120A]"
                                                        : "border-hairline-strong text-ink-secondary hover:text-ink-primary",
                                                )}
                                            >
                                                {position.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-input border border-hairline-subtle bg-surface p-3">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={autoOverlays}
                                    onClick={() => setAutoOverlays((v) => !v)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                        autoOverlays ? "bg-accent" : "bg-hairline-strong",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
                                            autoOverlays ? "translate-x-4" : "translate-x-0",
                                        )}
                                    />
                                </button>
                                <div>
                                    <p className="text-sm font-semibold text-ink-primary">
                                        Emojis e SFX automáticos
                                    </p>
                                    <p className="text-xs text-ink-tertiary">
                                        Detecta palavras-chave e adiciona overlays (Remotion)
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-ink-tertiary">
                                O estilo escolhido vale pro próximo render.
                                Tamanho e posição são aplicados na queima da
                                legenda.
                            </p>
                        </div>
                    )}

                    {tab === "layout" && (
                        <div className="mt-6">
                            <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                layout do vídeo
                            </p>
                            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                                {renderLayoutOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        disabled={option.comingSoon}
                                        onClick={() =>
                                            !option.comingSoon &&
                                            setRenderLayout(option.value)
                                        }
                                        title={option.description}
                                        className={cn(
                                            "relative rounded-input border-[1.5px] p-2 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                            renderLayout === option.value
                                                ? "border-accent bg-[color:var(--accent-glow)]"
                                                : "border-hairline-subtle bg-surface hover:border-hairline-strong",
                                            option.comingSoon &&
                                                "cursor-not-allowed opacity-45",
                                        )}
                                    >
                                        <LayoutMiniPreview
                                            layout={option.value}
                                        />
                                        <p className="mt-2 text-center text-[11px] font-semibold leading-tight text-ink-primary">
                                            {option.label}
                                        </p>
                                        {SMART_LAYOUTS.has(option.value) && (
                                            <span
                                                className="absolute left-1.5 top-1.5 rounded-pill bg-black/70 px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-[color:var(--accent-text)]"
                                                title="Usa detecção de rosto automática"
                                            >
                                                <ScanFace className="inline h-2.5 w-2.5" /> AI
                                            </span>
                                        )}
                                        {option.comingSoon && (
                                            <span className="absolute right-1.5 top-1.5 rounded-pill bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[#FFC24B]">
                                                em breve
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={previewClip}
                                    loading={previewing}
                                    disabled={
                                        !canSave ||
                                        durationError ||
                                        selectedClip.status === "RENDERING" ||
                                        rendering
                                    }
                                    title="Renderiza 5s com o layout selecionado para testar antes do render completo"
                                >
                                    <Timer className="h-3.5 w-3.5" /> Testar layout 5s
                                </Button>
                                <p className="text-xs leading-relaxed text-ink-tertiary">
                                    Salvar grava o layout; o render usa
                                    esse layout no worker.{" "}
                                    {SMART_LAYOUTS.has(renderLayout) && (
                                        <span className="text-[color:var(--accent-text)]">
                                            Detecção de rosto ativa.
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {tab === "cut" && (
                        <div className="mt-6 space-y-6">
                            <div className="grid grid-cols-3 gap-3">
                                <label className="block rounded-input border border-hairline-subtle bg-surface p-4">
                                    <span className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                        entrada
                                    </span>
                                    <input
                                        value={start}
                                        onChange={(event) =>
                                            setStart(event.target.value)
                                        }
                                        className="mt-2 w-full bg-transparent font-mono text-lg font-bold text-ink-primary outline-none"
                                        aria-label="Tempo de entrada (segundos)"
                                    />
                                </label>
                                <label className="block rounded-input border border-hairline-subtle bg-surface p-4">
                                    <span className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                        saída
                                    </span>
                                    <input
                                        value={end}
                                        onChange={(event) =>
                                            setEnd(event.target.value)
                                        }
                                        className="mt-2 w-full bg-transparent font-mono text-lg font-bold text-ink-primary outline-none"
                                        aria-label="Tempo de saída (segundos)"
                                    />
                                </label>
                                <div
                                    className={cn(
                                        "rounded-input border-[1.5px] p-4",
                                        durationError
                                            ? "border-danger"
                                            : "border-accent shadow-glow",
                                    )}
                                >
                                    <span className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                        duração
                                    </span>
                                    <p
                                        className={cn(
                                            "mt-2 font-mono text-lg font-bold",
                                            durationError
                                                ? "text-[#FF8A8A]"
                                                : durationWarning
                                                  ? "text-[#FFC24B]"
                                                  : "text-[color:var(--accent-text)]",
                                        )}
                                    >
                                        {canSave
                                            ? formatTimecode(selectedDuration)
                                            : "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={markStart}
                                >
                                    Marcar entrada
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={markEnd}
                                >
                                    Marcar saída
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetToAi}
                                >
                                    Voltar pro corte da IA
                                </Button>
                            </div>

                            <ViralityScore clip={selectedClip} />

                            <div className="flex flex-wrap items-center gap-3 border-t border-hairline-subtle pt-5">
                                <Button
                                    type="button"
                                    onClick={renderClip}
                                    loading={rendering}
                                    disabled={
                                        !canSave ||
                                        durationError ||
                                        selectedClip.status === "RENDERING" ||
                                        previewing
                                    }
                                    className="shadow-glow"
                                >
                                    ✦ Regenerar corte
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={previewClip}
                                    loading={previewing}
                                    disabled={
                                        !canSave ||
                                        durationError ||
                                        selectedClip.status === "RENDERING" ||
                                        rendering
                                    }
                                    title="Renderiza apenas os primeiros 5s para testar tema e layout"
                                >
                                    <Timer className="h-3.5 w-3.5" /> Preview 5s
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={saveTiming}
                                    loading={saving}
                                    disabled={!canSave || durationError}
                                >
                                    Salvar ajuste
                                </Button>
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={deleteClip}
                                    loading={deleting}
                                >
                                    <Trash2
                                        className="h-4 w-4"
                                        strokeWidth={1.6}
                                    />{" "}
                                    Apagar
                                </Button>
                            </div>
                        </div>
                    )}

                    {tab === "transcript" && (
                        <div className="mt-6">
                            {segmentsQuery.data?.source === "youtube_captions" && !retranscribing && (
                                <div className="mb-4 rounded-card border border-hairline-subtle bg-surface-subtle p-3">
                                    <p className="text-sm text-ink-secondary">
                                        Esta legenda veio da <strong>legenda automática do YouTube</strong>, que erra
                                        palavras e não tem pontuação. Use <strong>Regerar com IA</strong> para
                                        transcrever o áudio deste corte com o Whisper.
                                    </p>
                                </div>
                            )}
                            {subtitleStatus === "FAILED" && segmentsQuery.data?.error && (
                                <div className="mb-4 rounded-card border border-hairline-subtle bg-surface-subtle p-3">
                                    <p className="text-sm text-ink-secondary">
                                        Não foi possível regerar a legenda: {segmentsQuery.data.error}
                                    </p>
                                </div>
                            )}
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                                    segmentos da legenda
                                    {segmentsQuery.data?.source === "whisper_local" && (
                                        <span className="ml-2 normal-case tracking-normal text-ink-tertiary">
                                            · gerada por IA
                                        </span>
                                    )}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        loading={retranscribing}
                                        disabled={retranscribing}
                                        title="Transcreve o áudio deste corte com IA (Whisper). Não renderiza — você revisa o texto antes."
                                        onClick={async () => {
                                            try {
                                                await api.clips.retranscribe(selectedClip.id);
                                                setEditedSegments(null);
                                                await queryClient.invalidateQueries({ queryKey: ["clip-segments", clipId] });
                                                toast.success("Regerando legenda com IA — isso leva alguns segundos.");
                                            } catch (error) {
                                                toast.error(
                                                    error instanceof Error ? error.message : "Falha ao regerar legenda",
                                                );
                                            }
                                        }}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {retranscribing ? "Transcrevendo…" : "Regerar com IA"}
                                    </Button>
                                    {segmentsQuery.data?.custom && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    await api.clips.resetSegments(selectedClip.id);
                                                    setEditedSegments(null);
                                                    await queryClient.invalidateQueries({ queryKey: ["clip-segments", clipId] });
                                                    toast.success("Transcrição original restaurada");
                                                } catch {
                                                    toast.error("Falha ao restaurar");
                                                }
                                            }}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> Restaurar original
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        loading={savingSegments}
                                        disabled={!editedSegments}
                                        onClick={async () => {
                                            if (!editedSegments) return;
                                            setSavingSegments(true);
                                            try {
                                                await api.clips.updateSegments(selectedClip.id, editedSegments);
                                                await queryClient.invalidateQueries({ queryKey: ["clip-segments", clipId] });
                                                setEditedSegments(null);
                                                toast.success("Transcrição salva");
                                            } catch {
                                                toast.error("Falha ao salvar transcrição");
                                            } finally {
                                                setSavingSegments(false);
                                            }
                                        }}
                                    >
                                        Salvar transcrição
                                    </Button>
                                </div>
                            </div>

                            {segmentsQuery.isLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" />
                                </div>
                            ) : segmentsQuery.data?.segments.length === 0 ? (
                                <p className="py-6 text-sm text-ink-tertiary">
                                    Nenhum segmento encontrado neste trecho.
                                </p>
                            ) : (
                                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                                    {(editedSegments ?? segmentsQuery.data?.segments ?? []).map((seg, i) => (
                                        <div
                                            key={i}
                                            className="flex gap-3 rounded-input border border-hairline-subtle bg-surface p-3"
                                        >
                                            <span className="mt-0.5 flex-shrink-0 font-mono text-[10px] text-ink-tertiary">
                                                {formatTimecode(seg.start)}
                                            </span>
                                            <textarea
                                                value={seg.text}
                                                rows={1}
                                                onChange={(e) => {
                                                    const base = editedSegments ?? segmentsQuery.data?.segments ?? [];
                                                    const next = base.map((s, j) =>
                                                        j === i ? { ...s, text: e.target.value } : s,
                                                    );
                                                    setEditedSegments(next);
                                                }}
                                                className="min-h-0 w-full resize-none bg-transparent text-sm text-ink-primary outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {segmentsQuery.data?.custom && !editedSegments && (
                                <p className="mt-2 text-xs text-[color:var(--accent-text)]">
                                    Usando transcrição editada. O próximo render usará esses textos.
                                </p>
                            )}
                            {!segmentsQuery.data?.custom && !editedSegments && (
                                <p className="mt-2 text-xs text-ink-tertiary">
                                    Edite os textos acima e clique em Salvar. O próximo render usará a nova transcrição.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* Timeline do vídeo original */}
            <div className="mt-10 rounded-card border border-hairline-subtle bg-surface p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                        timeline do vídeo original
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span
                            className={cn(
                                "font-mono font-bold",
                                durationError
                                    ? "text-[#FF8A8A]"
                                    : durationWarning
                                      ? "text-[#FFC24B]"
                                      : "text-[color:var(--accent-text)]",
                            )}
                        >
                            {canSave
                                ? formatDuration(selectedDuration)
                                : "duração inválida"}
                        </span>
                        <span className="text-ink-tertiary">
                            janela {formatDuration(reviewStart)} –{" "}
                            {formatDuration(reviewEnd)}
                        </span>
                        <span className="hidden font-mono text-[10px] text-ink-tertiary xl:inline">
                            I/O marca · ←/→ ajusta · espaço play · ⌘S salva ·
                            ⌘↵ renderiza
                        </span>
                    </div>
                </div>
                <ClipTimeline
                    reviewStart={reviewStart}
                    reviewEnd={reviewEnd}
                    start={canSave ? parsedStart : selectedClip.start}
                    end={canSave ? parsedEnd : selectedClip.end}
                    currentTime={currentAbsoluteTime}
                    captionBlocks={captionBlocks}
                    activeHandle={activeHandle}
                    onActiveHandleChange={setActiveHandle}
                    onStartChange={setTimelineStart}
                    onEndChange={setTimelineEnd}
                    onSeek={seekAbsolute}
                />
            </div>

            {/* Metadados e edição do hook */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-card border border-hairline-subtle bg-surface p-5">
                    <label className="block">
                        <span className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                            título do corte
                        </span>
                        <input
                            value={clipTitle}
                            onChange={(e) => setClipTitle(e.target.value)}
                            placeholder={selectedClip.title}
                            className="mt-2 w-full bg-transparent text-sm font-semibold text-ink-primary outline-none placeholder:text-ink-tertiary"
                            maxLength={200}
                        />
                    </label>
                </div>
                <div className="rounded-card border border-hairline-subtle bg-surface p-5">
                    <label className="block">
                        <span className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                            hook / legenda queimada
                        </span>
                        <textarea
                            value={captionText}
                            onChange={(e) => setCaptionText(e.target.value)}
                            placeholder={selectedClip.hook ?? "Texto que aparece como legenda..."}
                            rows={2}
                            className="mt-2 w-full resize-none bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-tertiary"
                            maxLength={300}
                        />
                    </label>
                </div>
            </div>
            {selectedClip.actualTextInClip && (
                <div className="mt-3 rounded-card border border-hairline-subtle bg-surface p-5">
                    <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                        transcrição do trecho
                    </p>
                    <p className="max-h-48 select-all overflow-y-auto text-sm leading-relaxed text-ink-secondary">
                        {selectedClip.actualTextInClip}
                    </p>
                </div>
            )}

            {publishOpen && accounts && (
                <PublishDialog
                    clip={selectedClip}
                    accounts={accounts}
                    onClose={() => setPublishOpen(false)}
                    onPublished={() => {
                        queryClient.invalidateQueries({
                            queryKey: ["published-clips"],
                        });
                    }}
                />
            )}
        </div>
    );
}
