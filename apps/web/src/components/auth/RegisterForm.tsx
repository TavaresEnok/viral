'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { slideUp } from '@/lib/motion-variants';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function RegisterForm() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordScore =
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Informe um e-mail válido');
      return;
    }
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      capture('auth_register_submitted', { method: 'password' });
      const response = await api.auth.register({ name, email, password });
      login(response.user, response.token);
      capture('auth_register_succeeded', { method: 'password' });
      router.replace('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao criar conta';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form variants={slideUp} initial="initial" animate="animate" onSubmit={onSubmit} className="rounded-2xl border border-hairline-subtle bg-surface p-7 shadow-elevated">
      <div className="mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Novo estúdio</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink-primary">Crie sua conta</h1>
        <p className="mt-2 text-sm text-ink-secondary">Prepare seu primeiro projeto em poucos minutos.</p>
      </div>
      <div className="space-y-4">
        <Input id="name" label="Nome" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        <Input id="email" label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <Input id="password" label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        <div aria-hidden="true" className="grid grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 rounded-full bg-overlay transition',
                index < passwordScore && passwordScore <= 1 && 'bg-danger',
                index < passwordScore && passwordScore === 2 && 'bg-warning',
                index < passwordScore && passwordScore === 3 && 'bg-info',
                index < passwordScore && passwordScore >= 4 && 'bg-success',
              )}
            />
          ))}
        </div>
        <p className="text-xs text-ink-tertiary">Use no mínimo 8 caracteres. Números e símbolos deixam a senha mais forte.</p>
        <Input
          id="confirmPassword"
          label="Confirmar senha"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Criar conta
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-ink-tertiary">
          Ao criar uma conta, você concorda com os{' '}
          <Link href="/terms" className="text-accent hover:underline" target="_blank">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link href="/privacy" className="text-accent hover:underline" target="_blank">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </motion.form>
  );
}
