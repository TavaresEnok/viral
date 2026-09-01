export type ProjectStatus =
    | "DRAFT"
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";
export type ClipStatus = "PENDING" | "RENDERING" | "COMPLETED" | "FAILED";
export type ContentType =
    | "PODCAST"
    | "INTERVIEW"
    | "CLASS"
    | "LIVE"
    | "TALK"
    | "COMEDY"
    | "GAMING"
    | "MYSTERY"
    | "NEWS"
    | "OTHER";
export type ClipStyle =
    | "VIRAL"
    | "EDUCATIONAL"
    | "CONTROVERSIAL"
    | "FUNNY"
    | "MOTIVATIONAL"
    | "SALES"
    | "STRONG_QUOTES";
export type RenderLayout =
    | "BLURRED_BACKGROUND"
    | "FILL_CROP"
    | "CENTER_FIT"
    | "TOP_FRAME"
    | "SMART_REFRAME"
    | "SMART_CENTER"
    | "SPEAKER_CLOSEUP"
    | "PODCAST_SPLIT_STATIC"
    | "SCREEN_PLUS_FACE";
export type CaptionTheme =
    | "CLEAN_FOOTER"
    | "BOLD_FOOTER"
    | "CREATOR_BOX"
    | "MINIMAL"
    | "BOLD_CREATOR"
    | "CLEAN_EDITORIAL"
    | "NEON_TECH"
    | "KARAOKE_PRO"
    | "PODCAST_PRO"
    | "STORY_IMPACT";
export type ClipFeedbackReason =
    | "WEAK_START"
    | "WEAK_END"
    | "NOT_VIRAL"
    | "MISSING_CONTEXT"
    | "BAD_CAPTION"
    | "OTHER";

export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    isAdmin?: boolean;
    createdAt: string;
}

export interface AdminOverview {
    users: {
        total: number;
        verified: number;
        unverified: number;
        admins: number;
        newLast7Days: number;
        newLast30Days: number;
        byPlan: Record<string, number>;
    };
    revenue: {
        currency: string;
        mrr: number;
        activeSubscriptions: number;
        activeByPlan: Record<string, number>;
    };
    content: {
        projects: number;
        projectsByStatus: Record<string, number>;
        totalMinutesIngested: number;
        clips: number;
        renderedClips: number;
        clipsByStatus: Record<string, number>;
    };
    storage: {
        bytes: number | null;
        humanReadable: string | null;
        root: string;
    };
    pipeline: {
        runs: number;
        failed: number;
        failureRate: number;
        recentFailures: Array<{
            id: string;
            projectId: string;
            failedStage: string | null;
            createdAt: string;
        }>;
    };
}

export interface AdminUserRow {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    isAdmin: boolean;
    suspended: boolean;
    createdAt: string;
    plan: string;
    subscriptionStatus: string;
    rendersUsed: number;
    rendersLimit: number;
    projects: number;
    clips: number;
}

export interface AdminUserDetail {
    user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        isAdmin: boolean;
        suspended: boolean;
        createdAt: string;
        quota: Record<string, unknown> | null;
        _count: { projects: number };
    };
    recentProjects: Array<{ id: string; title: string; status: string; createdAt: string; clips: number }>;
    recentClips: number;
}

export interface AdminAiConfig {
    llmActive: boolean;
    llmProvider: string;
    llmModel: string;
    llmBaseUrl: string;
    llmKeySet: boolean;
    llmMaxCostUsd?: number | null;
    transcriptionActive: boolean;
    transcriptionProvider: string;
    transcriptionModel: string;
    transcriptionBaseUrl: string;
    transcriptionKeySet: boolean;
}

export interface AdminAiConfigInput {
    llmActive: boolean;
    llmProvider: string;
    llmModel: string;
    llmBaseUrl: string;
    llmApiKey: string;
    llmMaxCostUsd?: number | null;
    transcriptionActive: boolean;
    transcriptionProvider: string;
    transcriptionModel: string;
    transcriptionBaseUrl: string;
    transcriptionApiKey: string;
}

export interface AdminAiConfigTestResult {
    ok: boolean;
    model?: string;
    latencyMs?: number;
    status?: number;
    message: string;
    reply?: string;
}

export interface AdminGrowth {
    days: number;
    series: Array<{ date: string; newUsers: number; newProjects: number; totalUsers: number }>;
}

export interface AdminTopUsers {
    users: Array<{
        id: string;
        name: string | null;
        email: string;
        plan: string;
        clips: number;
        projects: number;
    }>;
}

