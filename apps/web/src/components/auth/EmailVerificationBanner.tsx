'use client';

import { useState } from 'react';
import { MailWarning, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function EmailVerificationBanner() {
  const user = useAuthStore((state) => state.user);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Não mostra se e-mail já verificado, usuário não logado ou banner dispensado
  if (!user || user.emailVerified || dismissed) return null;

  async function handleResend() {
    setSending(true);
    try {
      await api.auth.resendVerification();
      setSent(true);
      toast.success('E-mail de verificação enviado! Verifique sua caixa de entrada.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao reenviar e-mail';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div className="flex-1">
        {sent ? (
          <span className="flex items-center gap-2 text-amber-200">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-text)]" />
            E-mail enviado! Verifique sua caixa de entrada e a pasta de spam.
          </span>
        ) : (
          <>
            <span className="text-amber-200">
              <strong>Verifique seu e-mail.</strong> Enviamos um link de confirmação para{' '}
              <span className="font-medium">{user.email}</span>.
            </span>
            <button
              onClick={handleResend}
              disabled={sending}
              className="ml-2 inline-flex items-center gap-1 font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200 disabled:opacity-60"
            >
              {sending ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Enviando…
                </>
              ) : (
                'Reenviar'
              )}
            </button>
          </>
        )}
      </div>
      <button
        aria-label="Dispensar aviso"
        onClick={() => setDismissed(true)}
        className="mt-0.5 text-amber-500 hover:text-amber-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
