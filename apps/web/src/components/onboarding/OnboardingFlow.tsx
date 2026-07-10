'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, Upload, Activity, Download, CheckCircle2, X } from 'lucide-react';

export function OnboardingFlow() {
  const [isOpen, setIsOpen] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    keys: false,
    upload: false,
    pipeline: false,
    download: false,
  });

  // Simulated logic - in a real app, check API data or local storage
  useEffect(() => {
    const keysSet = localStorage.getItem('onboarding_keys') === 'true';
    const uploadDone = localStorage.getItem('onboarding_upload') === 'true';
    const pipelineDone = localStorage.getItem('onboarding_pipeline') === 'true';
    const downloadDone = localStorage.getItem('onboarding_download') === 'true';
    
    setCompletedSteps({
      keys: keysSet,
      upload: uploadDone,
      pipeline: pipelineDone,
      download: downloadDone,
    });
  }, []);

  const steps = [
    {
      id: 'keys',
      title: 'Configurar API Keys',
      description: 'Conecte sua IA para análises.',
      icon: Key,
      link: '/dashboard/settings',
    },
    {
      id: 'upload',
      title: 'Enviar Primeiro Vídeo',
      description: 'Faça upload do seu conteúdo.',
      icon: Upload,
      link: '/dashboard',
    },
    {
      id: 'pipeline',
      title: 'Acompanhar Pipeline',
      description: 'Veja os cortes sendo gerados.',
      icon: Activity,
      link: '/dashboard',
    },
    {
      id: 'download',
      title: 'Baixar Primeiro Corte',
      description: 'Baixe e publique seu vídeo.',
      icon: Download,
      link: '/dashboard',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-xl border border-hairline-subtle bg-surface">
      <div className="flex items-center justify-between border-b border-hairline-subtle bg-surface-subtle px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">Bem-vindo ao ViralForge</h2>
          <p className="text-sm text-ink-secondary">Siga estes passos para extrair o melhor da plataforma.</p>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-ink-tertiary hover:text-ink-primary">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid divide-y divide-hairline-subtle md:grid-cols-4 md:divide-x md:divide-y-0">
        {steps.map((step, idx) => {
          const isDone = completedSteps[step.id];
          const Icon = isDone ? CheckCircle2 : step.icon;
          return (
            <Link key={step.id} href={step.link} className={`flex flex-col gap-3 p-6 transition hover:bg-elevated/40 ${isDone ? 'opacity-50' : ''}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isDone ? 'bg-accent/10 text-[color:var(--accent-text)]' : 'bg-accent/10 text-accent'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink-primary">
                  {idx + 1}. {step.title}
                </h3>
                <p className="mt-1 text-xs text-ink-secondary">{step.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
