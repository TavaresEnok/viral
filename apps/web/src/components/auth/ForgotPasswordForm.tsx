"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MailCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api";
import { slideUp } from "@/lib/motion-variants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Step = "form" | "sent";

export function ForgotPasswordForm() {
    const [step, setStep] = useState<Step>("form");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setError("Informe um e-mail válido");
            return;
        }

        setLoading(true);
        try {
            await api.auth.forgotPassword(email);
            setStep("sent");
        } catch {
            // Não revela se e-mail existe — sempre mostra sucesso
            setStep("sent");
        } finally {
            setLoading(false);
        }
    }

    if (step === "sent") {
        return (
            <motion.div
                variants={slideUp}
                initial="initial"
                animate="animate"
                className="rounded-2xl border border-hairline-subtle bg-surface p-7 shadow-elevated text-center"
            >
                <div className="mb-5 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-[color:var(--accent-text)]">
                        <MailCheck className="h-7 w-7" />
                    </div>
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
                    E-mail enviado
                </p>
                <h1 className="text-2xl font-semibold text-ink-primary">
                    Verifique sua caixa de entrada
                </h1>
                <p className="mt-3 text-sm text-ink-secondary leading-relaxed">
                    Se o endereço{" "}
                    <strong className="text-ink-primary">{email}</strong>{" "}
                    estiver cadastrado, você receberá um link para redefinir sua
                    senha em breve. Verifique também a pasta de spam.
                </p>
                <p className="mt-4 text-xs text-ink-tertiary">
                    O link expira em <strong>1 hora</strong>.
                </p>
                <Link
                    href="/login"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                </Link>
            </motion.div>
        );
    }

    return (
        <motion.form
            variants={slideUp}
            initial="initial"
            animate="animate"
            onSubmit={onSubmit}
            className="rounded-2xl border border-hairline-subtle bg-surface p-7 shadow-elevated"
        >
            <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
                    Recuperação
                </p>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink-primary">
                    Esqueci minha senha
                </h1>
                <p className="mt-2 text-sm text-ink-secondary">
                    Informe seu e-mail e enviaremos um link para criar uma nova
                    senha.
                </p>
            </div>
            <div className="space-y-4">
                <Input
                    id="email"
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                />
                {error && <p className="text-sm text-red-300">{error}</p>}
                <Button type="submit" className="w-full" loading={loading}>
                    Enviar link de redefinição
                </Button>
            </div>
        </motion.form>
    );
}
