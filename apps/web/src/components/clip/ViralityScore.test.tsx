import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Clip } from '@/types/api.types';
import { ViralityScore } from './ViralityScore';

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'c1',
    projectId: 'p1',
    title: 'Corte teste',
    status: 'COMPLETED',
    start: 0,
    end: 45,
    duration: 45,
    viralScore: 80,
    finalScore: 87,
    category: 'opinião',
    reason: 'motivo',
    openingStrength: 88,
    closingStrength: 82,
    contextIndependenceScore: 78,
    emotionalDensity: 75,
    quotability: 80,
    riskOfBadCut: 'low',
    firstThreeSecondsHook: 'abre com uma pergunta forte',
    shareabilityReason: 'gera identificação imediata',
    ...overrides,
  } as Clip;
}

describe('ViralityScore', () => {
  it('mostra o finalScore e o tier', () => {
    render(<ViralityScore clip={makeClip({ finalScore: 92 })} />);
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText(/Potencial Viral/i)).toBeInTheDocument();
  });

  it('renderiza as dimensões de viralidade', () => {
    render(<ViralityScore clip={makeClip()} />);
    expect(screen.getByText('Abertura')).toBeInTheDocument();
    expect(screen.getByText('Fechamento')).toBeInTheDocument();
    expect(screen.getByText('Contexto')).toBeInTheDocument();
    expect(screen.getByText('Emoção')).toBeInTheDocument();
    expect(screen.getByText('Quotabilidade')).toBeInTheDocument();
  });

  it('mostra os motivos (por que prende / compartilham)', () => {
    render(<ViralityScore clip={makeClip()} />);
    expect(screen.getByText(/por que prende/i)).toBeInTheDocument();
    expect(screen.getByText(/abre com uma pergunta forte/i)).toBeInTheDocument();
    expect(screen.getByText(/por que compartilham/i)).toBeInTheDocument();
  });

  it('exibe alerta de risco quando riskOfBadCut é high', () => {
    render(<ViralityScore clip={makeClip({ riskOfBadCut: 'high' })} />);
    expect(screen.getByText(/risco alto/i)).toBeInTheDocument();
  });

  it('cai para viralScore quando finalScore é 0', () => {
    render(<ViralityScore clip={makeClip({ finalScore: 0, viralScore: 73 })} />);
    // 73 aparece como score principal e como dimensão "Viral (IA)".
    expect(screen.getAllByText('73').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Potencial Bom/i)).toBeInTheDocument();
  });
});
