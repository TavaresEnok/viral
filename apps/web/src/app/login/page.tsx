import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="mt-5 text-center text-sm text-ink-secondary">
        Não tem conta?{' '}
        <Link href="/register" className="font-medium text-accent hover:text-accent-hover">
          Criar agora
        </Link>
      </p>
    </>
  );
}
