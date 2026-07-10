/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// CSP estrita para produção; permissiva para dev (hot-reload, devtools)
function buildCsp() {
  if (isDev) {
    // The wildcard * only covers http/https/ws/wss — blob: must be explicit
    return [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' *",
      "img-src 'self' data: blob: *",
      "media-src 'self' blob: *",
      "frame-ancestors 'none'",
    ].join('; ');
  }
  const self = "'self'";
  const none = "'none'";
  const unsafeInline = "'unsafe-inline'";
  return [
    `default-src ${none}`,
    `script-src ${self} ${unsafeInline} https://js.stripe.com https://cdn.jsdelivr.net`,
    `style-src ${self} ${unsafeInline}`,
    `img-src ${self} data: blob: https:`,
    `font-src ${self} https://fonts.gstatic.com`,
    `media-src ${self} blob:`,
    // Quando NEXT_PUBLIC_API_URL é um caminho relativo (ex.: '/api', servido pelo
    // proxy de rewrites na mesma origem), 'self' já cobre. Só adiciona host externo
    // ao connect-src quando a URL é absoluta (http/https).
    `connect-src ${self}${/^https?:\/\//i.test(process.env.NEXT_PUBLIC_API_URL ?? '') ? ` ${process.env.NEXT_PUBLIC_API_URL}` : ''} wss: ws: https://*.ingest.sentry.io`,
    `frame-src https://js.stripe.com https://hooks.stripe.com`,
    `object-src ${none}`,
    `base-uri ${self}`,
    `form-action ${self}`,
    `frame-ancestors ${none}`,
  ].join('; ');
}

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS removido: o sistema roda em HTTP puro. Reativar apenas se configurar SSL/HTTPS.
  // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: buildCsp() },
];

// Proxy de mesma origem: o navegador só fala com o web (porta 3002).
// Tudo em /api/* é encaminhado server-side para a API interna, evitando expor a 3001.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001';

const nextConfig = {
  rewrites: async () => [
    { source: '/api/:path*', destination: `${API_PROXY_TARGET}/:path*` },
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
