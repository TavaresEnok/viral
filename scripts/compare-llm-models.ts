/**
 * Compara modelos de LLM usando o MESMO caminho de produção.
 *
 * Não reimplementa nada: usa o LlmClipAnalyzerService de verdade, com o
 * mesmo prompt, o mesmo perfil de conteúdo e a mesma validação de schema.
 * Assim o resultado reflete exatamente o que aconteceria num projeto real.
 *
 * Uso (dentro do container do worker):
 *   node_modules/.bin/tsx scripts/compare-llm-models.ts \
 *     --transcript samples/transcript-podcast.json \
 *     --models "modelo/a,modelo/b"
 */
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '../packages/database/src/index.js';
import { decryptSecret, getMasterSecret } from '../packages/shared/src/index.js';
import { LlmClipAnalyzerService } from '../packages/clip-analyzer/src/index.js';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : (fallback ?? '');
}

const transcriptPath = arg('--transcript', 'samples/transcript-podcast.json');
const models = arg('--models').split(',').map((m) => m.trim()).filter(Boolean);
const contentType = arg('--content-type', 'PODCAST');
const clipStyle = arg('--clip-style', 'VIRAL');
const maxClips = Number(arg('--max-clips', '5'));

const prisma = new PrismaClient();

async function main() {
  const platform = await prisma.platformAiConfig.findUnique({ where: { id: 'default' } });
  if (!platform?.llmApiKeyEncrypted) {
    throw new Error('Nenhuma chave de LLM configurada em PlatformAiConfig.');
  }
  const apiKey = decryptSecret(platform.llmApiKeyEncrypted, getMasterSecret());
  if (!apiKey) throw new Error('Falha ao descriptografar a chave.');
  const baseURL = platform.llmBaseUrl ?? 'https://openrouter.ai/api/v1';

  const raw = JSON.parse(await readFile(transcriptPath, 'utf8'));
  const transcript = raw.transcript ?? raw;
  console.log(`\nTranscrição: ${transcript.title ?? transcriptPath}`);
  console.log(`Duração: ${transcript.duration}s | segmentos: ${transcript.segments.length}`);
  console.log(`Perfil: contentType=${contentType} clipStyle=${clipStyle} | alvo: ${maxClips} cortes\n`);

  for (const model of models.length ? models : [platform.llmModel ?? '']) {
    console.log('='.repeat(70));
    console.log(`MODELO: ${model}`);
    console.log('='.repeat(70));

    const startedAt = Date.now();
    const service = new LlmClipAnalyzerService({
      apiKey,
      baseURL,
      model,
      // Silencia o log interno para a saída ficar legível; erros aparecem abaixo.
      logger: (msg: string) => {
        if (/não produziu|fora do schema|falhou|inválido/i.test(msg)) console.log(`  [log] ${msg}`);
      },
    });

    try {
      const { clips, telemetry } = await service.analyzeTranscript({
        transcript,
        contentType,
        clipStyle,
        language: transcript.language ?? 'pt-BR',
        maxClips,
        minViralScore: 0,
      });

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`\n  tempo: ${elapsed}s | tokens: ${telemetry.totalTokens} | falhou: ${telemetry.pass1Failed}`);
      console.log(`  candidatos: ${telemetry.pass1CandidateCount} -> aprovados: ${clips.length}`);

      if (!clips.length) {
        console.log('\n  >>> NENHUM CORTE VÁLIDO (cairia no fallback burro em produção)\n');
        continue;
      }

      clips.forEach((c, i) => {
        console.log(`\n  --- Corte ${i + 1} --- [${c.start.toFixed(1)}s -> ${c.end.toFixed(1)}s | ${c.duration}s]`);
        console.log(`  Título: ${c.title}`);
        console.log(`  Score viral: ${c.viral_score} | abertura: ${c.opening_strength ?? '-'} | fechamento: ${c.closing_strength ?? '-'}`);
        console.log(`  Independência de contexto: ${c.context_independence_score ?? '-'} | emoção: ${c.emotional_density ?? '-'}`);
        if (c.first_three_seconds_hook) console.log(`  Gancho (3s): ${c.first_three_seconds_hook}`);
        console.log(`  Motivo: ${c.reason}`);
      });
      console.log('');
    } catch (error) {
      console.log(`\n  >>> ERRO: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
