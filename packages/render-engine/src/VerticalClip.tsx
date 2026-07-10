import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame } from 'remotion';
import { AnimatedCaption } from './AnimatedCaption.js';
import { VideoCanvas } from './VideoCanvas.js';
import type { VerticalClipProps, OverlayItem } from './types.js';

function EmojiOverlay({ overlay, frame, fps }: { overlay: OverlayItem; frame: number; fps: number }) {
  const time = frame / fps;
  const localTime = time - overlay.start;
  const duration = overlay.end - overlay.start;

  const opacity = interpolate(localTime, [0, 0.15, duration - 0.3, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = spring({ fps, frame: Math.max(0, (time - overlay.start) * fps), config: { damping: 8, mass: 0.5, stiffness: 200 } });
  const size = overlay.intensity === 'loud' ? 48 : overlay.intensity === 'balanced' ? 36 : 28;

  const posStyle: React.CSSProperties = (() => {
    switch (overlay.position) {
      case 'top': return { top: '12%', left: '8%' };
      case 'bottom': return { bottom: '18%', right: '8%' };
      case 'left': return { top: '40%', left: '5%' };
      case 'right': return { top: '40%', right: '5%' };
      default: return { top: '35%', right: '8%' };
    }
  })();

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          fontSize: size,
          opacity,
          transform: `scale(${scale})`,
          filter: overlay.intensity === 'loud' ? 'drop-shadow(0 0 8px rgba(255,200,50,0.6))' : 'none',
          transition: 'none',
          ...posStyle,
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
}

const SFX_FILES: Record<string, string> = {
  wow: '/sfx/wow.mp3',
  laugh: '/sfx/laugh.mp3',
  fire: '/sfx/fire.mp3',
  fail: '/sfx/fail.mp3',
  alert: '/sfx/alert.mp3',
  ding: '/sfx/ding.mp3',
  success: '/sfx/success.mp3',
};

function SfxOverlay({ overlay, fps }: { overlay: OverlayItem; fps: number }) {
  const src = overlay.src ? SFX_FILES[overlay.src] : undefined;
  if (!src) return null;
  return <Audio src={src} startFrom={Math.round(overlay.start * fps)} endAt={Math.round(overlay.end * fps)} volume={0.5} />;
}

export function VerticalClip({ videoSrc, startAtSeconds, durationSeconds: _durationSeconds, segments, words = [], overlays = [], theme, layout, fps, smartCrop }: VerticalClipProps) {
  const frame = useCurrentFrame();
  const time = startAtSeconds + frame / fps;

  const emojiOverlays = useMemo(() => overlays.filter((o) => o.type === 'EMOJI'), [overlays]);
  const sfxOverlays = useMemo(() => overlays.filter((o) => o.type === 'SFX'), [overlays]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505' }}>
      <VideoCanvas src={videoSrc} layout={layout} startFrame={Math.round(startAtSeconds * fps)} smartCrop={smartCrop} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 80%, rgba(124,58,237,.12), transparent 45%)' }} />
      <AnimatedCaption time={time} fps={fps} segments={segments} words={words} theme={theme} />
      {emojiOverlays.map((o) => <EmojiOverlay key={o.id} overlay={o} frame={frame} fps={fps} />)}
      {sfxOverlays.map((o) => <SfxOverlay key={o.id} overlay={o} fps={fps} />)}
    </AbsoluteFill>
  );
}
