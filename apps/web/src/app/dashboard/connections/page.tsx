'use client';

import { SocialAccountsManager } from '@/components/publish/SocialAccountsManager';

export default function ConnectionsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-1 py-2 md:px-4 md:py-4">
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">publique direto pelo ViralForge</p>
        <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Redes conectadas</h1>
        <p className="mt-2 text-body text-ink-secondary">
          Conecte suas contas para postar os cortes direto daqui, sem baixar e subir na mão.
        </p>
      </div>

      <SocialAccountsManager />
    </div>
  );
}
