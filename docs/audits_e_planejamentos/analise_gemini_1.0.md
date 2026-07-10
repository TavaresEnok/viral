# Análise de Ponta a Ponta do ViralForge (Estado Atual)

O ViralForge possui uma base arquitetural muito sólida (Monorepo, Node.js/NestJS, Next.js 14, BullMQ), o que demonstra que foi construído para escalar. O pipeline que vai da extração do áudio (FFmpeg) passando pela IA de duas passagens (LLM DeepSeek/OpenAI) até a renderização já é totalmente funcional. 

No entanto, o projeto encontra-se na fase de **MVP Avançado**. Abaixo estão as **notas e o diagnóstico de cada característica chave**:

### 🛡️ Segurança: Nota 4.0/10 (Risco Alto)
* **O que tem de bom:** Autenticação via JWT implementada, senhas com bcrypt, criptografia AES-256-GCM para as chaves de API dos provedores de IA.
* **Problemas Críticos:** Ausência total de *Rate Limiting* (proteção contra abuso de API/brute force). Existe uma vulnerabilidade grave de *Path Traversal* no download de vídeos, falta de limpeza de arquivos órfãos (consumindo armazenamento) e armazenamento inseguro do JWT no *localStorage* do frontend.

### 🎨 UI (Interface do Usuário): Nota 7.5/10 (Boa)
* **O que tem de bom:** O Design System usando Tailwind é consistente. A página de processamento (timeline) é excelente visualmente, os dashboards são limpos e modernos (Grid com busca, filtros, toggle).
* **Problemas Críticos:** Várias páginas (Billing, Brand Kit, Analytics) são apenas "mocks" (interfaces falsas sem backend conectado).

### 🧠 UX (Experiência do Usuário): Nota 6.5/10 (Razoável)
* **O que tem de bom:** Fluxo intuitivo para criar um projeto e editor profissional funcional. A interface não confunde o usuário.
* **Problemas Críticos:** O front-end faz *polling* HTTP a cada 3 segundos em vez de usar WebSockets (pesado e ineficiente). Uploads grandes bloqueiam a API (uso de funções síncronas de disco), e a falta de publicação social obriga o usuário a baixar o vídeo e postar manualmente.

### ⚙️ Funcionalidade Core (IA & Cortes): Nota 8.0/10 (Excelente Base)
* **O que tem de bom:** A arquitetura LLM de "2 passagens" (Pass 1 pré-seleciona, Pass 2 avalia e pontua contextualmente) é **acima da média do mercado**. O sistema entende PT-BR nativamente.
* **Problemas Críticos:** Não possui *Face Tracking* ativo (reframe automático inteligente), o que faz com que os cortes 9:16 sejam apenas um recorte estático do centro.

### 🎬 Funcionalidade de Edição (Legendas e B-Roll): Nota 3.5/10 (Fraca)
* **O que tem de bom:** Já suporta renderização de 4 layouts e legendas em formato ASS.
* **Problemas Críticos:** Falta renderização de legendas animadas palavra por palavra (Kinetic Typography) — essencial para retenção hoje. Zero suporte a B-Rolls automáticos ou inserção inteligente de imagens de apoio.

---

## Comparativo de Mercado e Ranking Final

Abaixo, avaliamos o ViralForge contra os principais concorrentes usando 10 dimensões de 0 a 10. O Opus Clip lidera pela maturidade na IA e ferramentas visuais.

| # | Ferramenta | IA Clips | Legendas Animadas | Face Tracking | B-Roll / Imagens | Virality Score | Publicação / Cloud | UX Geral | **NOTA FINAL** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Opus Clip** | 9.5 | 8.5 | 9.5 | 9.0 | 9.5 | 9.5 | 9.0 | **8.9** |
| 2 | **Submagic** | 8.0 | 9.8 | 7.5 | 8.5 | 7.0 | 8.5 | 9.0 | **8.1** |
| 3 | **Vidyo.ai** | 8.5 | 8.0 | 8.5 | 7.0 | 8.0 | 8.0 | 8.0 | **7.9** |
| 4 | **Vizard.ai** | 8.0 | 7.5 | 8.0 | 7.0 | 7.0 | 8.0 | 8.0 | **7.8** |
| 5 | **2short.ai** | 7.5 | 7.0 | 7.5 | 5.0 | 6.5 | 7.0 | 7.5 | **6.9** |
| 6 | **AutoCaption**| 3.0 | 8.5 | 5.0 | 4.0 | 2.0 | 7.0 | 7.5 | **5.7** |
| **7**| **ViralForge (Atual)**| **7.0** | **3.5** | **1.0** | **0.0** | **6.5** | **1.5** | **6.0** | **3.9** |

---

## O Que Falta para o ViralForge Chegar em 1º Lugar?

O fato de estar com nota **3.9** não significa que a arquitetura seja ruim, mas sim que os recursos vitais que encantam o usuário final (efeitos visuais e workflow) ainda não estão concluídos. O motor (API/Worker) é muito potente, mas a "carroceria" precisa evoluir. 

