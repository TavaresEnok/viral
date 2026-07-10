import Link from 'next/link';
import { AlertTriangle, Key, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata = {
  title: 'Modo Fallback Ativo — ViralForge',
};

export default function FallbackModePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-hairline-subtle bg-elevated shadow-xl">
        <div className="bg-amber-500/10 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-primary">Modo Fallback Ativo</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            O ViralForge está operando sem integrações de IA externas configuradas.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-ink-primary">O que isso significa?</h2>
            <div className="rounded-lg border border-hairline-subtle bg-surface p-4 text-sm text-ink-secondary">
              <p>
                Sem uma chave de API (como OpenAI ou DeepSeek), o sistema ativará o modo de testes interno. O pipeline de renderização e corte de vídeos <strong>continuará funcionando</strong> para que você possa testar o sistema.
              </p>
              <p className="mt-2">
                No entanto, a qualidade das legendas, as notas de viralidade e os momentos escolhidos serão básicos e não usarão a nossa inteligência avançada.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-ink-primary">O que você pode fazer</h2>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-lg border border-hairline-subtle p-3">
                <Cpu className="mt-0.5 h-5 w-5 text-ink-tertiary" />
                <div>
                  <p className="text-sm font-medium text-ink-primary">Continuar testando (Modo Local)</p>
                  <p className="text-xs text-ink-secondary">Você pode fechar esta página e continuar testando a plataforma normalmente com as limitações descritas.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-hairline-subtle bg-accent/5 p-3">
                <Key className="mt-0.5 h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-medium text-ink-primary">Configurar Chaves de API</p>
                  <p className="text-xs text-ink-secondary">Para ter a experiência completa do ViralForge, configure suas chaves de API nas configurações da sua conta.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-hairline-subtle bg-surface-subtle p-6">
          <Link href="/dashboard" className="flex-1">
            <Button variant="secondary" className="w-full">
              Continuar Testando
            </Button>
          </Link>
          <Link href="/dashboard/settings" className="flex-1">
            <Button variant="primary" className="w-full">
              Configurar APIs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
