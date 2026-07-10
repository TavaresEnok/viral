import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';
import type { RenderLayout } from './types.js';

export interface SmartCrop {
  cx: number; // normalized face center X (0–1)
  cy: number; // normalized face center Y (0–1)
}

interface VideoCanvasProps {
  src: string;
  layout: RenderLayout;
  startFrame: number;
  smartCrop?: SmartCrop | null;
}

const INSET_SIZE = 360;
const INSET_MARGIN = 20;

function smartObjectPosition(cx: number, cy: number): string {
  // Convert normalized face center to CSS percentages for objectPosition
  return `${(cx * 100).toFixed(1)}% ${(cy * 100).toFixed(1)}%`;
}

function foregroundStyle(layout: RenderLayout, smartCrop?: SmartCrop | null): React.CSSProperties {
  if (layout === 'SMART_REFRAME' || layout === 'SPEAKER_CLOSEUP') {
    const position = smartCrop
      ? smartObjectPosition(smartCrop.cx, smartCrop.cy)
      : 'center 30%';
    return { width: '100%', height: '100%', objectFit: 'cover', objectPosition: position };
  }
  if (layout === 'FILL_CROP') {
    return { width: '100%', height: '100%', objectFit: 'cover' };
  }
  if (layout === 'TOP_FRAME') {
    return { width: '100%', height: '68%', objectFit: 'contain', objectPosition: 'center top', marginTop: 90 };
  }
  if (layout === 'SMART_CENTER') {
    const position = smartCrop
      ? smartObjectPosition(smartCrop.cx, Math.min(smartCrop.cy, 0.4))
      : 'center 25%';
    return { width: '100%', height: '100%', objectFit: 'cover', objectPosition: position };
  }
  if (layout === 'PODCAST_SPLIT_STATIC') {
    return { width: '50%', height: '100%', objectFit: 'cover' };
  }
  return { width: '100%', height: '100%', objectFit: 'contain' };
}

export function VideoCanvas({ src, layout, startFrame, smartCrop }: VideoCanvasProps) {
  const hasBlurBg = layout === 'BLURRED_BACKGROUND' || layout === 'CENTER_FIT' || layout === 'TOP_FRAME';

  if (layout === 'PODCAST_SPLIT_STATIC') {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
        <OffthreadVideo
          src={src}
          startFrom={startFrame}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px)', transform: 'scale(1.1)', opacity: 0.5 }}
        />
        <AbsoluteFill style={{ flexDirection: 'row' }}>
          <div style={{ width: '50%', height: '100%', overflow: 'hidden' }}>
            <OffthreadVideo src={src} startFrom={startFrame} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ width: '50%', height: '100%', overflow: 'hidden', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
            <OffthreadVideo src={src} startFrom={startFrame} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (layout === 'SCREEN_PLUS_FACE') {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
        <OffthreadVideo
          src={src}
          startFrom={startFrame}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(10px)', opacity: 0.4 }}
        />
        <OffthreadVideo
          src={src}
          startFrom={startFrame}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        <div style={{
          position: 'absolute', bottom: INSET_MARGIN, right: INSET_MARGIN,
          width: INSET_SIZE, height: INSET_SIZE, borderRadius: 12, overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}>
          <OffthreadVideo
            src={src}
            startFrom={startFrame}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  if (hasBlurBg) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
        <OffthreadVideo
          src={src}
          startFrom={startFrame}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(42px)', transform: 'scale(1.18)', opacity: 0.72 }}
        />
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.48))' }} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: layout === 'TOP_FRAME' ? 'flex-start' : 'center' }}>
          <OffthreadVideo src={src} startFrom={startFrame} style={foregroundStyle(layout, smartCrop)} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <OffthreadVideo src={src} startFrom={startFrame} style={foregroundStyle(layout, smartCrop)} />
    </AbsoluteFill>
  );
}
