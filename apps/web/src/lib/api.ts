import {
    clearAuth,
    getAuthToken,
    setAuthToken,
    setAuthUser,
} from "@/stores/auth.store";
import type {
    ApiKeyStatus,
    AiProvidersResponse,
    AuthResponse,
    BillingStatus,
    CaptionTheme,
    Clip,
    ClipFeedbackReason,
    ContentType,
    ClipStyle,
    JobStatus,
    Project,
    QualityOverview,
    RenderLayout,
    User,
} from "@/types/api.types";

function resolveBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    // Mesma origem: o Next faz rewrite de /api → API. Apontar para :3001
    // direto quebraria o CSP (connect-src 'self') e exigiria a porta exposta.
    if (typeof window !== "undefined") {
        return "/api";
    }
    return "http://localhost:3001";
}

const BASE_URL = resolveBaseUrl();
const FETCH_TIMEOUT = 15_000;
let refreshPromise: Promise<AuthResponse> | null = null;

function fetchWithTimeout(
    input: string,
    init?: RequestInit,
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timeout),
    );
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly payload: unknown,
        message: string,
    ) {
        super(message);
    }
}

export type QuickCaptionStatus = "DRAFT" | "PENDING" | "RENDERING" | "COMPLETED" | "FAILED";

export interface QuickCaptionItem {
    id: string;
    batchId: string;
    originalFilePath: string | null;
    captionText: string;
    durationSeconds: number | null;
    status: QuickCaptionStatus;
    videoPath: string | null;
    thumbnailPath: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface QuickCaptionBatch {
    id: string;
    userId: string;
    name: string;
    renderLayout: RenderLayout;
    captionTheme: CaptionTheme;
    createdAt: string;
    updatedAt: string;
    items?: QuickCaptionItem[];
    _count?: { items: number };
}

export type SocialChannelPlatform = "TIKTOK" | "INSTAGRAM" | "KWAI";
export type ChannelImportStatus = "PENDING" | "LISTING" | "READY" | "FAILED";

export interface ChannelImportVideo {
    url: string;
    title: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
}

export interface ChannelImportRequest {
    id: string;
    userId: string;
    platform: SocialChannelPlatform;
    channelUrl: string;
    status: ChannelImportStatus;
    errorMessage: string | null;
    videosJson: ChannelImportVideo[] | null;
    hasMore: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PublishedClip {
    id: string;
    status: string;
    platform: string;
    platformPostUrl: string | null;
    platformPostId: string | null;
    errorMessage: string | null;
    scheduledAt: string | null;
    publishedAt: string | null;
    createdAt: string;
    clip: {
        id: string;
        projectId: string;
        title: string;
        duration: number;
        thumbnailPath: string | null;
    };
    socialAccount: {
        id: string;
        platform: string;
        platformAccountName: string | null;
    };
}

async function refreshSession(): Promise<AuthResponse> {
    if (!refreshPromise) {
        refreshPromise = fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            cache: "no-store",
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new ApiError(
                        response.status,
                        null,
                        "Sessão expirada",
                    );
                }
                return response.json() as Promise<AuthResponse>;
            })
            .then((auth) => {
                setAuthToken(auth.token);
                setAuthUser(auth.user);
                return auth;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

export async function ensureSession(): Promise<boolean> {
    if (getAuthToken()) return true;
    try {
        await refreshSession();
        return true;
    } catch {
        clearAuth();
        return false;
    }
}

export async function authenticatedFetch(
    input: string,
    init?: RequestInit,
    retry = true,
): Promise<Response> {
    const token = getAuthToken();
    const headers = new Headers(init?.headers);
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetchWithTimeout(input, {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
    });
    if (response.status === 401 && retry) {
        await refreshSession();
        return authenticatedFetch(input, init, false);
    }
    return response;
}

async function request<T>(
    path: string,
    init?: RequestInit,
    retry = true,
): Promise<T> {
    const token = getAuthToken();
    const headers = new Headers(init?.headers);
    if (!(init?.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
        ...init,
        cache: "no-store",
        credentials: "include",
        headers,
    });
    if (response.status === 401) {
        const canRefresh =
            retry &&
            ![
                "/auth/login",
                "/auth/register",
                "/auth/logout",
                "/auth/refresh",
            ].includes(path);
        if (canRefresh) {
            try {
                await refreshSession();
                return request<T>(path, init, false);
            } catch {
                // fall through to logout handling below
            }
        }
        if (!["/auth/login", "/auth/register", "/auth/logout"].includes(path)) {
            clearAuth();
            if (typeof window !== "undefined") window.location.href = "/login";
            throw new ApiError(401, null, "Não autenticado");
        }
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
            payload && typeof payload === "object" && "message" in payload
                ? String((payload as { message: unknown }).message)
                : "Erro na requisição";
        throw new ApiError(response.status, payload, message);
    }

    if (response.status === 204) {
        return undefined as T;
    }
    return response.json() as Promise<T>;
}

export function uploadFile<T = Project>(
    path: string,
    file: File,
    onProgress: (progress: number) => void,
): Promise<T> {
    const token = getAuthToken();
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const form = new FormData();
        form.append("file", file);

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText) as T);
            } else {
                reject(new Error(xhr.responseText || "Falha no upload"));
            }
        });
        xhr.addEventListener("error", () => reject(new Error("Erro de rede")));
        xhr.open("POST", `${BASE_URL}${path}`);
        xhr.withCredentials = true;
        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(form);
    });
}

