import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso — ViralForge',
  description: 'Termos e condições de uso da plataforma ViralForge.',
};

const LAST_UPDATED = '3 de junho de 2026';
const COMPANY = 'ViralForge';
const CONTACT_EMAIL = 'legal@viralforge.app';

export default function TermsOfServicePage() {
  return (
    <main id="main-content" className="min-h-screen bg-base text-ink-primary">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-tertiary hover:text-ink-secondary">
            ← Voltar ao início
          </Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Legal</p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink-primary">Termos de Uso</h1>
          <p className="mt-3 text-sm text-ink-tertiary">Última atualização: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-ink-secondary [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-primary [&_strong]:text-ink-primary [&_a]:text-accent [&_a]:underline">

          <section>
            <p>
              Bem-vindo ao <strong>{COMPANY}</strong>. Ao criar uma conta ou usar qualquer funcionalidade da plataforma,
              você concorda com estes Termos de Uso (<strong>&ldquo;Termos&rdquo;</strong>). Se não concordar com qualquer parte destes
              Termos, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2>1. Sobre o Serviço</h2>
            <p>
              O {COMPANY} é uma plataforma SaaS que utiliza inteligência artificial para analisar vídeos longos e
              gerar cortes verticais otimizados para redes sociais. O serviço inclui transcrição automatizada,
              análise de conteúdo, renderização de vídeo e publicação em plataformas sociais.
            </p>
          </section>

          <section>
            <h2>2. Uso Aceitável</h2>
            <p>Você concorda em usar o {COMPANY} somente para fins legais. Você <strong>não pode</strong>:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Processar conteúdo que viola direitos autorais de terceiros sem autorização</li>
              <li>Usar o serviço para criar conteúdo ilegal, enganoso, difamatório ou que incite ódio</li>
              <li>Tentar contornar limites de quota ou abusar da API de forma automatizada</li>
              <li>Compartilhar credenciais de conta com terceiros</li>
              <li>Fazer engenharia reversa ou descompilar qualquer parte do serviço</li>
            </ul>
          </section>

          <section>
            <h2>3. Conteúdo do Usuário</h2>
            <p>
              Você mantém todos os direitos sobre o conteúdo que processa no {COMPANY}. Ao submeter conteúdo,
              você nos concede uma licença limitada, não exclusiva e revogável somente para processar e
              armazenar temporariamente o material necessário para prestação do serviço.
            </p>
            <p className="mt-3">
              <strong>Responsabilidade:</strong> Você é o único responsável por garantir que tem os direitos
              necessários sobre todo conteúdo submetido, incluindo vídeos obtidos via links externos.
            </p>
          </section>

          <section>
            <h2>4. Planos e Pagamentos</h2>
            <p>
              O {COMPANY} oferece planos gratuitos e pagos. Os planos pagos são cobrados mensalmente via
              Stripe. Você pode cancelar a qualquer momento no portal de faturamento — o acesso ao plano
              atual permanece ativo até o fim do período vigente.
            </p>
            <p className="mt-3">
              Não oferecemos reembolsos por períodos parciais, exceto onde exigido por lei. Em caso de
              problemas técnicos graves que impossibilitem o uso do serviço, avalie o contato com suporte
              antes de solicitar estorno.
            </p>
          </section>

          <section>
            <h2>5. Chaves de API de Terceiros (BYOK)</h2>
            <p>
              O {COMPANY} permite que você configure suas próprias chaves de API de provedores de IA (como
              OpenAI, DeepSeek etc.). Essas chaves são criptografadas antes do armazenamento e nunca
              compartilhadas. Você é responsável pelos custos gerados no seu provedor de IA pelo uso
              das suas chaves dentro da plataforma.
            </p>
          </section>

          <section>
            <h2>6. Limitação de Responsabilidade</h2>
            <p>
            O {COMPANY} é fornecido <strong>&ldquo;como está&rdquo;</strong>, sem garantias de disponibilidade contínua,
              precisão das transcrições ou qualidade dos cortes gerados pela IA. Em nenhuma circunstância
              nossa responsabilidade total excederá o valor pago por você nos últimos 3 meses de serviço.
            </p>
          </section>

          <section>
            <h2>7. Suspensão e Encerramento</h2>
            <p>
              Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos, sem aviso
              prévio em casos graves. Em suspensões por abuso de quota ou comportamento inadequado,
              notificaremos você por e-mail antes de ação permanente.
            </p>
          </section>

          <section>
            <h2>8. Alterações nos Termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Comunicaremos mudanças relevantes por e-mail
              com pelo menos 14 dias de antecedência. O uso continuado após esse prazo constitui
              aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2>9. Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis brasileiras. Eventuais disputas serão resolvidas no
              foro da comarca de São Paulo, SP, com renúncia expressa a qualquer outro.
            </p>
          </section>

          <section>
            <h2>10. Contato</h2>
            <p>
              Dúvidas sobre estes Termos? Entre em contato:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-hairline-subtle pt-8 flex gap-6 text-xs text-ink-tertiary">
          <Link href="/privacy" className="hover:text-ink-secondary">Política de Privacidade</Link>
          <Link href="/" className="hover:text-ink-secondary">Voltar ao início</Link>
        </div>
      </div>
    </main>
  );
}
