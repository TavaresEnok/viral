import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BrollService } from './broll.service.js';

/** Um cutaway de B-roll: arquivo local + janela (em segundos, relativa ao corte). */
export interface BrollSegment {
  filePath: string;
  startSec: number;
  endSec: number;
}

/**
 * Monta um plano de B-roll (cutaways) para um corte e baixa os clipes do Pexels
 * para o disco. EXPERIMENTAL e desligado por padrão: só roda com
 * BROLL_ENABLED=true e PEXELS_API_KEY configurada. Quando desligado, retorna []
 * e o render segue idêntico ao comportamento atual (zero risco em produção).
 */
@Injectable()
export class BrollPlanService {
  private readonly logger = new Logger(BrollPlanService.name);
  // a cada ~15s entra um cutaway de 3s; nunca cobre o hook inicial nem o fecho.
  private readonly insertEverySec = 15;
  private readonly cutawaySec = 3;
  private readonly leadInSec = 6;
  private readonly tailGuardSec = 5;
  private readonly maxCutaways = 4;

  constructor(private readonly broll: BrollService) {}

  isEnabled(): boolean {
    return process.env.BROLL_ENABLED === 'true' && Boolean(process.env.PEXELS_API_KEY);
  }

  async buildPlan(args: {
    transcriptText: string;
    clipStartSec: number;
    clipEndSec: number;
    baseDir: string;
  }): Promise<BrollSegment[]> {
    if (!this.isEnabled()) return [];

    const clipDuration = args.clipEndSec - args.clipStartSec;
    // Cortes curtos não comportam cutaway sem atropelar o ritmo.
    if (clipDuration < 20) return [];

    let clips: Awaited<ReturnType<BrollService['findRelevantBroll']>>;
    try {
      clips = await this.broll.findRelevantBroll(args.transcriptText);
    } catch (error) {
      this.logger.warn({ msg: 'Falha ao buscar B-roll; seguindo sem cutaways', error: error instanceof Error ? error.message : String(error) });
      return [];
    }
    if (!clips.length) return [];

    const brollDir = resolve(args.baseDir, 'broll');
    await mkdir(brollDir, { recursive: true }).catch(() => {});

    const segments: BrollSegment[] = [];
    let t = this.leadInSec;
    let index = 0;
    while (
      t + this.cutawaySec <= clipDuration - this.tailGuardSec &&
      index < clips.length &&
      segments.length < this.maxCutaways
    ) {
      const filePath = await this.download(clips[index].url, brollDir, index);
      if (filePath) {
        segments.push({ filePath, startSec: t, endSec: t + this.cutawaySec });
      }
      t += this.insertEverySec;
      index += 1;
    }

    if (segments.length) {
      this.logger.log({ msg: `Plano de B-roll: ${segments.length} cutaway(s)`, clipDuration });
    }
    return segments;
  }

  private async download(url: string, dir: string, index: number): Promise<string | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        this.logger.warn({ msg: 'Falha ao baixar B-roll', status: response.status });
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const filePath = resolve(dir, `broll-${index}.mp4`);
      await writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      this.logger.warn({ msg: 'Erro ao baixar B-roll', error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}
