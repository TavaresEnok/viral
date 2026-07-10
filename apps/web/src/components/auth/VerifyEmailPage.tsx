'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { slideUp } from '@/lib/motion-variants';
import { Button } from '@/components/ui/Button';

type Status = 'verifying' | 'success' | 'error' | 'no-token';

export function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'no-token');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    api.auth.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Falha na verificação');
        setStatus('error');
      });
  }, [token]);

  if (status === 'verifying') {
    return (
      <motion.div
        variants={slideUp}
        initial="initial"
        animate="animate"
        className="rounded-2xl border border-hairline-subtle bg-surface p-10 shadow-elevated text-center"
      >
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent mb-4" />
        <h1 className="text-2xl font-semibold text-ink-primary">Verificando seu e-mail…</h1>
        <p className="mt-2 text-sm text-ink-secondary">Aguarde um instante.</p>
      </motion.div>
    );
  }

  if (status === 'success') {
    return (
      <motion.div
        variants={slideUp}
        initial="initial"
        animate="animate"
        className="rounded-2xl border border-hairline-subtle bg-surface p-10 shadow-elevated text-center"
      >
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-[color:var(--accent-text)]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Confirmado</p>
        <h1 className="text-2xl font-semibold text-ink-primary">E-mail verificado!</h1>
        <p className="mt-3 text-sm text-ink-secondary leading-relaxed">
          Sua conta foi ativada com sucesso. Agora você tem acesso completo ao ViralForge.
        </p>
        <Link href="/dashboard">
          <Button className="mt-6 w-full">Ir para o dashboard</Button>
        </Link>
      </motion.div>
    );
  }

  if (status === 'no-token') {
    return (
      <motion.div
        variants={slideUp}
        initial="initial"
        animate="animate"
        className="rounded-2xl border border-hairline-subtle bg-surface p-10 shadow-elevated text-center"
      >
        <h1 className="text-2xl font-semibold text-ink-primary mb-3">Link inválido</h1>
        <p className="text-sm text-ink-secondary mb-6">
          Nenhum token de verificação encontrado. Verifique se o link está completo.
        </p>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:text-accent-hover">
          Ir para o dashboard
        </Link>
      </motion.div>
    );
  }

  // status === 'error'
  return (
    <motion.div
      variants={slideUp}
      initial="initial"
      animate="animate"
      className="rounded-2xl border border-hairline-subtle bg-surface p-10 shadow-elevated text-center"
    >
      <div className="mb-5 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
          <XCircle className="h-8 w-8" />
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-ink-primary mb-3">Falha na verificação</h1>
      <p className="text-sm text-ink-secondary mb-6">{errorMessage || 'Este link é inválido ou já foi utilizado.'}</p>
      <div className="space-y-3">
        <Link href="/dashboard">
          <Button variant="secondary" className="w-full">Ir para o dashboard</Button>
        </Link>
        <p className="text-xs text-ink-tertiary">
          Dentro do dashboard você pode solicitar um novo e-mail de verificação.
        </p>
      </div>
    </motion.div>
  );
}
