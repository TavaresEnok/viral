import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(MODULE_DIR, 'prompts');

const promptFiles = [
  { name: 'system.txt', expectedSections: ['IDENTIDADE', 'AS 5 DIMENSÕES DO CORTE', 'HIERARQUIA DE DECISÃO', 'CRITÉRIOS DE EXCLUSÃO AUTOMÁTICA', 'REGRAS DE OUTPUT'] },
  { name: 'user-template.txt', expectedSections: ['TRANSCRIÇÃO', 'FORMATO DE SAÍDA'] },
];

describe('prompt integrity', () => {
  for (const pf of promptFiles) {
    describe(pf.name, () => {
      const content = readFileSync(resolve(PROMPTS_DIR, pf.name), 'utf-8');

      it('arquivo existe e nao esta vazio', () => {
        expect(content.length).toBeGreaterThan(100);
      });

      it('contem secoes esperadas', () => {
        for (const section of pf.expectedSections) {
          expect(content).toContain(section);
        }
      });

      it('nao contem chaves de API ou secrets', () => {
        const lines = content.split('\n');
        for (const line of lines) {
          expect(line).not.toMatch(/sk-[a-zA-Z0-9]{20,}|api[-_]?key[:=]/i);
        }
      });
    });
  }

  it('user-template tem marcadores de interpolacao', () => {
    const template = readFileSync(resolve(PROMPTS_DIR, 'user-template.txt'), 'utf-8');
    expect(template).toContain('{transcriptBlock}');
    expect(template).toContain('{clipStyle}');
    expect(template).toContain('{language}');
    expect(template).toContain('{preferredDuration}');
  });

  it('system usa os clipStyles reais do produto', () => {
    const system = readFileSync(resolve(PROMPTS_DIR, 'system.txt'), 'utf-8');
    for (const style of ['VIRAL', 'EDUCATIONAL', 'CONTROVERSIAL', 'FUNNY', 'MOTIVATIONAL', 'SALES', 'STRONG_QUOTES']) {
      expect(system).toContain(style);
    }
    expect(system).not.toContain('clipStyle = polemic');
  });

  it('system nao menciona pipeline de dois passes', () => {
    const system = readFileSync(resolve(PROMPTS_DIR, 'system.txt'), 'utf-8');
    expect(system).not.toMatch(/Pass 1|Pass 2|duas etapas/i);
  });
});
