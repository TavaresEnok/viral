"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ensureSession } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";

export function DashboardShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const [sessionReady, setSessionReady] = useState(false);

    useEffect(() => {
        if (token) {
            setSessionReady(true);
            return;
        }
        let alive = true;
        ensureSession().then((ok) => {
            if (!alive) return;
            if (!ok) {
                router.replace("/login");
                return;
            }
            setSessionReady(true);
        });
        return () => {
            alive = false;
        };
    }, [token, router]);

    if (!sessionReady || !token) {
        return <div className="min-h-screen bg-base" />;
    }

    return (
        <div className="flex min-h-screen bg-base text-ink-primary">
            <Sidebar />
            <div className="min-w-0 flex-1">
                <Header />
                <div className="mx-auto w-full max-w-[1500px] px-4 pt-4 md:px-8">
                    <EmailVerificationBanner />
                </div>
                <main
                    id="main-content"
                    className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-8 md:py-8"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