export interface AdminAuditEntry {
    id: string;
    action: string;
    actorEmail: string | null;
    entityType: string | null;
    entityId: string | null;
    ip: string | null;
    metadata: unknown;
    createdAt: string;
}

export interface AdminAuditResponse {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    entries: AdminAuditEntry[];
}

export interface AdminQueue {
    queue: string;
    counts: Record<string, number>;
}

export interface AdminStuck {
    thresholdMinutes: number;
    projects: Array<{ id: string; title: string; progress: number; stuckSince: string; ownerEmail: string }>;
}

export interface AdminUsersResponse {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    users: AdminUserRow[];
}

export interface AdminFinancial {
    currency: string;
    mrr: number;
    arr: number;
    arpu: number;
    activeSubscriptions: number;
    activeByPlan: Record<string, number>;
    mrrByPlan: Record<string, number>;
    subscriptionsByStatus: Record<string, number>;
    planPrices: Record<string, number>;
    recent: Array<{ email: string; name: string; plan: string; status: string; updatedAt: string }>;
}

export interface AdminContentRow {
    id: string;
    title: string;
    status: string;
    contentType: string;
    ownerEmail: string;
    createdAt: string;
    durationMinutes: number | null;
    clips: number;
}

export interface AdminContentResponse {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    byStatus: Record<string, number>;
    projects: AdminContentRow[];
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface Project {
    id: string;
    title: string;
    language: string;
    contentType: ContentType;
    clipStyle: ClipStyle;
    preferredClipDuration: number;
    renderLayout: RenderLayout;
    captionTheme: CaptionTheme;
    status: ProjectStatus;
    progress: number;
    sourceUrl?: string | null;
    errorMessage?: string | null;
    durationSeconds?: number | null;
    createdAt: string;
    updatedAt: string;
    transcript?: Transcript | null;
    clips?: Clip[];
    _count?: { clips: number };
}

export interface Transcript {
    id: string;
    projectId: string;
    language: string;
    source: string;
    sourceModel?: string | null;
    asrProvider?: string | null;
    asrModel?: string | null;
    asrComputeType?: string | null;
    asrDevice?: string | null;
    asrBatchSize?: number | null;
    asrDownloadSec?: number | null;
    asrNormalizeSec?: number | null;
    asrTranscribeSec?: number | null;
    asrTotalSec?: number | null;
    asrRtf?: number | null;
    asrCacheHit?: boolean;
    asrFallbackUsed?: boolean;
    qualityScore?: number | null;
    qualityWarnings?: string[] | null;
    segmentCount: number;
    wordCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Clip {
    id: string;
    projectId: string;
    title: string;
    suggestedStart?: number | null;
    suggestedEnd?: number | null;
    start: number;
    end: number;
    duration: number;
    viralScore: number;
    finalScore: number;
    scoreBreakdown?: {
        weighted?: number;
        viral?: number;
        opening?: number;
        closing?: number;
        context?: number;
        emotional?: number;
        quotability?: number;
        boosts?: Record<string, number>;
        penalties?: Record<string, number>;
    } | null;
    openingStrength?: number | null;
    closingStrength?: number | null;
    contextIndependenceScore?: number | null;
    emotionalDensity?: number | null;
    quotability?: number | null;
    closingType?: string | null;
    riskOfBadCut?: string | null;
    needsReview?: boolean;
    textSimilarity?: number | null;
    detectedWeakEnding?: boolean;
    detectedLastWords?: string | null;
    wasAdjustedByAi?: boolean;
    adjustmentNotes?: string | null;
    suggestedCaptionTitle?: string | null;
    firstThreeSecondsHook?: string | null;
    shareabilityReason?: string | null;
    actualTextInClip?: string | null;
    evaluationNotes?: {
        hook_real?: string | null;
        hook_check?: string | null;
        closing_real?: string | null;
        closing_check?: string | null;
        context_check?: string | null;
        emotional_pull?: string | null;
        verdict?: string | null;
    } | null;
    category: string;
    hook?: string | null;
    reason: string;
    renderLayout?: RenderLayout | null;
    captionTheme?: CaptionTheme | null;
    status: ClipStatus;
    videoPath?: string | null;
    thumbnailPath?: string | null;
    vttPath?: string | null;
    errorMessage?: string | null;
    renderEngine?: string | null;
    renderDurationMs?: number | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface JobStatus {
    projectId: string;
    status: ProjectStatus;
    progress: number;
    errorMessage?: string | null;
    job?: {
        id: string;
        stage: string;
        status: string;
        progress: number;
        errorMessage?: string | null;
    } | null;
}

export interface ApiKeyStatus {
    deepseek: {
        configured: boolean;
        maskedKey: string | null;
        model: string;
        availableModels: string[];
    };
    openai: {
        configured: boolean;
        maskedKey: string | null;
        model: string;
        availableModels: string[];
    };
}

export interface AiProviderStatus {
    provider: string;
    label: string;
    role: string;
    baseUrl: string | null;
    customBaseUrl: string | null;
    models: string[];
    configured: boolean;
    maskedKey: string | null;
    active: boolean;
    model: string;
    supportsDirectUse: boolean;
    lastTestedAt?: string | null;
    lastTestStatus?: string | null;
    lastTestLatencyMs?: number | null;
    lastTestError?: string | null;
    lastUsedAt?: string | null;
}

export interface AiProvidersResponse {
    activeLlmProvider: string;
    providers: AiProviderStatus[];
}

export interface QuotaInfo {
    plan: string;
    projectsUsed: number;
    projectsLimit: number;
    minutesUsed: number;
    minutesLimit: number;
    rendersUsed: number;
    rendersLimit: number;
    resetAt: string;
}

export interface BrandKit {
    id: string;
    name: string;
    primaryColor: string;
    accentColor: string;
    captionTheme: string;
    logoPath?: string | null;
    watermarkPath?: string | null;
    watermarkPos: string;
    watermarkOpacity: number;
    createdAt: string;
    updatedAt: string;
}

export interface CaptionTemplate {
    id: string;
    name: string;
    captionTheme: string;
    renderLayout: string;
    createdAt: string;
}

export interface BillingStatus {
    plan: string;
    status: string;
    subscriptionId: string | null;
    customerId: string | null;
}

export interface QualityOverview {
    totals: {
        projects: number;
        completedProjects: number;
        failedProjects: number;
        clips: number;
        completedClips: number;
        badFeedbacks: number;
        averageViralScore: number;
        averageFinalScore: number;
        averageTranscriptQuality: number;
        averageClosingStrength: number;
        averageOpeningStrength: number;
        averageRenderDurationMs: number;
        remotionRenderedClips: number;
        projectCompletionRate: number;
        projectFailureRate: number;
        clipBadRate: number;
        completedClipProxyRate: number;
        totalLlmTokens: number;
        totalLlmCostEstimate: number;
        averageLlmCostPerProject: number;
        pipelineRuns: number;
        pipelineFailureRate: number;
        averagePipelineTotalSec: number;
        averageDownloadSec: number;
        averageCaptionsSec: number;
        averageAsrSec: number;
        averageLlmAnalyzeSec: number;
        averageRenderTotalSec: number;
        remoteGpuUseRate: number;
        fallbackUseRate: number;
        averagePass1Candidates: number;
        averageApprovedClips: number;
        averagePass2RejectionRate: number;
    };
    pipeline: {
        runs: number;
        completed: number;
        failed: number;
        failureByStage: Array<{ stage: string; count: number }>;
        renderEngineBreakdown: Array<{ engine: string; count: number }>;
        recentRuns: Array<{
            id: string;
            projectId: string;
            jobId?: string | null;
            status: string;
            failedStage?: string | null;
            errorMessage?: string | null;
            totalSec?: number | null;
            remoteGpuUsed: boolean;
            fallbackUsed: boolean;
            renderEngines?: unknown;
            createdAt: string;
        }>;
    };
    scoreBuckets: Array<{ bucket: string; count: number }>;
    badReasons: Array<{ reason: string; count: number }>;
    recentProjects: Array<{
        id: string;
        title: string;
        status: ProjectStatus;
        progress: number;
        createdAt: string;
        durationSeconds?: number | null;
        clipCount: number;
        completedClipCount: number;
        failedClipCount: number;
        averageViralScore: number;
        averageFinalScore: number;
        averageClosingStrength: number;
        averageOpeningStrength: number;
        averageRenderDurationMs: number;
        transcriptSource?: string | null;
        transcriptSourceModel?: string | null;
        transcriptQualityScore?: number | null;
        transcriptWarnings?: unknown;
        lastStage?: string | null;
        errorMessage?: string | null;
        llmPass1Tokens?: number | null;
        llmPass2Tokens?: number | null;
        llmPass1Model?: string | null;
        llmPass2Model?: string | null;
        llmCostEstimate?: number | null;
    }>;
}
