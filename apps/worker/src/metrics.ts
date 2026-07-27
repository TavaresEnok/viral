/**
 * Métricas Prometheus do worker.
 *
 * Antes disso o worker — o serviço que faz todo o trabalho pesado — não expunha
 * nenhuma métrica: falhas de pipeline, fila crescendo e DLQ enchendo só eram
 * percebidos quando o usuário reclamava. O PipelineRunMetric no banco serve para
 * análise histórica; isto aqui serve para alerta em tempo real.
 *
 * Exposto em GET /metrics na porta WORKER_HEALTH_PORT (padrão 3012).
 */
import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics({ register, prefix: 'viralforge_worker_' });

/** Jobs finalizados por tipo e resultado. Base para taxa de erro. */
export const jobsTotal = new Counter({
  name: 'viralforge_jobs_total',
  help: 'Total de jobs processados pelo worker',
  labelNames: ['type', 'status'] as const,
  registers: [register],
});

/** Duração de cada etapa do pipeline (download, transcrição, IA, render...). */
export const stageDuration = new Histogram({
  name: 'viralforge_stage_duration_seconds',
  help: 'Duração de cada etapa do pipeline em segundos',
  labelNames: ['stage'] as const,
  // De 1s a ~34min: cobre desde probe rápido até render longo.
  buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200, 2400],
  registers: [register],
});

/** Custo acumulado de LLM. Permite alertar sobre gasto anormal. */
export const llmCostUsdTotal = new Counter({
  name: 'viralforge_llm_cost_usd_total',
  help: 'Custo acumulado estimado de chamadas LLM em USD',
  registers: [register],
});

/** Tokens de LLM consumidos. */
export const llmTokensTotal = new Counter({
  name: 'viralforge_llm_tokens_total',
  help: 'Total de tokens de LLM consumidos',
  registers: [register],
});

/** Profundidade da fila por estado — o sinal mais importante de saturação. */
export const queueDepth = new Gauge({
  name: 'viralforge_queue_depth',
  help: 'Quantidade de jobs na fila por estado',
  labelNames: ['state'] as const,
  registers: [register],
});

/** Clips renderizados por resultado. */
export const clipsRendered = new Counter({
  name: 'viralforge_clips_rendered_total',
  help: 'Total de clips renderizados',
  labelNames: ['status'] as const,
  registers: [register],
});

export { register };

/** Serializa as métricas no formato de exposição do Prometheus. */
export async function renderMetrics(): Promise<{ contentType: string; body: string }> {
  return { contentType: register.contentType, body: await register.metrics() };
}