Para desbancar o **Opus Clip** e o **Submagic**, é necessário atacar a renderização (Remotion), a visão computacional (Face tracking) e corrigir os débitos técnicos críticos de infraestrutura.

#################

# Planejamento Estratégico para Liderança de Mercado

Abaixo está o detalhamento de tudo que precisa ser construído, dividido em fases incrementais e com checklists. O objetivo é transformar o ViralForge no sistema #1 de cortes virais.

## Fase 1: Blindagem e Escalabilidade (Correções Críticas)
**Objetivo:** Preparar a base do sistema para receber milhares de usuários simultâneos sem vazamento de dados, quebras ou alto custo de servidores.

- [ ] **Segurança da API e Autenticação:**
  - [ ] Implementar `@nestjs/throttler` em endpoints de auth e rotas principais (limite de requests por IP/minuto).
  - [ ] Corrigir falha de Path Traversal no controller de downloads validando diretórios com `path.resolve`.
  - [ ] Mover o armazenamento do JWT no front-end do `localStorage` para cookies `httpOnly`.
  - [ ] Limpar `secrets` e senhas fixadas em código, garantindo uso exclusivo de variáveis de ambiente no formato correto.
- [ ] **Otimização de Armazenamento e Upload:**
  - [ ] Migrar funções síncronas de gravação em disco (`renameSync`) para funções assíncronas do sistema de arquivos (`fs.promises`).
  - [ ] Implementar validação real de Magic Bytes nos arquivos (não confiar apenas no mime type de cabeçalho).
  - [ ] Desenvolver CRON Job para remoção de arquivos `.temp` órfãos (arquivos não finalizados ou projetos deletados).
- [ ] **Resiliência do Worker:**
  - [ ] Implementar Dead Letter Queue (Fila Morta) no BullMQ para jobs com falha.
  - [ ] Criar WebSockets para reportar progresso de extração e transcrição para o Front-end, eliminando *polling* HTTP.

## Fase 2: Motor de Renderização Revolucionário (Remotion & Visuals)
**Objetivo:** Produzir cortes visivelmente superiores aos dos concorrentes usando renderização animada no backend.

- [ ] **Migração Base para Remotion:**
  - [ ] Configurar o `@remotion/renderer` dentro do Worker como alternativa primária ao FFmpeg.
  - [ ] Criar a composição base VerticalClip (1080x1920) reproduzindo cortes via Remotion com a mesma performance e sem erro de sincronização de áudio.
- [ ] **Legendas Word-Level Animadas (Kinetic Typography):**
  - [ ] Atualizar as requisições Whisper para extrair `word_timestamps=true`.
  - [ ] Desenvolver componentes de texto animados no Remotion (Highlight da palavra atual, Pop-up, Typewriter).
- [ ] **Biblioteca de Temas e Emojis:**
  - [ ] Criar pelo menos 5 temas premium iniciais (Neon Glow, Hormozi Bold, Minimalist, Gradient, Bar).
  - [ ] Implementar `EmojiSuggestionService` via IA: lê a frase e sobrepõe emojis 3D ou animados na tela durante a fala.

## Fase 3: Visão Computacional Avançada (Smart Face Tracking)
**Objetivo:** Permitir que vídeos horizontais comuns virem conteúdos verticais dinâmicos.

- [ ] **Rastreamento de Rosto Básico:**
  - [ ] Integrar MediaPipe para detecção facial frame a frame.
  - [ ] Gerar os dados espaciais (coordenadas) e salvar no JSON de metadados do clip.
- [ ] **Active Speaker Detection (Diarização):**
  - [ ] Implementar correlação de áudio e visual para identificar quem está com lábios em movimento ou detectar quem fala através do som.
- [ ] **Auto-Reframe Inteligente:**
  - [ ] Adicionar suavização (easing) no corte de tela para que a câmera vertical acompanhe o rosto sem pulos rudes.
  - [ ] Criar Layout `SPLIT_SCREEN` (Telas divididas dinâmicas para vídeos estilo podcast com 2 rostos visíveis simultaneamente).

## Fase 4: O Workflow do Criador de Conteúdo (Produto Final)
**Objetivo:** Eliminar trabalho manual do usuário entregando a ele postagens diretas.

- [ ] **Inteligência Artificial (Virality e B-Roll):**
  - [ ] A IA deve varrer picos de áudio e expressões fortes no rosto para incrementar o `Virality Score`.
  - [ ] A IA pesquisa conceitos em APIs públicas (Pexels) e sobrepõe vídeos B-Roll durante momentos em que não há rosto principal na tela (apenas locução).
- [ ] **Editor Web Completo:**
  - [ ] Construir editor de vídeo *Text-Based*: onde o usuário exclui uma frase do texto e isso remove a parte correspondente do vídeo sem gastar tokens.
  - [ ] Implementar as telas (atualmente mocks) de Analytics, Brand Kit e Settings finais.
- [ ] **Postagem Direta para Redes (Publish):**
  - [ ] Integrar OAuth APIs para envio final.
  - [ ] Botões para exportar / Agendar no TikTok, YouTube Shorts e Instagram Reels, preenchendo as legendas, título e tags previamente geradas pela IA.
