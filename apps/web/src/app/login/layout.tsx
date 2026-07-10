import AuthLayoutShell from '@/components/auth/AuthLayoutShell';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
