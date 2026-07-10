import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('exibe "pronto" para status COMPLETED', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('pronto')).toBeInTheDocument();
  });

  it('exibe "processando" para status PROCESSING', () => {
    render(<StatusBadge status="PROCESSING" />);
    expect(screen.getByText('processando')).toBeInTheDocument();
  });

  it('exibe "falhou" para status FAILED', () => {
    render(<StatusBadge status="FAILED" />);
    expect(screen.getByText('falhou')).toBeInTheDocument();
  });

  it('exibe "na fila" para status PENDING', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('na fila')).toBeInTheDocument();
  });

  it('exibe "rascunho" para status DRAFT', () => {
    render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText('rascunho')).toBeInTheDocument();
  });

  it('aplica animate-pulse no dot quando PROCESSING', () => {
    const { container } = render(<StatusBadge status="PROCESSING" />);
    const dot = container.querySelector('.animate-pulse');
    expect(dot).toBeInTheDocument();
  });

  it('não aplica animate-pulse quando COMPLETED', () => {
    const { container } = render(<StatusBadge status="COMPLETED" />);
    const dot = container.querySelector('.animate-pulse');
    expect(dot).not.toBeInTheDocument();
  });
});
