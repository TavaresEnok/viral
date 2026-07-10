'use client';

import { useRef, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';

type Handle = 'start' | 'end';

interface ClipTimelineProps {
  reviewStart: number;
  reviewEnd: number;
  start: number;
  end: number;
  currentTime: number;
  captionBlocks?: Array<{ start: number; end: number; text: string }>;
  activeHandle: Handle;
  onActiveHandleChange: (handle: Handle) => void;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
  onSeek: (value: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function durationTone(duration: number) {
  if (duration < 15 || duration > 90) return 'text-[#FF8A8A]';
  if (duration < 20 || duration > 75) return 'text-[#FFC24B]';
  return 'text-[color:var(--accent-text)]';
}

function waveformHeight(index: number) {
  const wave = Math.sin(index * 1.7) * 0.5 + Math.cos(index * 0.43) * 0.5;
  return 18 + Math.round(Math.abs(wave) * 34);
}

export function ClipTimeline({
  reviewStart,
  reviewEnd,
  start,
  end,
  currentTime,
  captionBlocks = [],
  activeHandle,
  onActiveHandleChange,
  onStartChange,
  onEndChange,
  onSeek,
}: ClipTimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const span = Math.max(1, reviewEnd - reviewStart);
  const safeStart = clamp(start, reviewStart, reviewEnd);
  const safeEnd = clamp(end, reviewStart, reviewEnd);
  const safeCurrent = clamp(currentTime, reviewStart, reviewEnd);
  const startPct = ((safeStart - reviewStart) / span) * 100;
  const endPct = ((safeEnd - reviewStart) / span) * 100;
  const currentPct = ((safeCurrent - reviewStart) / span) * 100;
  const duration = Math.max(0, end - start);

  function valueFromPointer(event: PointerEvent<HTMLElement>) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return reviewStart;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    return reviewStart + ratio * span;
  }

  function updateHandle(handle: Handle, value: number) {
    if (handle === 'start') {
      onStartChange(clamp(value, reviewStart, Math.min(reviewEnd, end - 1)));
      return;
    }
    onEndChange(clamp(value, Math.max(reviewStart, start + 1), reviewEnd));
  }

  function beginDrag(handle: Handle, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    onActiveHandleChange(handle);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(handle: Handle, event: PointerEvent<HTMLButtonElement>) {
    if (event.buttons !== 1) return;
    updateHandle(handle, valueFromPointer(event));
    onSeek(valueFromPointer(event));
  }

  function beginPlayheadDrag(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSeek(valueFromPointer(event));
  }

  function dragPlayhead(event: PointerEvent<HTMLButtonElement>) {
    if (event.buttons !== 1) return;
    onSeek(valueFromPointer(event));
  }

  return (
    <div className="rounded-lg border border-hairline-subtle bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-ink-tertiary">{formatDuration(reviewStart)} - {formatDuration(reviewEnd)}</span>
        <span className={cn('font-medium', durationTone(duration))}>{formatDuration(duration)}</span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Timeline do recorte"
        aria-valuemin={reviewStart}
        aria-valuemax={reviewEnd}
        aria-valuenow={activeHandle === 'start' ? start : end}
        tabIndex={0}
        onPointerDown={(event) => {
          const value = valueFromPointer(event);
          onSeek(value);
          if (Math.abs(value - start) < Math.abs(value - end)) {
            onActiveHandleChange('start');
          } else {
            onActiveHandleChange('end');
          }
        }}
        className="relative h-20 rounded-lg border border-hairline-subtle bg-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {Array.from({ length: 44 }).map((_, index) => (
            <span
              key={index}
              className="w-full rounded-full bg-white/12"
              style={{ height: waveformHeight(index) }}
            />
          ))}
        </div>
        <div className="absolute left-0 top-0 h-full rounded-l-lg bg-black/35" style={{ width: `${startPct}%` }} />
        <div className="absolute right-0 top-0 h-full rounded-r-lg bg-black/35" style={{ width: `${100 - endPct}%` }} />
        <div
          className="absolute top-3 h-14 rounded-md bg-accent/25 ring-1 ring-accent/50"
          style={{ left: `${startPct}%`, width: `${Math.max(1, endPct - startPct)}%` }}
        />
        {captionBlocks.map((block, index) => {
          const blockStart = clamp(block.start, reviewStart, reviewEnd);
          const blockEnd = clamp(block.end, reviewStart, reviewEnd);
          const left = ((blockStart - reviewStart) / span) * 100;
          const width = Math.max(3, ((blockEnd - blockStart) / span) * 100);
          return (
            <span
              key={`${block.text}-${index}`}
              className="absolute bottom-2 z-10 h-2 rounded-full bg-white/55"
              title={block.text}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
        {Array.from({ length: 12 }).map((_, index) => (
          <span
            key={index}
            className="absolute top-0 h-full w-px bg-white/5"
            style={{ left: `${(index / 11) * 100}%` }}
          />
        ))}
        <button
          type="button"
          aria-label="Arrastar playhead"
          onPointerDown={beginPlayheadDrag}
          onPointerMove={dragPlayhead}
          className="absolute top-0 z-20 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ left: `${currentPct}%` }}
        >
          <span className="mx-auto block h-full w-px bg-white" />
        </button>
        <button
          type="button"
          aria-label="Arrastar início"
          onPointerDown={(event) => beginDrag('start', event)}
          onPointerMove={(event) => drag('start', event)}
          className={cn(
            'absolute top-2 z-30 h-16 w-4 -translate-x-1/2 rounded-full border border-accent bg-base shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            activeHandle === 'start' && 'bg-accent',
          )}
          style={{ left: `${startPct}%` }}
        />
        <button
          type="button"
          aria-label="Arrastar fim"
          onPointerDown={(event) => beginDrag('end', event)}
          onPointerMove={(event) => drag('end', event)}
          className={cn(
            'absolute top-2 z-30 h-16 w-4 -translate-x-1/2 rounded-full border border-accent bg-base shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            activeHandle === 'end' && 'bg-accent',
          )}
          style={{ left: `${endPct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-tertiary">
        <span>Início {formatDuration(start)}</span>
        <span>Fim {formatDuration(end)}</span>
      </div>
    </div>
  );
}
