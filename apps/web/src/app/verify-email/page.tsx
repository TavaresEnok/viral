import { Suspense } from 'react';
import AuthLayoutShell from '@/components/auth/AuthLayoutShell';
import { VerifyEmailPage } from '@/components/auth/VerifyEmailPage';

export const metadata = {
  title: 'Verificar e-mail — ViralForge',
  description: 'Confirme seu endereço de e-mail',
};

export default function VerifyEmail() {
  return (
    <AuthLayoutShell>
      <Suspense fallback={<div className="rounded-2xl border border-hairline-subtle bg-surface/92 p-10 text-center text-sm text-ink-secondary">Carregando…</div>}>
        <VerifyEmailPage />
      </Suspense>
    </AuthLayoutShell>
  );
}
