import React, { useMemo } from 'react';
import { interpolate, spring, useCurrentFrame } from 'remotion';
import { CAPTION_THEMES } from './theme.js';
import { activeSegmentAt, activeWordsAt, cleanCaptionText, wrapWords } from './text.js';
import type { CaptionTheme, TranscriptSegment, WordSegment } from './types.js';

interface AnimatedCaptionProps {
  time: number;
  fps: number;
  segments: TranscriptSegment[];
  words?: WordSegment[];
  theme: CaptionTheme;
}

function captionPosition(theme: CaptionTheme) {
  const spec = CAPTION_THEMES[theme];
  if (spec.position === 'top') return { top: 180 };
  if (spec.position === 'center') return { top: 760 };
  if (spec.position === 'centerLow') return { bottom: 410 };
  return { bottom: 190 };
}

export function AnimatedCaption({ time, fps, segments, words = [], theme }: AnimatedCaptionProps) {
  const frame = useCurrentFrame();
  const spec = CAPTION_THEMES[theme];

  const { segment, visibleWords } = useMemo(() => {
    const seg = activeSegmentAt(segments, time);
    const vis = words.length > 0
      ? activeWordsAt(words, time).map((item) => ({ text: item.word, active: time >= item.start && time <= item.end, item }))
      : cleanCaptionText(seg?.text ?? '').split(' ').slice(0, 10).map((word, index) => ({ text: word, active: index === 0, item: null }));
    return { segment: seg, visibleWords: vis };
  }, [segments, words, time]);

  const { lines, pos } = useMemo(() => {
    const wrapped = wrapWords(visibleWords.map((word) => cleanCaptionText(word.text)), spec.maxCharsPerLine);
    return { lines: wrapped, pos: captionPosition(theme) };
  }, [visibleWords, spec.maxCharsPerLine, theme]);

  if (!segment && visibleWords.length === 0) return null;

  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });

  let cursor = 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: 92,
        right: 92,
        ...pos,
        display: 'flex',
        justifyContent: 'center',
        transform: `translateY(${interpolate(entrance, [0, 1], [18, 0])}px)`,
        opacity: entrance,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          padding: spec.boxBackground ? '24px 34px' : 0,
          borderRadius: 26,
          background: spec.boxBackground,
          border: spec.boxBorder,
          textAlign: 'center',
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          fontWeight: spec.fontWeight,
          lineHeight: spec.lineHeight,
          color: spec.color,
          textShadow: spec.outline,
          filter: spec.shadow ? `drop-shadow(${spec.shadow})` : undefined,
          textTransform: spec.textTransform,
        }}
      >
        {lines.map((line, lineIndex) => (
          <div key={lineIndex} style={{ whiteSpace: 'nowrap' }}>
            {line.map((word) => {
              const wordMeta = visibleWords[cursor++];
              const active = Boolean(wordMeta?.active);
              const startFrame = Math.floor((wordMeta?.item?.start ?? time) * fps);
              const wordFrame = Math.max(0, frame - startFrame);
              const pop = active && spec.animation === 'scale-pop'
                ? spring({ frame: wordFrame, fps, config: { damping: 10, stiffness: 200 } })
                : 0;
              const scale = active && spec.animation === 'scale-pop' ? interpolate(pop, [0, 1], [1, 1.12]) : 1;
              return (
                <span
                  key={`${lineIndex}-${cursor}-${word}`}
                  style={{
                    display: 'inline-block',
                    margin: '0 8px',
                    color: active ? spec.activeColor : spec.inactiveColor ?? spec.color,
                    transform: `scale(${scale})`,
                    textDecoration: active && spec.animation === 'underline-sweep' ? 'underline' : 'none',
                    textUnderlineOffset: 10,
                    textShadow: active && spec.animation === 'pulse-glow' ? `0 0 24px ${spec.activeColor}, ${spec.outline}` : spec.outline,
                    transition: 'color .12s linear',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
