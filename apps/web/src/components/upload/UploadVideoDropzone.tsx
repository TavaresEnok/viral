'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ProgressBar } from '@/components/processing/ProgressBar';
import { FilePreview } from './FilePreview';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska'];

export function UploadVideoDropzone({
  disabled,
  file,
  progress,
  uploading,
  onFile,
}: {
  disabled?: boolean;
  file: File | null;
  progress: number;
  uploading: boolean;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(nextFile: File) {
    if (!allowedTypes.includes(nextFile.type)) {
      return 'Formato inválido. Use MP4, MOV ou MKV.';
    }
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      return 'Arquivo acima de 500MB.';
    }
    return null;
  }

  function selectFile(nextFile: File) {
    const validationError = validate(nextFile);
    setError(validationError);
    onFile(validationError ? null : nextFile);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const nextFile = event.dataTransfer.files[0];
        if (nextFile && !disabled) selectFile(nextFile);
      }}
      className={cn(
        'relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-card border-[1.5px] border-dashed border-hairline-strong bg-surface bg-thumb-stripe p-6 text-center transition duration-150 ease-smooth',
        dragging && 'border-accent bg-[color:var(--accent-glow)]',
        disabled && 'cursor-not-allowed opacity-50',
        error && 'border-danger',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-matroska"
        disabled={disabled || uploading}
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (nextFile) selectFile(nextFile);
        }}
      />

      {file ? (
        <div className="w-full max-w-md space-y-4">
          <FilePreview file={file} onRemove={() => onFile(null)} />
          {uploading && (
            <div className="space-y-2 text-left">
              <ProgressBar value={progress} />
              <p className="text-xs text-ink-secondary">Enviando... {progress}%</p>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="mb-4 grid h-[52px] w-[52px] place-items-center rounded-pill bg-accent text-[#10120A]">
            <Upload className="h-6 w-6" strokeWidth={2} />
          </span>
          <span className="font-display text-base font-bold tracking-tight text-ink-primary">Solta seu vídeo aqui</span>
          <span className="mt-2 text-sm text-ink-tertiary">MP4, MOV ou MKV até 500MB · ou clica pra escolher</span>
        </button>
      )}
      {error && <p className="mt-4 text-sm text-[#FF8A8A]">{error}</p>}
    </div>
  );
}
