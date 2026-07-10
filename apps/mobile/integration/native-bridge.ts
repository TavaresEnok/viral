/**
 * PONTE NATIVA (Capacitor) — copie este arquivo para `apps/web/src/lib/` quando
 * for integrar o web app ao shell mobile.
 *
 * Tudo aqui é NO-OP fora do Capacitor (no navegador comum), então é seguro
 * importar no web app sem quebrar nada: as funções só fazem algo dentro do app.
 *
 * Requer (no app web): @capacitor/core, @capacitor/share, @capacitor/browser,
 * @capacitor/preferences, @capacitor/push-notifications, @capacitor/app.
 */
import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Compartilha um corte usando o share sheet nativo (WhatsApp, IG, etc.). */
export async function shareClip(args: { title: string; url: string; text?: string }): Promise<void> {
  if (!isNativeApp()) {
    // Fallback web: Web Share API quando disponível.
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: args.title, text: args.text, url: args.url });
    }
    return;
  }
  const { Share } = await import('@capacitor/share');
  await Share.share({ title: args.title, text: args.text ?? args.title, url: args.url, dialogTitle: 'Compartilhar corte' });
}

/** Abre links externos no navegador do sistema (não dentro do app). */
export async function openExternal(url: string): Promise<void> {
  if (!isNativeApp()) {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
    return;
  }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}

/**
 * Armazenamento seguro do refresh token. No navegador o app usa cookie httpOnly;
 * dentro do WebView mobile o cookie é menos confiável entre reinícios, então
 * persistimos o token via Preferences (Keychain/EncryptedSharedPrefs).
 */
const REFRESH_KEY = 'vf_refresh_token';

export async function saveRefreshToken(token: string): Promise<void> {
  if (!isNativeApp()) return; // no web, o cookie cuida disso
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: REFRESH_KEY, value: token });
}

export async function getRefreshToken(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: REFRESH_KEY });
  return value ?? null;
}

export async function clearRefreshToken(): Promise<void> {
  if (!isNativeApp()) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: REFRESH_KEY });
}

/**
 * Registra push notifications ("seus cortes ficaram prontos!"). Retorna o token
 * do dispositivo (FCM) para você associar ao usuário no backend.
 */
export async function registerPush(onToken: (deviceToken: string) => void): Promise<void> {
  if (!isNativeApp()) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();
  PushNotifications.addListener('registration', (token) => onToken(token.value));
}

/**
 * Botão "voltar" do Android: fecha o app na home, navega de volta caso contrário.
 * Chame uma vez na inicialização do app.
 */
export async function wireHardwareBackButton(): Promise<void> {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });
}
