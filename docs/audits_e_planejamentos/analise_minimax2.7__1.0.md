# Análise Competitiva Completa: CLIPIA vs Concorrentes

**Data:** 2026-05-21
**Versão:** 1.0
**Analisado por:** MiniMax-M2.7
**Sistema:** CLIPIA / ViralForge

---

## 📊 Ranking Geral (Escala 0-10)

| # | Ferramenta | Nota Final | Tendência |
|---|---|---|---|
| 🥇 1 | **Opus Clip** | **9.0** | Líder absoluto |
| 🥈 2 | **Submagic** | **8.3** | Forte em legendas animadas |
| 🥉 3 | **Vizard.ai** | **8.0** | Melhor custo-benefício |
| 4 | **Vidyo.ai/Quso** | **7.9** | Sólido, sem diferenciais |
| 5 | **ClipSpeedAI** | **7.5** | Novo, Twitch/Kick nativo |
| 6 | **2short.ai** | **6.5** | Opção econômica |
| 7 | **CLIPIA (ViralForge)** | **4.5** | 🚨 Open source em desenvolvimento |
| 8 | **AutoCaption** | **5.0** | Básico, caption apenas |

---

## 📋 Análise Detalhada por Característica

### 1. DETECÇÃO DE MOMENTOS VIRAIS (IA Clipping)

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Opus Clip | **9.5** | Gen-4 AI, ClipAnything para qualquer gênero, 16M+ usuários |
| 2 | ClipSpeedAI | **8.8** | GPT-4o viral moment detection |
| 3 | Vidyo.ai | **8.5** | Bom destaque automático |
| 4 | Vizard.ai | **8.0** | 10-30 clips por vídeo com score |
| 5 | CLIPIA | **7.5** | ✅ DeepSeek LLM Analysis - bom, mas sem ClipAnything |
| 6 | Submagic | **7.5** | Focado em shorts já gravados |
| 7 | 2short.ai | **7.0** | Básico |
| 8 | AutoCaption | **3.0** | Sem IA de detecção |

**CLIPIA:** A análise por LLM DeepSeek é competente, mas falta a habilidade de detectar por gênero (podcasts, vlogs, gaming).

---

### 2. LEGENDAS ANIMADAS (Captioning)

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Submagic | **9.8** | 30+ estilos animados, word-by-word highlight, emojis |
| 2 | Opus Clip | **8.5** | Bons estilos, mas menos variedade |
| 3 | ClipSpeedAI | **8.5** | 14+ templates animados |
| 4 | Vizard.ai | **8.0** | 30+ idiomas, boa qualidade |
| 5 | Vidyo.ai | **8.0** | Múltiplos estilos |
| 6 | **CLIPIA** | **4.0** | ⚠️ Legendas ASS estáticas, sem word-highlight |
| 7 | 2short.ai | **6.5** | Legendas básicas |
| 8 | AutoCaption | **8.0** | Forte em legendas, fraco em IA |

**CLIPIA:** O maior GAP visual. Remotion está implementado mas não está sendo usado para legendas animadas.

---

### 3. FACE TRACKING / AUTO-REFRAME

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Opus Clip | **9.8** | AI object tracking, identity lock, 9:16/1:1/16:9 |
| 2 | ClipSpeedAI | **8.5** | AI identity lock, mantém speaker certo |
| 3 | Vizard.ai | **8.0** | Speaker tracking bom para 1 pessoa |
| 4 | Vidyo.ai | **8.0** | Auto reframe funcional |
| 5 | **CLIPIA** | **2.0** | 🚨 Fake face tracking - usa posição do speaker do transcript |
| 6 | Submagic | **5.0** | ❌ Sem face tracking |
| 7 | 2short.ai | **6.0** | Básico |
| 8 | AutoCaption | **4.0** | Nenhum |

**CLIPIA:** O `FaceDetectionService` atual apenas mapeia posições de speaker ("HOST", "CONVIDADO") baseado na transcrição - **não detecta rostos reais via ML**.

---

### 4. B-ROLL AUTOMÁTICO

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Opus Clip | **9.5** | AI B-Roll contextuais |
| 2 | Submagic | **9.0** | Magic B-Roll com transições e SFX |
| 3 | Vizard.ai | **8.0** | B-Roll com AI |
| 4 | Vidyo.ai | **7.0** | Básico |
| 5 | **CLIPIA** | **0.0** | ❌ Não implementado |
| 6 | 2short.ai | **3.0** | Nenhum |
| 7 | ClipSpeedAI | **6.0** | Limitado |
| 8 | AutoCaption | **2.0** | Nenhum |

**CLIPIA:** Gap crítico. B-Roll quebra monotonia de talking heads.

---

