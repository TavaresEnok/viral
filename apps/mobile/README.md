# @viralforge/mobile — App Android (Capacitor)

POC que empacota o web app ViralForge (Next.js) num app nativo para **Play Store**
e **APK de download direto**, reaproveitando ~100% da UI React.

Estratégia: **remote URL** — o app carrega o site de produção dentro de um WebView
nativo. Sem reescrever telas. Plugins nativos (share, push, storage seguro) entram
via a ponte em [`integration/native-bridge.ts`](integration/native-bridge.ts).

> Status deste POC: scaffold JS pronto e configurado. Os passos `cap add android`
> e o build do APK/AAB precisam rodar numa máquina com **Android Studio + SDK + JDK
> 17** (este servidor não tem o toolchain Android). Tudo abaixo está pronto pra isso.

---

## Pré-requisitos (na máquina de build)

- Node 20+ e pnpm 9+
- **JDK 17**
- **Android Studio** (inclui Android SDK + Gradle)
- Variável `ANDROID_HOME` apontando pro SDK

## 0) Bloqueador de produção: HTTPS

O Android bloqueia tráfego **cleartext (HTTP)** e a Play Store exige HTTPS. Hoje o
site roda em `http://IP:3002`. **Antes de publicar**, coloque um domínio com TLS:

- Ex.: `https://app.seudominio.com` (Let's Encrypt via nginx/caddy na frente do `:3002`).
- Atualize `VIRALFORGE_APP_URL` (ou `capacitor.config.ts`) com essa URL.
- Adicione esse domínio ao `WEB_ORIGIN` da API e à `connect-src` da CSP.

## 1) Instalar e configurar

```bash
cd apps/mobile
pnpm install
export VIRALFORGE_APP_URL="https://app.seudominio.com"   # sua URL HTTPS real
```

## 2) Gerar o projeto Android

```bash
pnpm add:android      # cap add android  → cria apps/mobile/android/
pnpm sync             # cap sync         → copia config + plugins p/ o nativo
```

## 3) Rodar no emulador/celular

```bash
pnpm open:android     # abre no Android Studio (Run ▶)
# ou
pnpm run:android      # roda direto num device conectado
```

## 4) Build pra distribuição

```bash
# APK (download direto no site)
pnpm build:apk        # → android/app/build/outputs/apk/release/app-release.apk

# AAB (Play Store)
pnpm build:aab        # → android/app/build/outputs/bundle/release/app-release.aab
```

### Assinatura (obrigatória pra release)
```bash
keytool -genkey -v -keystore viralforge.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias viralforge
```
Configure a assinatura em `android/app/build.gradle` (`signingConfigs`) ou via
`android/keystore.properties`. **Guarde o `.jks` com segurança** — sem ele você
não consegue atualizar o app na Play Store.

## 5) Publicar
- **Play Store:** Play Console → criar app → subir o `.aab` → preencher ficha,
  política de privacidade (já existe `/privacy`), classificação, screenshots.
- **APK no site:** hospede o `app-release.apk` e ofereça download (avise que é
  "fora da Play Store" → o usuário precisa permitir "fontes desconhecidas").

---

## Integração com o web app (plugins nativos)

Copie [`integration/native-bridge.ts`](integration/native-bridge.ts) para
`apps/web/src/lib/native-bridge.ts` e instale no **app web** os plugins:

```bash
pnpm --filter @viralforge/web add @capacitor/core @capacitor/share \
  @capacitor/browser @capacitor/preferences @capacitor/push-notifications @capacitor/app
```

A ponte é **no-op no navegador comum**, então é seguro importar sem afetar o site.
Use onde fizer sentido:
- `shareClip(...)` no botão "Postar/Compartilhar" → share sheet nativo.
- `registerPush(...)` no login → notificar "cortes prontos".
- `saveRefreshToken / getRefreshToken` no fluxo de auth (ver abaixo).
- `wireHardwareBackButton()` uma vez na inicialização.

### Auth dentro do WebView (ponto de atenção)
O web usa **cookie httpOnly de refresh + JWT**. No WebView mobile o cookie é menos
confiável entre reinícios do app. Adapte `apps/web/src/lib/api.ts`:
- Ao logar/refresh, se `isNativeApp()`, salve o refresh token via `saveRefreshToken`.
- No `refreshSession()`, se `isNativeApp()`, envie o token salvo no corpo/header em
  vez de depender do cookie.
- A API precisa aceitar refresh por token (além do cookie) — pequeno ajuste no
  `auth.controller`.

---

## Por que Capacitor (e não RN/Flutter)
- Reaproveita o app React/Next que já existe — **um codebase**, esforço baixo.
- Plugins nativos quando precisa (upload, share, push, deep link).
- Gera **APK e AAB** do mesmo projeto. iOS depois, mesmo código.
- RN exigiria reescrever a UI; Flutter exigiria Dart (joga fora o stack atual).

## Próximos passos sugeridos
1. Subir domínio HTTPS e setar `VIRALFORGE_APP_URL`.
2. `cap add android` + rodar no emulador (validar navegação/login).
3. Integrar `native-bridge` (share + push + auth seguro).
4. Ícones/splash (`@capacitor/assets`), assinar, publicar.
