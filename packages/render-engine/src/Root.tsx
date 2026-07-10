import React from 'react';
import { Composition } from 'remotion';
import { VerticalClip } from './VerticalClip.js';
import type { ComponentType } from 'react';
import type { VerticalClipProps } from './types.js';

const defaultProps: VerticalClipProps = {
  videoSrc: '',
  startAtSeconds: 0,
  durationSeconds: 45,
  segments: [],
  words: [],
  overlays: [],
  theme: 'BOLD_CREATOR',
  layout: 'BLURRED_BACKGROUND',
  fps: 30,
};

export function RemotionRoot() {
  return (
    <Composition
      id="VerticalClip"
      component={VerticalClip as unknown as ComponentType<Record<string, unknown>>}
      durationInFrames={Math.max(30, Math.round(defaultProps.durationSeconds * defaultProps.fps))}
      fps={defaultProps.fps}
      width={1080}
      height={1920}
      defaultProps={defaultProps as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const typedProps = props as unknown as Partial<VerticalClipProps>;
        const fps = typeof typedProps.fps === 'number' ? typedProps.fps : 30;
        const durationSeconds = typeof typedProps.durationSeconds === 'number' ? typedProps.durationSeconds : 45;
        return {
          durationInFrames: Math.max(30, Math.round(durationSeconds * fps)),
          fps,
          width: 1080,
          height: 1920,
        };
      }}
    />
  );
}
