'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { slideUp } from '@/lib/motion-variants';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      capture('auth_login_submitted', { method: 'password' });
      const response = await api.auth.login({ email, password });
      login(response.user, response.token);
      capture('auth_login_succeeded', { method: 'password' });
      router.replace(response.user.isAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao entrar';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form variants={slideUp} initial="initial" animate="animate" onSubmit={onSubmit} className="rounded-card border border-hairline-subtle bg-surface p-7">
      <div className="mb-6">
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--accent-text)]">bem-vindo de volta</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary">Entra no estúdio</h1>
        <p className="mt-2 text-sm text-ink-secondary">Teus cortes continuam de onde você parou.</p>
      </div>
      <div className="space-y-4">
        <Input id="email" label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <div className="relative">
          <Input
            id="password"
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute bottom-3 right-3 text-ink-tertiary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-ink-tertiary hover:text-accent transition-colors"
          >
            Esqueci minha senha
          </Link>
        </div>
        {error && <p className="text-sm text-[#FF8A8A]">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Entrar no estúdio
        </Button>
      </div>
    </motion.form>
  );
}
