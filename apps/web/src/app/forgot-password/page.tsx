import Link from 'next/link';
import AuthLayoutShell from '@/components/auth/AuthLayoutShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata = {
  title: 'Esqueci minha senha — ViralForge',
  description: 'Redefina sua senha do ViralForge',
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayoutShell>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm text-ink-secondary">
        Lembrou a senha?{' '}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Entrar
        </Link>
      </p>
    </AuthLayoutShell>
  );
}
