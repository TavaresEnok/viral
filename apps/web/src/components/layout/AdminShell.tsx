'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api, ensureSession } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { AdminSidebar } from './AdminSidebar';

/**
 * Shell do console administrativo — separado do app do criador (sem o menu de
 * "Novo corte" etc.). Garante sessão e que o usuário é admin (lê isAdmin fresco
 * via /auth/me, então não exige relogin). Não-admins são mandados ao /dashboard.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const [state, setState] = useState<'loading' | 'ok'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = token ? true : await ensureSession();
      if (!alive) return;
      if (!ok) {
        router.replace('/login');
        return;
      }
      try {
        const me = await api.auth.me();
        if (!alive) return;
        setUser(me);
        if (me.isAdmin) {
          setState('ok');
        } else {
          router.replace('/dashboard');
        }
      } catch {
        if (!alive) return;
        if (useAuthStore.getState().user?.isAdmin) {
          setState('ok');
        } else {
          router.replace('/dashboard');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, router, setUser]);

  if (state !== 'ok') {
    return <div className="min-h-screen bg-base" />;
  }

  return (
    <div className="flex min-h-screen bg-base text-ink-primary">
      <AdminSidebar />
      <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
