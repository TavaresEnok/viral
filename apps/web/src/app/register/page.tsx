import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <>
      <RegisterForm />
      <p className="mt-5 text-center text-sm text-ink-secondary">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Entrar
        </Link>
      </p>
    </>
  );
}
