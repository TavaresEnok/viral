# Execução rumo à liderança — 2026

## Entrega 1 — qualidade comprovável e distribuição

Status: implementada em 13 de julho de 2026.

### Qualidade de cortes

- Benchmark temporal contra cortes humanos de referência.
- Precisão, recall e F1 nos limiares IoU 0,3, 0,5 e 0,7.
- IoU médio, erro médio de borda e erro de duração.
- Matching bipartido para impedir duplicatas de inflarem a nota.
- Comparação de múltiplas versões/concorrentes e relatório JSON.
- Protocolo documentado para dataset PT-BR cego com revisores humanos.

### Distribuição

- Calendário mensal de publicações.
- Filtros por status e plataforma.
- Visualizações mensal e em lista.
- Reagendamento e cancelamento de posts pendentes.
- Claims atômicos e revalidação no worker contra corrida de reagendamento.
- Índices de banco para consultas do calendário e execução dos agendamentos.

### Automação

- API pública agora cria e processa projetos por URL do YouTube.
- Retry e exclusão de projetos por API key.
- Documentação com exemplos de integração.

## Próximas entregas

1. Dataset real PT-BR com pelo menos 50 vídeos e dois revisores.
2. Webhooks assinados para projeto, render e publicação.
3. Upload multipart e render/publicação pela API pública.
4. Publicação em lote, calendário com copy/hashtags e analytics das redes.
5. Workspaces, membros, papéis, clientes e fluxo de aprovação.
6. Editor criativo: áudio, transições, tradução, B-roll semântico e SFX.
7. Teste de carga, autoscaling, CDN e SLO/SLA de produção.

Uma posição de liderança só deve ser declarada depois que o dataset real superar os concorrentes em avaliação cega e os SLOs forem comprovados sob carga.
