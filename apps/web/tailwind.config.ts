// VIRAL — Redesign (substitui apps/web/tailwind.config.ts)
// Mudanças vs. anterior: fontes (Inter→Instrument Sans, +display Bricolage,
// JetBrains→Spline Sans Mono), novas cores accent-text/on-accent/special,
// glow lime, radius pill como padrão de botão.
import type { Config } from 'tailwindcss';

const rgbVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-instrument)', 'Instrument Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-bricolage)', 'Bricolage Grotesque', 'system-ui', 'sans-serif'],
        mono: ['var(--font-spline-mono)', 'Spline Sans Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.1em' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        'body-sm': ['0.875rem', { lineHeight: '1.375rem' }],
        body: ['0.9375rem', { lineHeight: '1.55rem' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        'heading-md': ['1.75rem', { lineHeight: '2.1rem', letterSpacing: '-0.02em' }],
        'display-md': ['2.625rem', { lineHeight: '2.85rem', letterSpacing: '-0.03em' }],
        'display-lg': ['5.25rem', { lineHeight: '5.35rem', letterSpacing: '-0.03em' }],
      },
      colors: {
        base: rgbVar('--bg-base-rgb'),
        surface: rgbVar('--bg-surface-rgb'),
        elevated: rgbVar('--bg-elevated-rgb'),
        overlay: rgbVar('--bg-overlay-rgb'),
        ink: {
          primary: rgbVar('--ink-primary-rgb'),
          secondary: rgbVar('--ink-secondary-rgb'),
          tertiary: rgbVar('--ink-tertiary-rgb'),
        },
        hairline: {
          DEFAULT: rgbVar('--hairline-subtle-rgb'),
          subtle: rgbVar('--hairline-subtle-rgb'),
          strong: rgbVar('--hairline-strong-rgb'),
        },
        signal: {
          positive: rgbVar('--signal-positive-rgb'),
          caution: rgbVar('--signal-caution-rgb'),
          negative: rgbVar('--signal-negative-rgb'),
          info: rgbVar('--signal-info-rgb'),
        },

        accent: rgbVar('--accent-rgb'),
        'accent-hover': rgbVar('--accent-hover-rgb'),
        special: rgbVar('--special-rgb'),
        success: rgbVar('--signal-positive-rgb'),
        warning: rgbVar('--signal-caution-rgb'),
        danger: rgbVar('--signal-negative-rgb'),
        info: rgbVar('--signal-info-rgb'),
      },
      borderRadius: {
        card: '20px',
        input: '14px',
        pill: '999px',
      },
      boxShadow: {
        elevated: '0 0 0 1px var(--hairline-subtle), 0 18px 48px -32px rgba(0, 0, 0, 0.78)',
        glow: '0 0 0 4px var(--accent-glow)',
        'glow-strong': '0 0 0 1px var(--accent), 0 0 0 5px var(--accent-glow)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
        entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
        reveal: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        defer: 'cubic-bezier(0.33, 1, 0.68, 1)',
        settle: 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      backgroundImage: {
        'progress-viral': 'linear-gradient(90deg, #C8F542, #FF4FA3)',
        'thumb-stripe': 'var(--thumb-stripe)',
      },
    },
  },
  plugins: [],
};

export default config;
