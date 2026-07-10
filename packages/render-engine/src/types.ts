export type RenderLayout =
  | 'BLURRED_BACKGROUND'
  | 'FILL_CROP'
  | 'CENTER_FIT'
  | 'TOP_FRAME'
  | 'SMART_REFRAME'
  | 'SMART_CENTER'
  | 'SPEAKER_CLOSEUP'
  | 'PODCAST_SPLIT_STATIC'
  | 'SCREEN_PLUS_FACE';

export type CaptionTheme =
  | 'CLEAN_FOOTER'
  | 'BOLD_FOOTER'
  | 'CREATOR_BOX'
  | 'MINIMAL'
  | 'BOLD_CREATOR'
  | 'CLEAN_EDITORIAL'
  | 'NEON_TECH'
  | 'KARAOKE_PRO'
  | 'PODCAST_PRO'
  | 'STORY_IMPACT';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface WordSegment {
  word: string;
  start: number;
  end: number;
  confidence?: number | null;
  segmentIndex?: number | null;
}

export interface OverlayItem {
  id: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'EMOJI' | 'STICKER' | 'SFX' | 'CALLOUT' | 'PROGRESS_BAR';
  start: number;
  end: number;
  text?: string;
  src?: string;
  position?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  animation?: 'fade' | 'pop' | 'slide' | 'float' | 'none';
  intensity?: 'subtle' | 'balanced' | 'loud';
}

export interface SmartCrop {
  cx: number;
  cy: number;
}

export interface VerticalClipProps {
  videoSrc: string;
  startAtSeconds: number;
  durationSeconds: number;
  segments: TranscriptSegment[];
  words?: WordSegment[];
  overlays?: OverlayItem[];
  theme: CaptionTheme;
  layout: RenderLayout;
  fps: number;
  smartCrop?: SmartCrop | null;
}
