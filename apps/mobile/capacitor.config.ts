import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor envolve o web app que já existe. Estratégia "remote URL": o app
 * carrega o site de produção dentro do WebView nativo — reaproveita 100% da UI
 * React/Next, sem reescrever telas.
 *
 * Instalação DIRETA (APK, sem Play Store): aponta para o IP público em HTTP e
 * permite cleartext. A Play Store exigiria HTTPS; para sideload (baixar e
 * instalar o APK) não é obrigatório. Quando houver um domínio com TLS, troque
 * VIRALFORGE_APP_URL para https://... e volte cleartext para false.
 */
const APP_URL = process.env.VIRALFORGE_APP_URL ?? 'http://168.194.13.20';
const IS_HTTPS = APP_URL.startsWith('https://');

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
    // HTTP direto no IP exige cleartext (só quando a URL não é HTTPS).
    cleartext: !IS_HTTPS,
    androidScheme: IS_HTTPS ? 'https' : 'http',
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
    // Push notifications removido de propósito: exigiria Firebase
    // (google-services.json). Reativar quando/se for para a Play Store.
  },
};

export default config;
