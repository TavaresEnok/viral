import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor envolve o web app que já existe. Estratégia "remote URL": o app
 * carrega o site de produção dentro do WebView nativo — reaproveita 100% da UI
 * React/Next, sem reescrever telas.
 *
 * IMPORTANTE:
 * - A URL PRECISA ser HTTPS. O Android bloqueia tráfego cleartext (HTTP) por
 *   padrão, e a Play Store exige HTTPS. Hoje o site roda em http://IP:3002 — é
 *   preciso colocar um domínio com TLS (ex.: https://app.seudominio.com) antes
 *   de publicar.
 * - Defina a URL via env VIRALFORGE_APP_URL ao rodar `cap sync`, ou edite aqui.
 */
const APP_URL = process.env.VIRALFORGE_APP_URL ?? 'https://app.viralforge.com.br';

const config: CapacitorConfig = {
  appId: 'com.viralforge.app',
  appName: 'ViralForge',
  // webDir é exigido pelo Capacitor mesmo no modo remote URL: serve de fallback
  // (tela de carregamento) caso o servidor esteja inacessível.
  webDir: 'www',
  server: {
    url: APP_URL,
    cleartext: false,
    // Permite que o WebView trate a navegação do próprio domínio como "app"
    // (links externos abrem no navegador via plugin Browser, ver native-bridge).
    allowNavigation: [new URL(APP_URL).host],
  },
  android: {
    // Mantém o conteúdo abaixo da status bar e respeita safe areas.
    backgroundColor: '#0C0C11',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0C0C11',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
