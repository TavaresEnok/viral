'use client';

import type { ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

const PLANS = ['free', 'pro', 'studio'];

export type UserActionTarget = {
  id: string;
  email: string;
  isAdmin: boolean;
  suspended: boolean;
  emailVerified: boolean;
  plan: string;
};

export function UserActionsMenu({
  user,
  onChanged,
  trigger,
}: {
  user: UserActionTarget;
  onChanged: () => void;
  trigger?: ReactNode;
}) {
  const action = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; label: string }) => run(),
    onSuccess: (_result, variables) => {
      toast.success(variables.label);
      onChanged();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Falha na ação'),
  });
  const run = (label: string, fn: () => Promise<unknown>) => action.mutate({ label, run: fn });

  return (
    <Dropdown
      trigger={
        trigger ?? (
          <button type="button" aria-label="Ações" className="grid h-8 w-8 place-items-center rounded-lg text-ink-tertiary transition hover:bg-elevated hover:text-ink-primary">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )
      }
    >
      <DropdownItem onSelect={() => run(user.isAdmin ? 'Admin removido' : 'Admin concedido', () => api.admin.setUserAdmin(user.id, !user.isAdmin))}>
        {user.isAdmin ? 'Remover admin' : 'Tornar admin'}
      </DropdownItem>
      {!user.emailVerified && (
        <DropdownItem onSelect={() => run('E-mail verificado', () => api.admin.verifyUserEmail(user.id))}>Verificar e-mail</DropdownItem>
      )}
      <DropdownItem
        className={user.suspended ? '' : 'text-danger hover:text-danger'}
        onSelect={() => {
          if (!user.suspended && !window.confirm(`Suspender ${user.email}? O usuário não conseguirá logar.`)) return;
          run(user.suspended ? 'Conta reativada' : 'Conta suspensa', () => api.admin.setUserSuspended(user.id, !user.suspended));
        }}
      >
        {user.suspended ? 'Reativar conta' : 'Suspender conta'}
      </DropdownItem>
      <div className="my-1 border-t border-hairline-subtle" />
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">Mudar plano</p>
      {PLANS.map((plan) => (
        <DropdownItem
          key={plan}
          className={cn('capitalize', user.plan === plan && 'text-[color:var(--accent-text)]')}
          onSelect={() => user.plan !== plan && run(`Plano alterado para ${plan}`, () => api.admin.setUserPlan(user.id, plan))}
        >
          {plan}
          {user.plan === plan ? ' ·' : ''}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