export const api = {
    auth: {
        login: (data: { email: string; password: string }) =>
            request<AuthResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        register: (data: { name: string; email: string; password: string }) =>
            request<AuthResponse>("/auth/register", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        refresh: () => refreshSession(),
        logout: () =>
            request<{ ok: true }>("/auth/logout", { method: "POST" }, false),
        logoutAll: () =>
            request<{ ok: true }>(
                "/auth/logout-all",
                { method: "POST" },
                false,
            ),
        me: () => request<User>("/auth/me"),
        updateProfile: (data: { name?: string; email?: string }) =>
            request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
        changePassword: (data: { currentPassword: string; newPassword: string }) =>
            request<{ ok: true }>("/auth/change-password", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        forgotPassword: (email: string) =>
            request<{ ok: true }>(
                "/auth/forgot-password",
                { method: "POST", body: JSON.stringify({ email }) },
                false,
            ),
        resetPassword: (token: string, password: string) =>
            request<{ ok: true }>(
                "/auth/reset-password",
                { method: "POST", body: JSON.stringify({ token, password }) },
                false,
            ),
        verifyEmail: (token: string) =>
            request<{ ok: true }>(
                "/auth/verify-email",
                { method: "POST", body: JSON.stringify({ token }) },
                false,
            ),
        resendVerification: () =>
            request<{ ok: true }>("/auth/resend-verification", {
                method: "POST",
            }),
    },
    projects: {
        list: () => request<Project[]>("/projects"),
        get: (id: string) => request<Project>(`/projects/${id}`),
        create: (data: {
            title: string;
            language: string;
            contentType: ContentType;
            clipStyle: ClipStyle;
            preferredClipDuration: number;
            renderLayout: RenderLayout;
            captionTheme: CaptionTheme;
        }) =>
            request<Project>("/projects", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        update: (id: string, data: { title: string }) =>
            request<Project>(`/projects/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        remove: (id: string) =>
            request<{ ok: true }>(`/projects/${id}`, { method: "DELETE" }),
        retry: (id: string) =>
            request<Project>(`/projects/${id}/retry`, { method: "POST" }),
        submitYoutubeUrl: (id: string, youtubeUrl: string) =>
            request<Project>(`/projects/${id}/youtube`, {
                method: "POST",
                body: JSON.stringify({ youtubeUrl }),
            }),
        upload: (
            id: string,
            file: File,
            onProgress: (progress: number) => void,
        ) => uploadFile<Project>(`/projects/${id}/upload`, file, onProgress),
    },
    jobs: {
        status: (projectId: string) => request<JobStatus>(`/jobs/${projectId}`),
        getSseTicket: (projectId: string) =>
            request<{ ticket: string; expiresAt: number }>(`/jobs/${projectId}/sse-ticket`, { method: 'POST' }),
    },
    clips: {
        list: (projectId: string) =>
            request<Clip[]>(`/projects/${projectId}/clips`),
        downloadUrl: (clipId: string) => `${BASE_URL}/clips/${clipId}/download`,
        exportPremiereUrl: (projectId: string) =>
            `${BASE_URL}/export/projects/${projectId}/premiere`,
        exportDavinciUrl: (projectId: string) =>
            `${BASE_URL}/export/projects/${projectId}/davinci`,
        subtitleUrl: (clipId: string) => `${BASE_URL}/clips/${clipId}/subtitle`,
        thumbnailUrl: (clipId: string) => `${BASE_URL}/clips/${clipId}/thumbnail`,
        feedback: (
            clipId: string,
            data: { reason: ClipFeedbackReason; note?: string },
        ) =>
            request<{ id: string }>(`/clips/${clipId}/feedback`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        updateTiming: (
            clipId: string,
            data: {
                start: number;
                end: number;
                renderLayout?: RenderLayout;
                captionTheme?: CaptionTheme;
                title?: string;
                suggestedCaptionTitle?: string;
            },
        ) =>
            request<Clip>(`/clips/${clipId}/timing`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        render: (
            clipId: string,
            data: {
                start?: number;
                end?: number;
                renderLayout?: RenderLayout;
                captionTheme?: CaptionTheme;
                previewSeconds?: number;
                autoOverlays?: boolean;
            },
        ) =>
            request<Clip>(`/clips/${clipId}/render`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        remove: (clipId: string) =>
            request<{ ok: true }>(`/clips/${clipId}`, { method: "DELETE" }),
        getSegments: (clipId: string) =>
            request<{
                segments: Array<{ start: number; end: number; text: string }>;
                custom: boolean;
                /** youtube_captions | whisper_local | manual | null */
                source: string | null;
                /** PROCESSING | COMPLETED | FAILED | null */
                status: string | null;
                error: string | null;
            }>(`/clips/${clipId}/segments`),
        retranscribe: (clipId: string) =>
            request<{ ok: true; status: "PROCESSING" }>(`/clips/${clipId}/retranscribe`, {
                method: "POST",
            }),
        updateSegments: (
            clipId: string,
            segments: Array<{ start: number; end: number; text: string }>,
        ) =>
            request<{ ok: true; count: number }>(`/clips/${clipId}/segments`, {
                method: "PATCH",
                body: JSON.stringify({ segments }),
            }),
        resetSegments: (clipId: string) =>
            request<{ ok: true }>(`/clips/${clipId}/segments`, { method: "DELETE" }),
    },
    settings: {
        status: () => request<ApiKeyStatus>("/users/me/api-keys"),
        updateApiKeys: (data: {
            deepseekApiKey?: string;
            openaiApiKey?: string;
            deepseekModel?: string;
            openaiTranscriptionModel?: string;
        }) =>
            request<ApiKeyStatus>("/users/me/api-keys", {
                method: "PUT",
                body: JSON.stringify(data),
            }),
        removeApiKeys: () =>
            request<ApiKeyStatus>("/users/me/api-keys", { method: "DELETE" }),
        removeApiKey: (provider: "deepseek" | "openai") =>
            request<ApiKeyStatus>(`/users/me/api-keys/${provider}`, {
                method: "DELETE",
            }),
        providers: () =>
            request<AiProvidersResponse>("/users/me/api-keys/providers"),
        upsertProvider: (data: {
            provider: string;
            label: string;
            role?: string;
            apiKey?: string;
            baseUrl?: string | null;
            model: string;
            active?: string;
        }) =>
            request<AiProvidersResponse>("/users/me/api-keys/providers", {
                method: "PUT",
                body: JSON.stringify(data),
            }),
        activateProvider: (provider: string, role = "PASS1") =>
            request<AiProvidersResponse>(
                `/users/me/api-keys/providers/${provider}/active?role=${encodeURIComponent(role)}`,
                { method: "PUT" },
            ),
        testProvider: (provider: string, role?: string) =>
            request<{
                ok: boolean;
                latencyMs: number;
                message?: string;
                providers: AiProvidersResponse;
            }>(
                `/users/me/api-keys/providers/${provider}/test${role ? `?role=${encodeURIComponent(role)}` : ""}`,
                { method: "POST" },
            ),
        removeProvider: (provider: string, role?: string) =>
            request<AiProvidersResponse>(
                `/users/me/api-keys/providers/${provider}${role ? `?role=${encodeURIComponent(role)}` : ""}`,
                { method: "DELETE" },
            ),
    },
    quota: {
        get: () => request<import("@/types/api.types").QuotaInfo>("/quota"),
    },
    admin: {
        overview: () =>
            request<import("@/types/api.types").AdminOverview>("/admin/overview"),
        users: (page = 1, search = "") =>
            request<import("@/types/api.types").AdminUsersResponse>(
                `/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
            ),
        financial: () =>
            request<import("@/types/api.types").AdminFinancial>("/admin/financial"),
        content: (page = 1, status = "") =>
            request<import("@/types/api.types").AdminContentResponse>(
                `/admin/content?page=${page}${status ? `&status=${encodeURIComponent(status)}` : ""}`,
            ),
        topUsers: (limit = 8) =>
            request<import("@/types/api.types").AdminTopUsers>(`/admin/top-users?limit=${limit}`),
        userDetail: (id: string) =>
            request<import("@/types/api.types").AdminUserDetail>(`/admin/users/${id}`),
        growth: () => request<import("@/types/api.types").AdminGrowth>("/admin/growth"),
        aiConfig: () => request<import("@/types/api.types").AdminAiConfig>("/admin/ai-config"),
        setAiConfig: (data: Partial<import("@/types/api.types").AdminAiConfigInput>) =>
            request<{ ok: true }>("/admin/ai-config", { method: "PUT", body: JSON.stringify(data) }),
        testAiConfig: (data: { llmModel?: string; llmBaseUrl?: string; llmApiKey?: string }) =>
            request<import("@/types/api.types").AdminAiConfigTestResult>("/admin/ai-config/test", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        audit: (page = 1, scope = "") =>
            request<import("@/types/api.types").AdminAuditResponse>(
                `/admin/audit?page=${page}${scope ? `&scope=${encodeURIComponent(scope)}` : ""}`,
            ),
        setUserAdmin: (id: string, value: boolean) =>
            request<{ ok: true }>(`/admin/users/${id}/admin`, {
                method: "POST",
                body: JSON.stringify({ value }),
            }),
        setUserSuspended: (id: string, value: boolean) =>
            request<{ ok: true }>(`/admin/users/${id}/suspend`, {
                method: "POST",
                body: JSON.stringify({ value }),
            }),
        setUserPlan: (id: string, plan: string) =>
            request<{ ok: true }>(`/admin/users/${id}/plan`, {
                method: "POST",
                body: JSON.stringify({ plan }),
            }),
        verifyUserEmail: (id: string) =>
            request<{ ok: true }>(`/admin/users/${id}/verify-email`, { method: "POST" }),
        queue: () => request<import("@/types/api.types").AdminQueue>("/admin/operations/queue"),
        stuck: (minutes = 30) =>
            request<import("@/types/api.types").AdminStuck>(`/admin/operations/stuck?minutes=${minutes}`),
        requeueProject: (id: string) =>
            request<{ ok: true }>(`/admin/projects/${id}/requeue`, { method: "POST" }),
        cancelProject: (id: string) =>
            request<{ ok: true }>(`/admin/projects/${id}/cancel`, { method: "POST" }),
    },
    brandKits: {
        list: () =>
            request<import("@/types/api.types").BrandKit[]>("/brand-kits"),
        get: (id: string) =>
            request<import("@/types/api.types").BrandKit>(`/brand-kits/${id}`),
        create: (data: {
            name: string;
            primaryColor?: string;
            accentColor?: string;
            captionTheme?: string;
        }) =>
            request<import("@/types/api.types").BrandKit>("/brand-kits", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        update: (
            id: string,
            data: Partial<{
                name: string;
                primaryColor: string;
                accentColor: string;
                captionTheme: string;
                watermarkPos: string;
                watermarkOpacity: number;
            }>,
        ) =>
            request<import("@/types/api.types").BrandKit>(`/brand-kits/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        remove: (id: string) =>
            request<{ ok: true }>(`/brand-kits/${id}`, { method: "DELETE" }),
        uploadLogo: async (id: string, file: File) => {
            const form = new FormData();
            form.append("file", file);
            const res = await authenticatedFetch(
                `${resolveBaseUrl()}/brand-kits/${id}/logo`,
                { method: "POST", body: form },
            );
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new ApiError(
                    res.status,
                    payload,
                    payload?.message ?? "Erro ao enviar logo",
                );
            }
            return res.json() as Promise<import("@/types/api.types").BrandKit>;
        },
        logoBlobUrl: (id: string): Promise<string> => {
            return authenticatedFetch(
                `${resolveBaseUrl()}/brand-kits/${id}/logo`,
            )
                .then((r) => {
                    if (!r.ok) throw new Error("Erro ao carregar logo");
                    return r.blob();
                })
                .then((blob) => URL.createObjectURL(blob));
        },
    },
    captionTemplates: {
        list: () =>
            request<import("@/types/api.types").CaptionTemplate[]>(
                "/caption-templates",
            ),
        create: (data: {
            name: string;
            captionTheme: string;
            renderLayout: string;
        }) =>
            request<import("@/types/api.types").CaptionTemplate>(
                "/caption-templates",
                { method: "POST", body: JSON.stringify(data) },
            ),
        remove: (id: string) =>
            request<{ ok: true }>(`/caption-templates/${id}`, {
                method: "DELETE",
            }),
    },
    billing: {
        checkout: (plan: string) =>
            request<{ url: string }>("/billing/checkout", {
                method: "POST",
                body: JSON.stringify({ plan }),
            }),
        portal: () =>
            request<{ url: string }>("/billing/portal", { method: "POST" }),
        status: () => request<BillingStatus>("/billing/status"),
        cancel: () =>
            request<{ success: boolean }>("/billing/cancel", {
                method: "POST",
            }),
    },
    publish: {
        // Cada endpoint retorna a URL de autorização OAuth (fetch autenticado);
        // o front navega até ela com window.location.href.
        youtubeAuthUrl: () => request<{ url: string }>("/publish/youtube/auth"),
        tiktokAuthUrl: () => request<{ url: string }>("/publish/tiktok/auth"),
        instagramAuthUrl: () => request<{ url: string }>("/publish/instagram/auth"),
        accounts: () =>
            request<
                Array<{
                    id: string;
                    platform: string;
                    platformAccountName: string | null;
                    active: boolean;
                    createdAt: string;
                }>
            >("/publish/accounts"),
        disconnectAccount: (id: string) =>
            request<{ ok: true }>(`/publish/accounts/${id}`, {
                method: "DELETE",
            }),
        publishedClips: () =>
            request<PublishedClip[]>("/publish/clips"),
        calendar: (params: {
            from: string;
            to: string;
            status?: string;
            platform?: string;
        }) => {
            const query = new URLSearchParams({ from: params.from, to: params.to });
            if (params.status) query.set("status", params.status);
            if (params.platform) query.set("platform", params.platform);
            return request<PublishedClip[]>(`/publish/calendar?${query.toString()}`);
        },
        reschedule: (id: string, scheduledAt: string) =>
            request<{ id: string }>(`/publish/schedule/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ scheduledAt }),
            }),
        cancelScheduled: (id: string) =>
            request<{ ok: true }>(`/publish/schedule/${id}`, { method: "DELETE" }),
        publishClip: (
            clipId: string,
            socialAccountId: string,
            scheduledAt?: string,
        ) =>
            request<{ id: string }>(`/publish/clip/${clipId}`, {
                method: "POST",
                body: JSON.stringify({ socialAccountId, scheduledAt }),
            }),
    },
    quality: {
        overview: () => request<QualityOverview>("/quality/overview"),
    },
    quickCaption: {
        listBatches: () => request<QuickCaptionBatch[]>("/quick-caption/batches"),
        createBatch: (data: { name?: string; renderLayout?: RenderLayout; captionTheme?: CaptionTheme }) =>
            request<QuickCaptionBatch>("/quick-caption/batches", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        getBatch: (id: string) => request<QuickCaptionBatch>(`/quick-caption/batches/${id}`),
        updateBatch: (id: string, data: { name?: string; renderLayout?: RenderLayout; captionTheme?: CaptionTheme }) =>
            request<QuickCaptionBatch>(`/quick-caption/batches/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        deleteBatch: (id: string) => request<{ success: true }>(`/quick-caption/batches/${id}`, { method: "DELETE" }),
        renderBatch: (id: string) =>
            request<{ queued: number }>(`/quick-caption/batches/${id}/render`, { method: "POST" }),
        uploadItem: (batchId: string, file: File, onProgress: (progress: number) => void) =>
            uploadFile<QuickCaptionItem>(`/quick-caption/batches/${batchId}/items`, file, onProgress),
        updateItem: (itemId: string, captionText: string) =>
            request<QuickCaptionItem>(`/quick-caption/items/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify({ captionText }),
            }),
        deleteItem: (itemId: string) =>
            request<{ success: true }>(`/quick-caption/items/${itemId}`, { method: "DELETE" }),
        downloadUrl: (itemId: string) => `${BASE_URL}/quick-caption/items/${itemId}/download`,
    },
    channelImport: {
        list: () => request<ChannelImportRequest[]>("/channel-import"),
        create: (data: { platform: SocialChannelPlatform; channelUrl: string }) =>
            request<ChannelImportRequest>("/channel-import", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        get: (id: string) => request<ChannelImportRequest>(`/channel-import/${id}`),
        loadMore: (id: string) => request<{ queued: true }>(`/channel-import/${id}/more`, { method: "POST" }),
        importSelected: (
            id: string,
            data: {
                selectedUrls: string[];
                contentType: ContentType;
                clipStyle: ClipStyle;
                language?: string;
                preferredClipDuration?: number;
                renderLayout?: RenderLayout;
                captionTheme?: CaptionTheme;
            },
        ) =>
            request<{ imported: number; requested: number; projectIds: string[]; quotaExceeded: boolean }>(
                `/channel-import/${id}/import`,
                { method: "POST", body: JSON.stringify(data) },
            ),
    },
};