### 5. VIRALITY SCORE

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Opus Clip | **9.5** | Score 1-99, baseado em NLP + features |
| 2 | ClipSpeedAI | **9.0** | GPT-4o based |
| 3 | Vizard.ai | **8.0** | AI virality score |
| 4 | Vidyo.ai | **8.0** | Bom |
| 5 | **CLIPIA** | **7.5** | ✅ DeepSeek compositeScore (closing_strength, hooks, energi |
| 6 | Submagic | **7.0** | Moderado |
| 7 | 2short.ai | **6.0** | Básico |
| 8 | AutoCaption | **2.0** | Nenhum |

**CLIPIA:** Bom sistema, mas poderia incluir análise de energia de áudio e expressões faciais.

---

### 6. EDITOR PÓS-PROCESSAMENTO

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Vizard.ai | **9.0** | Text-based editing, editor completo |
| 2 | Opus Clip | **8.0** | Editor básico, mas funcional |
| 3 | Submagic | **8.0** | 3-click editing |
| 4 | ClipSpeedAI | **7.5** | Editor focado em clipping |
| 5 | **CLIPIA** | **6.0** | ⚠️ Editor básico com trim manual |
| 6 | Vidyo.ai | **7.0** | Moderado |
| 7 | 2short.ai | **6.0** | Limitado |
| 8 | AutoCaption | **5.0** | Apenas caption |

**CLIPIA:** Editor existe mas falta text-based editing (editar vídeo via transcrição).

---

### 7. PUBLICAÇÃO & WORKFLOW

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Opus Clip | **9.0** | Auto-post TikTok, Instagram, YouTube |
| 2 | Vizard.ai | **8.5** | 20 contas sociais, agendamento |
| 3 | Submagic | **8.0** | Integração com schedulers |
| 4 | Vidyo.ai | **8.0** | Multi-platform |
| 5 | ClipSpeedAI | **7.5** | Pub simplificado |
| 6 | **CLIPIA** | **4.0** | ⚠️ Apenas YouTube, sem agendamento |
| 7 | 2short.ai | **5.5** | Limitado |
| 8 | AutoCaption | **4.0** | Nenhum |

**CLIPIA:** `PublishService` existe para YouTube, mas TikTok/Instagram não implementados.

---

### 8. INFRAESTRUTURA CLOUD

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Opus Clip | **9.5** | SaaS completo, API robusta |
| 2 | Submagic | **8.5** | Cloud nativo |
| 3 | Vizard.ai | **8.5** | Managed, escalável |
| 4 | Vidyo.ai | **8.0** | Bom |
| 5 | ClipSpeedAI | **7.5** | Cloud |
| 6 | **CLIPIA** | **2.5** | 🚨 100% local (Docker Compose) |
| 7 | 2short.ai | **6.0** | Cloud básico |
| 8 | AutoCaption | **6.0** | Cloud |

**CLIPIA:** Arquitetura pronta para cloud (monorepo, BullMQ, Prisma) mas sem deploy.

---

### 9. UX / DESIGN

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | Submagic | **9.2** | UI polida, creator-focused |
| 2 | Opus Clip | **9.0** | Limpa, intuitiva |
| 3 | Vizard.ai | **8.0** | Boa, mas menos polida |
| 4 | ClipSpeedAI | **7.5** | Funcional |
| 5 | Vidyo.ai | **7.5** | Moderada |
| 6 | **CLIPIA** | **5.5** | ⚠️ Protótipo, precisa de polish |
| 7 | 2short.ai | **7.0** | Simples |
| 8 | AutoCaption | **6.5** | Básica |

**CLIPIA:** Dashboard existe com Next.js/Shadcn, mas precisa de onboarding e polish.

---

### 10. PREÇO / CUSTO-BENEFÍCIO

| # | Ferramenta | Nota | Análise |
|---|---|---|---|
| 1 | **CLIPIA** | **10.0** | ✅ Open source, gratuito |
| 2 | AutoCaption | **8.5** | Freemium honesto |
| 3 | Vizard.ai | **8.5** | $16.5/mois com 42% off |
| 4 | 2short.ai | **8.0** | Acessível |
| 5 | ClipSpeedAI | **7.5** | $15/mo |
| 6 | Vidyo.ai | **7.0** | ~$15/mo |
| 7 | Submagic | **7.0** | ~$19/mo |
| 8 | Opus Clip | **6.5** | $19-59/mo, free limitado |

**CLIPIA:** Único que é open source. Excelente para quem quer self-host.

---

## 🔴 GAPs CRÍTICOS DO CLIPIA (O que falta para chegar ao Top 3)

### Gap 1: Face Tracking Real (Atual: 2.0 → Meta: 8.5)

```
ESTADO ATUAL: FaceDetectionService usa posições fixas de speaker
REQUISITO: MediaPipe Face Detection + Active Speaker Detection
IMPACTO: -7.5 pontos
```

**Solução:** Integrar MediaPipe para detecção real de faces + Pyannote.audio para diarização

---

### Gap 2: Legendas Animadas Word-by-Word (Atual: 4.0 → Meta: 9.5)

```
ESTADO ATUAL: RemotionRenderService existe mas não gera legendas animadas
REQUISITO: AnimatedCaption component com word-level highlight
IMPACTO: -5.5 pontos
```

**Solução:** Componente Remotion `<AnimatedCaption>` com 6+ estilos de animação

---

### Gap 3: B-Roll Automático (Atual: 0.0 → Meta: 8.0)

```
ESTADO ATUAL: Não existe
REQUISITO: Inserção de imagens/vídeos contextuais
IMPACTO: -8.0 pontos
```

**Solução:** BRollService com LLM para identificar conceitos + Pexels API

---

### Gap 4: Multi-Platform Publishing (Atual: 4.0 → Meta: 8.5)

```
ESTADO ATUAL: Apenas YouTube
REQUISITO: TikTok, Instagram Reels, Facebook
IMPACTO: -4.5 pontos
```

**Solução:** Integrar TikTok Content Posting API + Instagram Graph API

---

### Gap 5: Cloud Deployment (Atual: 2.5 → Meta: 8.0)

```
ESTADO ATUAL: 100% local (Docker Compose)
REQUISITO: SaaS deployable (Railway/Fly.io + R2 + Neon)
IMPACTO: -5.5 pontos
```

**Solução:** Container + CI/CD + managed services

---

## 📈 PLANO DE IMPLEMENTAÇÃO RECOMENDADO

| Prioridade | Feature | Pontos Ganhos | Esforço | Resultado |
|---|---|---|---|---|
| 🔴 P0 | Word-level animated captions | +5.5 | Médio | 4.5 → **7.0** |
| 🔴 P0 | Real face tracking (MediaPipe) | +6.5 | Alto | 7.0 → **8.5** |
| 🟡 P1 | B-Roll automático | +4.0 | Médio | 8.5 → **9.0** |
| 🟡 P1 | Multi-platform publishing | +4.5 | Médio | 9.0 → **9.5** |
| 🟢 P2 | Cloud deployment | +5.5 | Alto | 9.5 → **9.8** |

---

## ✅ RESUMO: VANTAGENS COMPETITIVAS DO CLIPIA

| Pontos Fortes | Descrição |
|---|---|
| 🆓 **Open Source** | Único com código aberto, self-hosting |
| 🧠 **LLM Analysis** | DeepSeek para análise semântica de clips |
| 🏗️ **Arquitetura** | Monorepo bem estruturado, BullMQ, Prisma |
| 🔐 **Segurança** | JWT, API keys criptografadas, RLS |
| 💰 **Preço** | 100% gratuito para self-host |

---

## 🚨 RESUMO: O QUE IMPEDIR DE CHEGAR NO TOP 3

| # | Gap | Impacto | Concorrentes que já têm |
|---|---|---|---|
| 1 | Face tracking real | **-7.5** | Opus, Vizard, Vidyo |
| 2 | Legendas animadas word-level | **-5.5** | Submagic, Opus |
| 3 | B-Roll automático | **-8.0** | Opus, Submagic |
| 4 | Cloud deploy | **-5.5** | Todos |
| 5 | Multi-platform publish | **-4.5** | Opus, Vizard |

---

## 🎯 CONCLUSÃO

O **CLIPIA (ViralForge)** está atualmente em **7º lugar** com nota **4.5/10**, aproximadamente **5 pontos atrás do líder Opus Clip**.

### 📊 Score Atual vs Necessário

```
CLIPIA ATUAL:    ████████████████░░░░░░░░░░░░░░░░░░░  4.5/10

META TOP 3:      ████████████████████████████████░░  8.5/10

LÍDER (Opus):    █████████████████████████████████  9.0/10
```

### 🚀 Caminho para o Top 3 (Estimativa: 3-4 meses)

1. **Word-level animated captions** → +5.5 pontos
2. **Real face tracking (MediaPipe)** → +6.5 pontos
3. **B-Roll automático** → +4.0 pontos
4. **Multi-platform publish** → +4.5 pontos
5. **Cloud deployment** → +5.5 pontos

### 💡 Vantagem Competitiva do CLIPIA

O CLIPIA é **open source** - nenhum concorrente oferece isso. Se os gaps de features forem resolvidos, será o **único sistema self-hostable** com qualidade de produção, o que é um diferencial enorme para:

- Empresas que querem privacidade de dados
- Agências que querem controlar sua infraestrutura
- Desenvolvedores que querem customizar

---

## 📚 Referências

- Opus Clip: https://www.opus.pro
- Submagic: https://www.submagic.co
- Vizard.ai: https://vizard.ai
- Vidyo.ai: https://vidyo.ai
- ClipSpeedAI: https://clipspeed.ai
- 2short.ai: https://2short.ai

---

################################################################################

# 🗺️ PLANEJAMENTO DETALHADO DE IMPLEMENTAÇÃO

**Versão do Planejamento:** 1.0
**Estimativa Total:** 12-16 semanas
**Meta:** Atingir nota 8.5+ (Top 3)

---

## FASE 1 — MOTOR DE LEGENDAS ANIMADAS (Word-Level Captions)

**Objetivo:** Substituir legendas ASS estáticas por legendas animadas word-by-word
**Impacto:** +5.5 pontos (4.0 → 7.0)
**Duração Estimada:** 3-4 semanas
**Prioridade:** 🔴 P0

### 1.1 — Configuração do Remotion para Captions

- [ ] **1.1.1** Instalar `@remotion/bundler` e `@remotion/renderer` no worker
- [ ] **1.1.2** Configurar `bundle()` para compilar `packages/render-engine`
- [ ] **1.1.3** Criar composition `AnimatedCaption` em `packages/render-engine/src`
- [ ] **1.1.4** Definir schema de props: `WordSegment { word, start, end, confidence }`
- [ ] **1.1.5** Configurar `renderMedia()` no worker com `serveUrl` do bundle
- [ ] **1.1.6** Testar renderização básica de caption estática via Remotion
- [ ] **1.1.7** Implementar fallback para FFmpeg caso Remotion falhe

### 1.2 — Componente AnimatedCaption

- [ ] **1.2.1** Criar componente `<AnimatedCaption>` com timeline-based animation
- [ ] **1.2.2** Implementar prop `currentTime` para highlight da palavra atual
- [ ] **1.2.3** Adicionar 6 estilos de animação:
  - [ ] Fade-in (opacidade 0→1)
  - [ ] Scale-bounce (scale 0.8→1.1→1.0)
  - [ ] Color-swap (cor de fundo destacada)
  - [ ] Underline-sweep (linha debaixo da palavra)
  - [ ] Pop-up (translateY + scale)
  - [ ] Typewriter (caracter por caracter)
- [ ] **1.2.4** Adicionar `easing` e `duration` configuráveis por tema
- [ ] **1.2.5** Implementar suporte a múltiplas linhas
- [ ] **1.2.6** Testar em vídeos com 30+ segundos de fala contínua

### 1.3 — Transcrição Word-Level

- [ ] **1.3.1** Modificar `TranscriptionService` para ativar `word_timestamps=true`
- [ ] **1.3.2** Criar schema `WordSegment { word, start, end, confidence }`
- [ ] **1.3.3** Atualizar pipeline para extrair words da resposta Whisper
- [ ] **1.3.4** Armazenar words no modelo `TranscriptSegment`
- [ ] **1.3.5** Testar precisão de timestamps em 10 vídeos diversos

### 1.4 — Sistema de Temas Premium

- [ ] **1.4.1** Criar enum `CaptionAnimationStyle` com 6 opções
- [ ] **1.4.2** Definir 10 temas de caption:
  - [ ] `NEON_GLOW` — texto branco com glow neon
  - [ ] `HORMOZI_BOLD` — amarelo/branco forte, scale-bounce
  - [ ] `CLEAN_PRO` — minimalista, Inter, fade suave
  - [ ] `CREATOR_GRADIENT` — gradiente animado no texto
  - [ ] `PODCAST_SPLIT` — layout com 2 linhas
  - [ ] `STORY_MODE` — texto grande centralizado
  - [ ] `SUBTITLE_BAR` — barra semitransparente inferior
  - [ ] `KARAOKE` — preenchimento progressivo por palavra
  - [ ] `OUTLINE_POP` — outline grosso com sombra 3D
  - [ ] `EMOJI_REACT` — emojis contextuais animados
- [ ] **1.4.3** Criar preview estático (thumbnail) para cada tema
- [ ] **1.4.4** Implementar seletor de tema na UI
- [ ] **1.4.5** Testar legibilidade em fundo claro e escuro

### 1.5 — Auto-Emoji Contextual

- [ ] **1.5.1** Criar `EmojiSuggestionService` com integração LLM
- [ ] **1.5.2** Implementar prompt para mapear frases → emojis
- [ ] **1.5.3** Criar componente `<FloatingEmoji>` no Remotion
- [ ] **1.5.4** Limitar 1 emoji a cada 5 segundos
- [ ] **1.5.5** Testar relevância contextual em 80%+ dos casos

### Checklist de Gate — Fase 1

- [ ] Caption word-by-word renderiza em < 10s para clip de 45s
- [ ] 6 estilos de animação funcionais
- [ ] 10 temas premium com preview
- [ ] Legendas legíveis em fundo claro e escuro
- [ ] Emojis aparecem contextualmente corretos em 80%+ dos casos

---

## FASE 2 — FACE TRACKING REAL (Computer Vision)

**Objetivo:** Implementar detecção facial real via ML, não posições fixas de speaker
**Impacto:** +6.5 pontos (2.0 → 8.5)
**Duração Estimada:** 4-5 semanas
**Prioridade:** 🔴 P0

### 2.1 — MediaPipe Face Detection

- [ ] **2.1.1** Instalar `@mediapipe/face_detection` no worker
- [ ] **2.1.2** Criar `MediaPipeFaceService` em `apps/worker/src/services`
- [ ] **2.1.3** Implementar detecção por frame (1 frame a cada 0.5s)
- [ ] **2.1.4** Definir schema `FaceBox { time, x, y, width, height, confidence }`
- [ ] **2.1.5** Processar vídeo de 60s em < 30s
- [ ] **2.1.6** Tratar casos com 1-3 rostos detectados
- [ ] **2.1.7** Testar em vídeos com rostos parciais/角度多样的

### 2.2 — Active Speaker Detection

- [ ] **2.2.1** Criar `ActiveSpeakerService` com Pyannote.audio ou similar
- [ ] **2.2.2** Implementar diarização de speaker (quem está falando quando)
- [ ] **2.2.3** Cruzar dados de face com áudio para identificar speaker ativo
- [ ] **2.2.4** Criar timeline `activeSpeakerTimeline`
- [ ] **2.2.5** Testar identificação correta em 85%+ em vídeos com 2 pessoas
- [ ] **2.2.6** Tratar casos de múltiplos speakers simultâneos

### 2.3 — Auto-Reframe Suave

- [ ] **2.3.1** Criar algoritmo de crop 9:16 centralizado no rosto
- [ ] **2.3.2** Implementar suavização (easing) entre frames
- [ ] **2.3.3** Configurar dead-zone: só move se rosto sair de 30% central
- [ ] **2.3.4** Criar componente `<SmartCrop>` no Remotion
- [ ] **2.3.5** Adicionar novo layout `SMART_REFRAME` no enum `RenderLayout`
- [ ] **2.3.6** Testar crop suave sem pulos em 90%+ do vídeo

### 2.4 — Layout Multi-Speaker

- [ ] **2.4.1** Criar layout `SPLIT_SCREEN` para 2 speakers
- [ ] **2.4.2** Implementar alternância automática entre split e single
- [ ] **2.4.3** Adicionar transições suaves (fade de 0.3s)
- [ ] **2.4.4** Testar com podcast de 2 pessoas
- [ ] **2.4.5** Implementar suporte a 3+ speakers (layout PIP ou similar)

### 2.5 — Integração com Pipeline

- [ ] **2.5.1** Modificar `VideoProcessorService` para chamar FaceDetection antes de render
- [ ] **2.5.2** Passar `faceTrackJson` para Remotion via props
- [ ] **2.5.3** Atualizar UI para permitir escolher entre layouts
- [ ] **2.5.4** Criar preview do crop antes de render final
- [ ] **2.5.5** Implementar opção de face tracking manual (clicar para seguir)

### Checklist de Gate — Fase 2

- [ ] Detecção facial funciona em vídeos com 1-3 pessoas
- [ ] Latência < 30s para vídeo de 60s
- [ ] Speaker ativo identificado corretamente em 85%+ dos casos
- [ ] Crop segue rosto suavemente sem pulos em 90%+ do vídeo
- [ ] Layout split-screen funcional para podcasts

---

## FASE 3 — B-ROLL AUTOMÁTICO

**Objetivo:** Inserir imagens/vídeos contextuais automaticamente
**Impacto:** +4.0 pontos (0.0 → 4.0)
**Duração Estimada:** 2-3 semanas
**Prioridade:** 🟡 P1

### 3.1 — BRoll Service

- [ ] **3.1.1** Criar `BRollService` em `apps/worker/src/services`
- [ ] **3.1.2** Integrar Pexels API para busca de imagens/vídeos
- [ ] **3.1.3** Implementar LLM para identificar conceitos por segmento
- [ ] **3.1.4** Criar cache local de B-Rolls baixa resolução
- [ ] **3.1.5** Limitar 2 B-Rolls por clip de 45s

### 3.2 — Componente BRoll no Remotion

- [ ] **3.2.1** Criar componente `<BRollOverlay>` no Remotion
- [ ] **3.2.2** Implementar opacidade 70% durante 2-3s
- [ ] **3.2.3** Adicionar transições (fade in/out)
- [ ] **3.2.4** Sincronizar com timestamps dos segmentos

### 3.3 — SFX Automático

- [ ] **3.3.1** Criar biblioteca de 20 SFX (whoosh, pop, ding, bass drop)
- [ ] **3.3.2** Implementar LLM para mapear momentos → tipo de SFX
- [ ] **3.3.3** Criar componente `<SoundEffect>` no Remotion
- [ ] **3.3.4** Ajustar volume para 30% do áudio principal

### Checklist de Gate — Fase 3

- [ ] B-Rolls são contextualmente relevantes em 75%+ dos casos
- [ ] Máximo 2 B-Rolls por clip de 45s
- [ ] SFX adicionam impacto sem competir com fala
- [ ] Integração com Pexels API funcional

---

## FASE 4 — PUBLICAÇÃO MULTI-PLATAFORMA

**Objetivo:** Publicar automaticamente em TikTok, Instagram, YouTube
**Impacto:** +4.5 pontos (4.0 → 8.5)
**Duração Estimada:** 3-4 semanas
**Prioridade:** 🟡 P1

### 4.1 — TikTok Integration

- [ ] **4.1.1** Registrar TikTok Content Posting API app
- [ ] **4.1.2** Implementar OAuth2 flow para autenticação
- [ ] **4.1.3** Criar `TikTokPublishService`
- [ ] **4.1.4** Implementar upload de vídeo via API
- [ ] **4.1.5** Testar publicação real (com conta de teste)
- [ ] **4.1.6** Tratar rate limits e erros

### 4.2 — Instagram Integration

- [ ] **4.2.1** Registrar Instagram Graph API app
- [ ] **4.2.2** Implementar OAuth2 flow para Instagram
- [ ] **4.2.3** Criar `InstagramPublishService`
- [ ] **4.2.4** Implementar upload de Reels via API
- [ ] **4.2.5** Testar publicação real

### 4.3 — UI de Publicação

- [ ] **4.3.1** Criar modal de "Publicar em..." na página de clip
- [ ] **4.3.2** Listar contas conectadas por plataforma
- [ ] **4.3.3** Implementar seletor de plataformas (checkboxes)
- [ ] **4.3.4** Adicionar preview de metadados (título, hashtag)
- [ ] **4.3.5** Mostrar status de publicação em tempo real

### 4.4 — Sistema de Agendamento

- [ ] **4.4.1** Criar modelo `ScheduledPost` no Prisma
- [ ] **4.4.2** Implementar `SchedulerService` com cron jobs
- [ ] **4.4.3** Criar UI de agendamento com date/time picker
- [ ] **4.4.4** Implementar fuso horário do usuário
- [ ] **4.4.5** Adicionar notificação antes da publicação

### Checklist de Gate — Fase 4

- [ ] TikTok OAuth2 funciona end-to-end
- [ ] Instagram Reels upload funcional
- [ ] UI permite selecionar múltiplas plataformas
- [ ] Agendamento persiste e executa corretamente
- [ ] Status de publicação atualiza em tempo real

---

## FASE 5 — CLOUD DEPLOYMENT

**Objetivo:** Migrar de Docker Compose local para SaaS deployável
**Impacto:** +5.5 pontos (2.5 → 8.0)
**Duração Estimada:** 4-5 semanas
**Prioridade:** 🟢 P2

### 5.1 — Storage Cloud (R2)

- [ ] **5.1.1** Criar conta Cloudflare R2
- [ ] **5.1.2** Configurar bucket para storage de vídeos
- [ ] **5.1.3** Criar `R2StorageService` como alternativa a MinIO
- [ ] **5.1.4** Implementar signed URLs com expiração
- [ ] **5.1.5** Configurar CDN para entrega de vídeos
- [ ] **5.1.6** Testar upload/download com R2

### 5.2 — Database (Neon/Supabase)

- [ ] **5.2.1** Criar projeto Neon PostgreSQL
- [ ] **5.2.2** Configurar connection pooling
- [ ] **5.2.3** Migrar schema do Postgres local
- [ ] **5.2.4** Testar queries com dados reais
- [ ] **5.2.5** Configurar branch staging (dev → main)

### 5.3 — Redis (Upstash)

- [ ] **5.3.1** Criar projeto Upstash Redis
- [ ] **5.3.2** Configurar para BullMQ
- [ ] **5.3.3** Testar filas com jobs reais

### 5.4 — Deploy API + Worker

- [ ] **5.4.1** Configurar Dockerfile multi-stage para API
- [ ] **5.4.2** Configurar Dockerfile multi-stage para Worker
- [ ] **5.4.3** Criar `Dockerfile.optimized`
- [ ] **5.4.4** Deploy em Railway ou Fly.io
- [ ] **5.4.5** Configurar variáveis de ambiente
- [ ] **5.4.6** Testar health checks

### 5.5 — CI/CD

- [ ] **5.5.1** Configurar GitHub Actions workflow
- [ ] **5.5.2** Pipeline: lint → typecheck → build → deploy
- [ ] **5.5.3** Deploy automático em push para main
- [ ] **5.5.4** Notificações de deploy (Slack/Discord)

### 5.6 — Observabilidade

- [ ] **5.6.1** Integrar Sentry para error tracking
- [ ] **5.6.2** Configurar Prometheus metrics
- [ ] **5.6.3** Criar dashboard Grafana
- [ ] **5.6.4** Configurar alertas (fila > 100 jobs, error rate > 5%)

### Checklist de Gate — Fase 5

- [ ] App acessível em URL pública
- [ ] Upload/download de vídeos funciona via R2
- [ ] Fila BullMQ funciona via Upstash
- [ ] Deploy automático em push para main
- [ ] Alertas configurados e testados

---

## FASE 6 — TEXT-BASED EDITING

**Objetivo:** Permitir editar vídeo via transcrição (como editar um documento)
**Impacto:** +2.0 pontos (6.0 → 8.0)
**Duração Estimada:** 2-3 semanas
**Prioridade:** 🟢 P2

### 6.1 — Editor de Transcrição

- [ ] **6.1.1** Criar página `/dashboard/[id]/editor` com transcrição interativa
- [ ] **6.1.2** Tornar cada palavra clicável com timestamp
- [ ] **6.1.3** Implementar seleção de segmentos por clique
- [ ] **6.1.4** Criar ação de deletar trecho selecionado
- [ ] **6.1.5** Sidebar com preview do vídeo sincronizado

### 6.2 — Undo/Redo

- [ ] **6.2.1** Implementar sistema deundo com Ctrl+Z
- [ ] **6.2.2** Persistir histórico de edições no estado
- [ ] **6.2.3** Testarundo em sequência de 10+ operações

### 6.3 — Re-render Inteligente

- [ ] **6.3.1** Detectar segmentos modificados
- [ ] **6.3.2** Re-renderizar apenas clips afetados
- [ ] **6.3.3** Não consumir tokens de IA desnecessariamente

### Checklist de Gate — Fase 6

- [ ] Transcrição exibe com timestamps clicáveis
- [ ] Deletar palavra/frase remove do clip renderizado
- [ ] Undo/redo funciona com Ctrl+Z
- [ ] Re-render não chama LLM para edições de texto

---

## FASE 7 — VIRALITY SCORE AVANÇADO

**Objetivo:** Melhorar precisão do Virality Score com análise multimodal
**Impacto:** +1.5 pontos (7.5 → 9.0)
**Duração Estimada:** 2 semanas
**Prioridade:** 🟢 P2

### 7.1 — Análise de Energia de Áudio

- [ ] **7.1.1** Criar `AudioEnergyService`
- [ ] **7.1.2** Extrair features: pitch, volume, velocidade de fala
- [ ] **7.1.3** Calcular `energy_score` por segmento
- [ ] **7.1.4** Integrar no `compositeScore` (peso 15%)

### 7.2 — Análise de Expressões Faciais

- [ ] **7.2.1** Usar MediaPipe Face Mesh para expressões
- [ ] **7.2.2** Detectar sorriso, surpresa, raiva
- [ ] **7.2.3** Mapear expressões para multiplicadores

### 7.3 — Geração de Hook

- [ ] **7.3.1** Detectar se primeiros 3s têm gancho forte
- [ ] **7.3.2** Se não, reposicionar momento mais impactante
- [ ] **7.3.3** Adicionar texto "Espera até o final..."

### Checklist de Gate — Fase 7

- [ ] Picos de energia aumentam viral_score corretamente
- [ ] Expressões faciais influenciam ranking
- [ ] Hook fraco é corrigido automaticamente

---

## FASE 8 — BRAND KIT & CUSTOMIZAÇÃO

**Objetivo:** Permitir personalização de marca para agencies
**Impacto:** +1.0 ponto
**Duração Estimada:** 1-2 semanas
**Prioridade:** 🟢 P2

### 8.1 — Sistema de Brand Kit

- [ ] **8.1.1** Criar modelo `BrandKit` no Prisma
- [ ] **8.1.2** Upload de logo (PNG/SVG)
- [ ] **8.1.3** Upload de fontes custom (TTF/OTF)
- [ ] **8.1.4** Paleta de cores custom
- [ ] **8.1.5** Aplicar automaticamente nos renders

### 8.2 — Templates de Marca

- [ ] **8.2.1** Criar templates baseados no Brand Kit
- [ ] **8.2.2** Preview em tempo real
- [ ] **8.2.3** Aplicar a todos os clips de um projeto

### Checklist de Gate — Fase 8

- [ ] Brand kit com logo, fontes e cores aplicável
- [ ] Templates de marca exportáveis

---

## FASE 9 — API PÚBLICA

**Objetivo:** Permitir integração via API para desenvolvedores
**Impacto:** +1.0 ponto
**Duração Estimada:** 2 semanas
**Prioridade:** 🔵 P3

### 9.1 — Endpoints REST

- [ ] **9.1.1** Documentar API com OpenAPI/Swagger
- [ ] **9.1.2** Autenticação por API key
- [ ] **9.1.3** Endpoint: POST /videos (upload)
- [ ] **9.1.4** Endpoint: GET /clips (listar)
- [ ] **9.1.5** Endpoint: GET /clips/:id (detalhes)

### 9.2 — Rate Limiting

- [ ] **9.2.1** Configurar limites por plano
- [ ] **9.2.2** Free: 10 req/min
- [ ] **9.2.3** Pro: 100 req/min

### 9.3 — Webhooks

- [ ] **9.3.1** Configurar webhook para conclusão de processing
- [ ] **9.3.2** Testar com endpoint de demonstração

### Checklist de Gate — Fase 9

- [ ] Documentação OpenAPI auto-gerada
- [ ] Rate limiting funcional
- [ ] Webhooks delivers notificações

---

## FASE 10 — DIFERENCIAIS DISRUPTIVOS

**Objetivo:** Features que nenhum concorrente tem
**Impacto:** +1.0 ponto (9.0 → 10.0)
**Duração Estimada:** 4+ semanas
**Prioridade:** 🔵 P3

### 10.1 — Stream Clipping (Real-Time)

- [ ] **10.1.1** Integrar com YouTube/Twitch live API
- [ ] **10.1.2** Processar áudio em tempo real com Whisper streaming
- [ ] **10.1.3** Detectar momentos virais durante a live
- [ ] **10.1.4** Publicar clip < 2 minutos após momento

### 10.2 — Trend-Jacking Automático

- [ ] **10.2.1** Monitorar TikTok Trending Sounds API
- [ ] **10.2.2** Sugerir troca de trilha sonora
- [ ] **10.2.3** Preview com áudio trending

### 10.3 — Interactive Overlays

- [ ] **10.3.1** Gerar enquetes/stickers sobrepostos
- [ ] **10.3.2** IA sugere perguntas de engajamento
- [ ] **10.3.3** Exportar com overlay funcional

### 10.4 — Analytics & Learning Loop

- [ ] **10.4.1** Coletar métricas de performance pós-publicação
- [ ] **10.4.2** Alimentar modelo com dados reais
- [ ] **10.4.3** Validar correlação > 0.7 com performance real

### Checklist de Gate — Fase 10

- [ ] Clip publicado < 2 min após momento viral na live
- [ ] Suggestão de áudio trending relevante
- [ ] Analytics correlacionam com performance real

---

## 📅 RESUMO DO CRONOGRAMA

| Fase | Feature | Semanas | Prioridade |
|---|---|---|---|
| 1 | Legendas Animadas | 3-4 | 🔴 P0 |
| 2 | Face Tracking Real | 4-5 | 🔴 P0 |
| 3 | B-Roll Automático | 2-3 | 🟡 P1 |
| 4 | Publicação Multi-Platform | 3-4 | 🟡 P1 |
| 5 | Cloud Deployment | 4-5 | 🟢 P2 |
| 6 | Text-Based Editing | 2-3 | 🟢 P2 |
| 7 | Virality Score Avançado | 2 | 🟢 P2 |
| 8 | Brand Kit | 1-2 | 🟢 P2 |
| 9 | API Pública | 2 | 🔵 P3 |
| 10 | Diferenciais Disruptivos | 4+ | 🔵 P3 |

**Total Estimado:** 27-34 semanas

---

## 🎯 MILESTONES

### M1 — Alpha (Semana 6-8)
- [ ] Legendas animadas word-by-word funcionando
- [ ] Face tracking básico implementado
- **Nota Estimada:** 6.5/10

### M2 — Beta (Semana 12-14)
- [ ] B-Roll automático
- [ ] Multi-platform publishing
- [ ] Cloud deployment básico
- **Nota Estimada:** 8.0/10

### M3 — Launch (Semana 20-24)
- [ ] Text-based editing
- [ ] Brand Kit
- [ ] API Pública
- **Nota Estimada:** 8.8/10

### M4 — Dominance (Semana 28+)
- [ ] Diferenciais disruptivos
- [ ] Analytics com dados reais
- **Nota Estimada:** 9.5+/10

---

*Documento gerado em 2026-05-21*
*Planejamento adicionado em 2026-05-21*
