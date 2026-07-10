"use client";

import {
    MutationCache,
    QueryCache,
    QueryClient,
    QueryClientProvider,
    useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode, Suspense } from "react";
import { toast, Toaster } from "sonner";
import { PageTransition } from "@/components/common/PageTransition";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { CookieBanner } from "@/components/common/CookieBanner";
import { useAuthStore } from "@/stores/auth.store";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: false, // We handle this manually below
    });
}

function PostHogPageView() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (
            !pathname ||
            typeof window === "undefined" ||
            !process.env.NEXT_PUBLIC_POSTHOG_KEY
        ) {
            return;
        }

        const query = searchParams?.toString() ?? "";
        const url = query
            ? `${window.origin}${pathname}?${query}`
            : `${window.origin}${pathname}`;

        posthog.capture("$pageview", {
            $current_url: url,
        });
    }, [pathname, searchParams]);
    return null;
}

function AuthCacheBoundary({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const userId = useAuthStore((state) => state.user?.id);
    const previousUserId = useRef(userId);

    useEffect(() => {
        if (previousUserId.current === userId) return;
        previousUserId.current = userId;
        queryClient.invalidateQueries();
    }, [userId, queryClient]);

    return <>{children}</>;
}

function toastFromError(error: unknown) {
    const message =
        error instanceof Error ? error.message : "Erro inesperado. Tente novamente.";
    toast.error(message);
}

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                queryCache: new QueryCache({
                    onError: (_error, query) => {
                        if (query.meta?.silent) return;
                        toastFromError(_error);
                    },
                }),
                mutationCache: new MutationCache({
                    onError: (_error, _variables, _context, mutation) => {
                        if (mutation.meta?.silent) return;
                        if (mutation.options.onError) return;
                        toastFromError(_error);
                    },
                }),
            }),
    );

    useEffect(() => {
        const stored = localStorage.getItem("viralforge-theme");
        if (stored === "light") {
            document.documentElement.classList.add("light");
        }
    }, []);

    return (
        <PostHogProvider client={posthog}>
            <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                    <AuthCacheBoundary>
                        <Suspense fallback={null}>
                            <PostHogPageView />
                        </Suspense>
                        <PageTransition>{children}</PageTransition>
                        <Toaster
                            position="bottom-right"
                            richColors
                            theme="dark"
                        />
                        <CookieBanner />
                    </AuthCacheBoundary>
                </QueryClientProvider>
            </ErrorBoundary>
        </PostHogProvider>
    );
}
