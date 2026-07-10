'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { slideUp } from '@/lib/motion-variants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

function passwordScore(password: string) {
  return (
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password))
  );
}

type Step = 'form' | 'success';

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');

  const score = passwordScore(password);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Token inválido. Solicite um novo link de redefinição.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setStep('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao redefinir senha';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <motion.div
        variants={slideUp}
        initial="initial"
        animate="animate"
        className="rounded-2xl border border-hairline-subtle bg-surface p-7 shadow-elevated text-center"
      >
        <h1 className="text-2xl font-semibold text-ink-primary mb-3">Link inválido</h1>
        <p className="text-sm text-ink-secondary mb-6">Este link de redefinição é inválido ou expirou.</p>
        <Link href="/forgot-password" className="text-sm font-medium text-accent hover:text-accent-hover">
          Solicitar novo link
        </Link>
      </motion.div>
    );
  }

  if (step === 'success') {
    return (
      <motion.div
        variants={slideUp}
        initial="initial"
        animate="animate"
        className="rounded-2xl border border-hairline-subtle bg-surface p-7 shadow-elevated text-center"
      >
        <div className="mb-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-[color:var(--accent-text)]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary mb-3">Senha redefinida!</h1>
        <p className="text-sm text-ink-secondary mb-6">
          Sua senha foi alterada com sucesso. Todas as sessões anteriores foram encerradas por segurança.
        </p>
        <Button className="w-full" onClick={() => router.replace('/login')}>
          Entrar com nova senha
        </Button>
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Nova senha</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink-primary">Redefinir senha</h1>
        <p className="mt-2 text-sm text-ink-secondary">Crie uma senha forte para sua conta ViralForge.</p>
      </div>
      <div className="space-y-4">
        <div className="relative">
          <Input
            id="password"
            label="Nova senha"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute bottom-3 right-3 text-ink-tertiary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength bar */}
        <div aria-hidden="true" className="grid grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full bg-overlay transition',
                i < score && score <= 1 && 'bg-danger',
                i < score && score === 2 && 'bg-warning',
                i < score && score === 3 && 'bg-info',
                i < score && score >= 4 && 'bg-success',
              )}
            />
          ))}
        </div>
        <p className="text-xs text-ink-tertiary">Deve conter maiúscula, minúscula, número e caractere especial.</p>

        <Input
          id="confirmPassword"
          label="Confirmar nova senha"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Redefinir senha
        </Button>
      </div>
    </motion.form>
  );
}
