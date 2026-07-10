import type { Config } from 'tailwindcss';

const rgbVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        'body-sm': ['0.875rem', { lineHeight: '1.375rem' }],
        body: ['1rem', { lineHeight: '1.625rem' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.02em' }],
        'heading-md': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.03em' }],
        'display-md': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.05em' }],
        'display-lg': ['4.5rem', { lineHeight: '4.75rem', letterSpacing: '-0.06em' }],
      },
      colors: {
        // New editorial token layer.
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
        success: rgbVar('--signal-positive-rgb'),
        warning: rgbVar('--signal-caution-rgb'),
        danger: rgbVar('--signal-negative-rgb'),
        info: rgbVar('--signal-info-rgb'),
      },
      boxShadow: {
        elevated: '0 0 0 1px var(--hairline-subtle), 0 18px 48px -32px rgba(0, 0, 0, 0.78)',
        glow: '0 0 0 1px rgba(20, 184, 166, 0.28), 0 0 34px var(--accent-glow)',
        editorial: '0 0 0 1px var(--hairline-subtle), 0 24px 72px -48px rgba(0, 0, 0, 0.88)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
        entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
        reveal: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        defer: 'cubic-bezier(0.33, 1, 0.68, 1)',
        settle: 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      backgroundImage: {
        'editorial-radial': 'radial-gradient(circle at 18% -8%, rgba(20, 184, 166, 0.12), transparent 30rem), radial-gradient(circle at 90% 10%, rgba(250, 204, 21, 0.045), transparent 26rem)',
        'surface-noise': 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0))',
      },
    },
  },
  plugins: [],
};

export default config;
