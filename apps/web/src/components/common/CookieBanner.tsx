'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'viralforge_cookie_consent';
const CONSENT_VERSION = 'v1';

type ConsentState = 'pending' | 'accepted' | 'declined';

function loadConsent(): ConsentState {
  if (typeof window === 'undefined') return 'pending';
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return 'pending';
    const parsed = JSON.parse(stored) as { version: string; state: ConsentState };
    if (parsed.version !== CONSENT_VERSION) return 'pending';
    return parsed.state;
  } catch {
    return 'pending';
  }
}

function saveConsent(state: 'accepted' | 'declined') {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, state }));
  } catch { /* sem-op */ }
}

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState>('accepted'); // SSR-safe default

  useEffect(() => {
    setConsent(loadConsent());
  }, []);

  function accept() {
    saveConsent('accepted');
    setConsent('accepted');
  }

  function decline() {
    saveConsent('declined');
    setConsent('declined');
  }

  return (
    <AnimatePresence>
      {consent === 'pending' && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          role="dialog"
          aria-label="Aviso de cookies"
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 z-[200] mx-auto max-w-2xl rounded-2xl border border-hairline-subtle bg-surface/95 p-5 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline-subtle bg-elevated">
              <Cookie className="h-5 w-5 text-ink-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-primary">Cookies e privacidade</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Usamos cookies essenciais para autenticação e cookies analíticos (PostHog) para melhorar
                a plataforma. Nenhum dado é vendido a terceiros. Ao clicar em{' '}
                <strong className="text-ink-primary">Aceitar</strong>, você concorda com nossa{' '}
                <Link href="/privacy" className="text-accent underline underline-offset-2 hover:text-accent-hover">
                  Política de Privacidade
                </Link>
                .
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={accept}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Aceitar todos
                </button>
                <button
                  onClick={decline}
                  className="rounded-lg border border-hairline-subtle bg-elevated px-4 py-2 text-xs font-medium text-ink-secondary transition hover:border-hairline-strong hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Apenas essenciais
                </button>
                <Link
                  href="/privacy"
                  className="rounded-lg px-4 py-2 text-xs text-ink-tertiary transition hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Saiba mais
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
