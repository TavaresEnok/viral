'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const inputCls =
  'h-11 w-full rounded-input border border-hairline-subtle bg-base px-3.5 text-sm text-ink-primary outline-none transition placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25';
const btnCls =
  'rounded-input bg-accent px-5 py-2.5 text-sm font-bold text-[#10120A] transition hover:opacity-90 disabled:opacity-50';

export default function AccountSettingsPage() {
  const setUser = useAuthStore((state) => state.setUser);
  const { data: me, isLoading, refetch } = useQuery({ queryKey: ['me'], queryFn: api.auth.me, refetchOnWindowFocus: false });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name);
      setEmail(me.email);
    }
  }, [me]);

  if (isLoading || !me) return <Skeleton className="h-[480px] rounded-2xl" />;

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const updated = await api.auth.updateProfile({ name, email });
      setUser(updated);
      await refetch();
      toast.success(updated.email !== me?.email ? 'Perfil salvo — verifique o novo e-mail' : 'Perfil salvo');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    setSavingPassword(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Senha alterada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-[680px] space-y-7 px-1 py-2 md:px-4 md:py-4">
      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">conta</p>
        <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Configurações</h1>
        <p className="mt-3 text-sm text-ink-secondary">Seus dados de conta. Para plano e cobrança, veja a aba Plano.</p>
      </header>

      <section className="space-y-4 rounded-card border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Perfil</h2>
        <label className="block">
          <span className="text-sm font-medium text-ink-secondary">Nome</span>
          <input className={`mt-1.5 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-secondary">E-mail</span>
          <input className={`mt-1.5 ${inputCls}`} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          {!me.emailVerified && <span className="mt-1 block text-xs text-warning">E-mail não verificado.</span>}
        </label>
        <div className="flex justify-end">
          <button type="button" onClick={saveProfile} disabled={savingProfile || (name === me.name && email === me.email)} className={btnCls}>
            {savingProfile ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-card border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Senha</h2>
        <label className="block">
          <span className="text-sm font-medium text-ink-secondary">Senha atual</span>
          <input className={`mt-1.5 ${inputCls}`} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" autoComplete="current-password" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-secondary">Nova senha</span>
          <input className={`mt-1.5 ${inputCls}`} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" />
          <span className="mt-1 block text-xs text-ink-tertiary">Mín. 8 caracteres, com maiúscula, minúscula, número e especial.</span>
        </label>
        <div className="flex justify-end">
          <button type="button" onClick={savePassword} disabled={savingPassword || !currentPassword || newPassword.length < 8} className={btnCls}>
            {savingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>
      </section>
    </div>
  );
}
