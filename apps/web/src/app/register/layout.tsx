import AuthLayoutShell from '@/components/auth/AuthLayoutShell';

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
