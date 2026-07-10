import type { CaptionTheme } from './types.js';

export interface CaptionThemeSpec {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  color: string;
  activeColor: string;
  inactiveColor?: string;
  outline: string;
  shadow: string;
  boxBackground?: string;
  boxBorder?: string;
  textTransform?: 'none' | 'uppercase';
  position: 'footer' | 'centerLow' | 'center' | 'top';
  animation: 'highlight' | 'scale-pop' | 'karaoke' | 'underline-sweep' | 'typewriter' | 'pulse-glow';
  maxCharsPerLine: number;
}

export const CAPTION_THEMES: Record<CaptionTheme, CaptionThemeSpec> = {
  CLEAN_FOOTER: {
    fontFamily: 'Arial, sans-serif', fontSize: 54, fontWeight: 800, lineHeight: 1.12,
    color: '#FFFFFF', activeColor: '#FFFFFF', outline: '0 3px 14px rgba(0,0,0,.85)', shadow: '0 4px 18px rgba(0,0,0,.55)',
    boxBackground: 'rgba(0,0,0,.42)', boxBorder: '1px solid rgba(255,255,255,.12)', position: 'footer', animation: 'highlight', maxCharsPerLine: 26,
  },
  BOLD_FOOTER: {
    fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 54, fontWeight: 900, lineHeight: 1.04,
    color: '#FFFFFF', activeColor: '#FFD400', outline: '0 4px 0 #000, 0 8px 24px rgba(0,0,0,.8)', shadow: '0 5px 20px rgba(0,0,0,.65)',
    position: 'footer', animation: 'scale-pop', maxCharsPerLine: 22,
  },
  CREATOR_BOX: {
    fontFamily: 'Arial, sans-serif', fontSize: 56, fontWeight: 900, lineHeight: 1.08,
    color: '#FAFAFA', activeColor: '#C4B5FD', outline: '0 3px 12px rgba(0,0,0,.9)', shadow: '0 5px 22px rgba(0,0,0,.6)',
    boxBackground: 'rgba(17,17,17,.82)', boxBorder: '1px solid rgba(124,58,237,.45)', position: 'footer', animation: 'pulse-glow', maxCharsPerLine: 24,
  },
  MINIMAL: {
    fontFamily: 'Arial, sans-serif', fontSize: 46, fontWeight: 700, lineHeight: 1.18,
    color: '#FFFFFF', activeColor: '#FFFFFF', outline: '0 2px 10px rgba(0,0,0,.55)', shadow: '0 2px 12px rgba(0,0,0,.35)',
    position: 'footer', animation: 'highlight', maxCharsPerLine: 32,
  },
  BOLD_CREATOR: {
    fontFamily: 'Arial Black, Impact, sans-serif', fontSize: 56, fontWeight: 900, lineHeight: 1.02,
    color: '#FFFFFF', activeColor: '#FFD400', outline: '0 5px 0 #000, 0 10px 26px rgba(0,0,0,.8)', shadow: '0 8px 28px rgba(0,0,0,.7)',
    textTransform: 'uppercase', position: 'footer', animation: 'scale-pop', maxCharsPerLine: 20,
  },
  CLEAN_EDITORIAL: {
    fontFamily: 'Arial, sans-serif', fontSize: 50, fontWeight: 750, lineHeight: 1.16,
    color: '#F8FAFC', activeColor: '#F8FAFC', outline: '0 2px 12px rgba(0,0,0,.5)', shadow: '0 4px 18px rgba(0,0,0,.35)',
    boxBackground: 'rgba(8,8,10,.58)', boxBorder: '1px solid rgba(255,255,255,.1)', position: 'footer', animation: 'underline-sweep', maxCharsPerLine: 30,
  },
  NEON_TECH: {
    fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 52, fontWeight: 900, lineHeight: 1.08,
    color: '#FFFFFF', activeColor: '#00FFE0', outline: '0 0 18px rgba(0,255,224,.65), 0 4px 18px rgba(0,0,0,.85)', shadow: '0 0 30px rgba(0,255,224,.4)',
    position: 'centerLow', animation: 'pulse-glow', maxCharsPerLine: 23,
  },
  KARAOKE_PRO: {
    fontFamily: 'Arial, sans-serif', fontSize: 56, fontWeight: 900, lineHeight: 1.08,
    color: '#D4D4D8', activeColor: '#FFFFFF', inactiveColor: '#A1A1AA', outline: '0 3px 14px rgba(0,0,0,.8)', shadow: '0 3px 16px rgba(0,0,0,.5)',
    boxBackground: 'rgba(0,0,0,.45)', position: 'footer', animation: 'karaoke', maxCharsPerLine: 26,
  },
  PODCAST_PRO: {
    fontFamily: 'Arial, sans-serif', fontSize: 48, fontWeight: 800, lineHeight: 1.14,
    color: '#FFFFFF', activeColor: '#7CFFB2', outline: '0 3px 14px rgba(0,0,0,.82)', shadow: '0 4px 18px rgba(0,0,0,.45)',
    boxBackground: 'rgba(10,10,10,.72)', boxBorder: '1px solid rgba(16,185,129,.35)', position: 'footer', animation: 'highlight', maxCharsPerLine: 28,
  },
  STORY_IMPACT: {
    fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 64, fontWeight: 900, lineHeight: 1,
    color: '#FFFFFF', activeColor: '#FF4D8D', outline: '0 5px 0 #000, 0 10px 28px rgba(0,0,0,.82)', shadow: '0 7px 25px rgba(0,0,0,.65)',
    textTransform: 'uppercase', position: 'center', animation: 'scale-pop', maxCharsPerLine: 16,
  },
};
