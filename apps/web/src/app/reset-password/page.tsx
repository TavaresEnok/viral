import { Suspense } from 'react';
import Link from 'next/link';
import AuthLayoutShell from '@/components/auth/AuthLayoutShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata = {
  title: 'Redefinir senha — ViralForge',
  description: 'Crie uma nova senha para sua conta ViralForge',
};

export default function ResetPasswordPage() {
  return (
    <AuthLayoutShell>
      <Suspense fallback={<div className="rounded-2xl border border-hairline-subtle bg-surface/92 p-10 text-center text-sm text-ink-secondary">Carregando…</div>}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-5 text-center text-sm text-ink-secondary">
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Voltar ao login
        </Link>
      </p>
    </AuthLayoutShell>
  );
}
