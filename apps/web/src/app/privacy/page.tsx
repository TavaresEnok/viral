import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade — ViralForge',
  description: 'Como o ViralForge coleta, usa e protege seus dados pessoais conforme a LGPD.',
};

const LAST_UPDATED = '3 de junho de 2026';
const COMPANY = 'ViralForge';
const CONTACT_EMAIL = 'privacidade@viralforge.app';
const DPO_EMAIL = 'dpo@viralforge.app';

export default function PrivacyPolicyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-base text-ink-primary">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-tertiary hover:text-ink-secondary">
            ← Voltar ao início
          </Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Legal · LGPD</p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink-primary">Política de Privacidade</h1>
          <p className="mt-3 text-sm text-ink-tertiary">Última atualização: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-ink-secondary [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-primary [&_strong]:text-ink-primary [&_a]:text-accent [&_a]:underline">

          <section>
            <p>
              Esta Política de Privacidade descreve como o <strong>{COMPANY}</strong> coleta, usa, armazena e protege
              seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais
              (<strong>LGPD — Lei 13.709/2018</strong>).
            </p>
          </section>

          <section>
            <h2>1. Quem Somos</h2>
            <p>
              O {COMPANY} é o controlador dos dados pessoais coletados por esta plataforma. Para exercer seus
              direitos ou tirar dúvidas, entre em contato com nosso Encarregado de Proteção de Dados (DPO):
              <a href={`mailto:${DPO_EMAIL}`} className="ml-1">{DPO_EMAIL}</a>
            </p>
          </section>

          <section>
            <h2>2. Dados que Coletamos</h2>
            <div className="mt-3 space-y-4">
              <div>
                <strong>Dados de conta:</strong>
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>Nome e endereço de e-mail (fornecidos no cadastro)</li>
                  <li>Hash da senha (nunca armazenamos a senha em texto plano)</li>
                  <li>Data de criação e última atividade da conta</li>
                </ul>
              </div>
              <div>
                <strong>Dados de uso:</strong>
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>Projetos criados, URLs de vídeos processados, transcrições geradas</li>
                  <li>Logs de atividade para segurança (tentativas de login, IPs de acesso)</li>
                  <li>Dados de telemetria de qualidade (scores de clips, métricas de pipeline)</li>
                </ul>
              </div>
              <div>
                <strong>Dados de pagamento:</strong>
                <p className="mt-1">
                  Informações de cartão de crédito são processadas diretamente pelo <strong>Stripe</strong> e nunca
                  passam pelos nossos servidores. Armazenamos apenas o ID de cliente Stripe e status da assinatura.
                </p>
              </div>
              <div>
                <strong>Chaves de API de terceiros (BYOK):</strong>
                <p className="mt-1">
                  Se você configurar chaves de API de provedores de IA, elas são criptografadas com AES-256
                  antes do armazenamento. Somente o sistema de processamento pode descriptografá-las durante
                  o uso e nunca são expostas em logs ou interfaces.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2>3. Como Usamos seus Dados</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Prestação do serviço:</strong> processamento de vídeos, geração de transcrições e clips</li>
              <li><strong>Autenticação e segurança:</strong> controle de acesso, detecção de fraude, proteção contra brute-force</li>
              <li><strong>Faturamento:</strong> gestão de assinaturas e verificação de quotas</li>
              <li><strong>Comunicações essenciais:</strong> e-mails de verificação, reset de senha e avisos de segurança</li>
              <li><strong>Melhoria do produto:</strong> análise de uso agregado e anônimo para aprimorar a plataforma</li>
            </ul>
            <p className="mt-3">
              <strong>Não vendemos seus dados</strong> a terceiros. Não usamos seus dados para treinar modelos de IA
              sem consentimento explícito.
            </p>
          </section>

          <section>
            <h2>4. Base Legal (LGPD)</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Execução de contrato</strong> — processamento necessário para prestação do serviço (Art. 7º, V)</li>
              <li><strong>Legítimo interesse</strong> — segurança, prevenção de fraude e melhoria do produto (Art. 7º, IX)</li>
              <li><strong>Cumprimento de obrigação legal</strong> — retenção de logs conforme exigências legais (Art. 7º, II)</li>
              <li><strong>Consentimento</strong> — envio de comunicações de marketing, quando aplicável (Art. 7º, I)</li>
            </ul>
          </section>

          <section>
            <h2>5. Retenção de Dados</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Dados de conta: mantidos enquanto a conta estiver ativa + 90 dias após exclusão</li>
              <li>Arquivos de vídeo temporários: excluídos após o processamento do projeto</li>
              <li>Clips renderizados: armazenados por 30 dias após a conclusão (configurável)</li>
              <li>Logs de segurança: retidos por 12 meses</li>
              <li>Dados de faturamento: conforme exigência fiscal (mínimo 5 anos)</li>
            </ul>
          </section>

          <section>
            <h2>6. Seus Direitos (LGPD, Art. 18)</h2>
            <p>Você tem direito a:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li><strong>Confirmação e acesso</strong> — saber quais dados temos sobre você</li>
              <li><strong>Correção</strong> — corrigir dados incompletos ou incorretos</li>
              <li><strong>Anonimização, bloqueio ou eliminação</strong> — de dados desnecessários ou tratados em desconformidade</li>
              <li><strong>Portabilidade</strong> — exportar seus dados em formato estruturado</li>
              <li><strong>Eliminação</strong> — exclusão completa da conta e todos os dados associados</li>
              <li><strong>Revogação de consentimento</strong> — para tratamentos baseados em consentimento</li>
              <li><strong>Informação sobre compartilhamento</strong> — com quais entidades seus dados são compartilhados</li>
            </ul>
            <p className="mt-3">
              Para exercer qualquer um desses direitos, envie solicitação para{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              Responderemos em até <strong>15 dias úteis</strong>.
            </p>
            <p className="mt-3">
              <strong>Exclusão de conta:</strong> Acesse Configurações → Conta → Excluir conta. Todos os seus dados
              serão permanentemente removidos em até 30 dias, exceto onde exigido por lei.
            </p>
          </section>

          <section>
            <h2>7. Compartilhamento com Terceiros</h2>
            <p>Compartilhamos dados apenas com:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Stripe</strong> — processamento de pagamentos (fora do Brasil, com cláusulas contratuais padrão)</li>
              <li><strong>Provedores de IA configurados por você</strong> — apenas quando você fornece sua própria chave BYOK</li>
              <li><strong>Sentry</strong> — monitoramento de erros (dados anonimizados, sem PII em stack traces)</li>
              <li><strong>Autoridades competentes</strong> — quando exigido por ordem judicial ou legal</li>
            </ul>
          </section>

          <section>
            <h2>8. Segurança</h2>
            <p>Implementamos medidas técnicas e organizacionais para proteger seus dados:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Transmissão criptografada via TLS 1.3</li>
              <li>Senhas armazenadas com hash bcrypt (fator 12)</li>
              <li>Chaves de API criptografadas com AES-256</li>
              <li>Tokens JWT de curta duração (15 minutos) com refresh token rotativo</li>
              <li>Rate limiting e proteção contra brute-force</li>
              <li>Backups automáticos cifrados do banco de dados</li>
            </ul>
          </section>

          <section>
            <h2>9. Cookies e Rastreamento</h2>
            <p>
              Usamos cookies estritamente necessários para autenticação (refresh token HttpOnly). Não usamos
              cookies de rastreamento publicitário. Ferramentas de analytics (como PostHog) são configuradas
              para respeitar sinais de &ldquo;Não rastrear&rdquo; e anonimizar IPs.
            </p>
          </section>

          <section>
            <h2>10. Alterações nesta Política</h2>
            <p>
              Comunicaremos mudanças relevantes por e-mail com pelo menos 14 dias de antecedência.
              A data de &ldquo;Última atualização&rdquo; no topo desta página sempre refletirá a versão atual.
            </p>
          </section>

          <section>
            <h2>11. Contato e DPO</h2>
            <p>
              Encarregado de Proteção de Dados (DPO):{' '}
              <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>
              <br />
              Suporte de privacidade:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
            <p className="mt-3">
              Você também pode registrar reclamações na{' '}
              <strong>ANPD — Autoridade Nacional de Proteção de Dados</strong>{' '}
              em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-hairline-subtle pt-8 flex gap-6 text-xs text-ink-tertiary">
          <Link href="/terms" className="hover:text-ink-secondary">Termos de Uso</Link>
          <Link href="/" className="hover:text-ink-secondary">Voltar ao início</Link>
        </div>
      </div>
    </main>
  );
}
