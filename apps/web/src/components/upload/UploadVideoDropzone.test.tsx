import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UploadVideoDropzone } from './UploadVideoDropzone';

function makeMockFile(name: string, type: string, size = 1024) {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

describe('UploadVideoDropzone', () => {
  const defaultProps = {
    disabled: false,
    file: null,
    progress: 0,
    uploading: false,
    onFile: vi.fn(),
  };

  it('renderiza área de drop com texto', () => {
    render(<UploadVideoDropzone {...defaultProps} />);
    expect(screen.getByText(/solta seu vídeo aqui/i)).toBeInTheDocument();
  });

  it('chama onFile com arquivo válido ao selecionar', () => {
    const onFile = vi.fn();
    render(<UploadVideoDropzone {...defaultProps} onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeMockFile('video.mp4', 'video/mp4');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('chama onFile com null para formato inválido', () => {
    const onFile = vi.fn();
    render(<UploadVideoDropzone {...defaultProps} onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeMockFile('doc.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(null);
  });

  it('exibe mensagem de erro para formato inválido', () => {
    render(<UploadVideoDropzone {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeMockFile('doc.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/formato inválido/i)).toBeInTheDocument();
  });

  it('exibe preview quando file está definido', () => {
    const file = makeMockFile('clip.mp4', 'video/mp4');
    render(<UploadVideoDropzone {...defaultProps} file={file} />);
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
  });

  it('desabilita input quando disabled=true', () => {
    render(<UploadVideoDropzone {...defaultProps} disabled />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
