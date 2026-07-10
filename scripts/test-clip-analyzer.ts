import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  LlmClipAnalyzerService,
  type TranscriptPayload,
} from '../packages/clip-analyzer/src/llm-clip-analyzer.service.js';

interface ScriptOptions {
  offline: boolean;
  clipStyle: string;
  language: string;
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    offline: argv.includes('--offline'),
    clipStyle: 'viral-polêmico-emocional',
    language: 'pt-BR',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === '--style' && argv[i + 1]) {
      options.clipStyle = argv[i + 1];
      i += 1;
      continue;
    }

    if (current === '--language' && argv[i + 1]) {
      options.language = argv[i + 1];
      i += 1;
    }
  }

  return options;
}

async function loadSamplesDir(samplesDir: string): Promise<string[]> {
  const files = await readdir(samplesDir);
  return files
    .filter((filename) => filename.startsWith('transcript-') && filename.endsWith('.json'))
    .sort();
}

function printClipLine(sampleName: string, clipIndex: number, clip: {
  title: string;
  start: number;
  end: number;
  duration: number;
  viral_score: number;
  hook?: string;
  reason: string;
}): void {
  const hook = clip.hook?.replace(/\s+/g, ' ').trim() || '-';
  const reason = clip.reason.replace(/\s+/g, ' ').trim();
  console.log(
    `[${sampleName}] #${clipIndex + 1} ${clip.title} | ${clip.start.toFixed(1)}-${clip.end.toFixed(
      1,
    )} (${clip.duration}s) | ${clip.viral_score} | ${hook} | ${reason}`,
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const samplesDir = resolve(rootDir, 'samples');

  const service = new LlmClipAnalyzerService({
    logger: (message) => console.error(message),
  });

  const sampleFiles = await loadSamplesDir(samplesDir);
  if (!sampleFiles.length) {
    console.error('Nenhum sample encontrado em samples/transcript-*.json');
    process.exitCode = 1;
    return;
  }

  if (!process.env.DEEPSEEK_API_KEY && !options.offline) {
    console.error('DEEPSEEK_API_KEY ausente. Rode com --offline para teste local sem API.');
  }

  for (const sampleFile of sampleFiles) {
    const samplePath = resolve(samplesDir, sampleFile);
    const sampleRaw = await readFile(samplePath, 'utf8');
    const transcript = JSON.parse(sampleRaw) as TranscriptPayload;

    try {
      const result = await service.analyzeTranscript({
        transcript,
        clipStyle: options.clipStyle,
        language: options.language,
        offline: options.offline,
      });
      const clips = result.clips;

      if (!clips.length) {
        console.log(`[${sampleFile}] nenhum corte retornado`);
        process.exitCode = 1;
        continue;
      }

      clips.forEach((clip, index) => {
        printClipLine(sampleFile, index, clip);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      console.error(`[${sampleFile}] falha: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
