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
  // Fundo do WebView = fundo da marca: mata o "flash branco" entre o splash e
  // o carregamento do site, que é um dos sinais clássicos de app-protótipo.
  backgroundColor: '#0C0C11',
  server: {
    url: APP_URL,
    cleartext: false,
    // Quando o site (server.url) está inacessível, mostra a shell branded de
    // www/index.html em vez da página de erro crua do Chrome (net::ERR_...).
    errorPath: 'index.html',
    // Permite que o WebView trate a navegação do próprio domínio como "app"
    // (links externos abrem no navegador via plugin Browser, ver native-bridge).
    allowNavigation: [new URL(APP_URL).host],
  },
  android: {
    backgroundColor: '#0C0C11',
    // Sem zoom acidental de pinça (comportamento de site, não de app).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Some via fade só quando a UI está pronta (fadeOut no lugar de corte
      // seco), e sem spinner genérico — a shell já tem o estado de conexão.
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#0C0C11',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: false,
    },
    // Barra de status combinando com a marca (texto claro sobre fundo escuro),
    // em vez do preto/branco padrão do sistema.
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0C0C11',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
