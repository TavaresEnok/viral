// VIRAL — Fontes do redesign (snippet para apps/web/src/app/layout.tsx)
// Substitui Inter/Geist por: Bricolage Grotesque (display), Instrument Sans (UI),
// Spline Sans Mono (números/labels técnicos). Todas no Google Fonts via next/font.

import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from 'next/font/google';

export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-instrument',
  display: 'swap',
});

export const splineMono = Spline_Sans_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-spline-mono',
  display: 'swap',
});

// No <html> do RootLayout:
// <html lang="pt-BR" className={`${bricolage.variable} ${instrument.variable} ${splineMono.variable}`}>
//
// Uso nas classes Tailwind (ver tailwind.config.ts deste pacote):
//   font-display → títulos (Bricolage, sempre weight 700/800, tracking-tight)
//   font-sans    → corpo/UI (Instrument Sans)
//   font-mono    → scores, timestamps, kickers uppercase (Spline Sans Mono)
//
// Fallback sem next/font (ex.: protótipos):
// <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@500;700&display=swap" rel="stylesheet">
