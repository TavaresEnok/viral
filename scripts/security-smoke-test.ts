const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
const webOrigin = process.env.WEB_ORIGIN_TEST ?? 'http://localhost:3002';
const email = process.env.SMOKE_EMAIL ?? 'demo@viralforge.local';
const password = process.env.SMOKE_PASSWORD ?? 'viralforge123';

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Origin: webOrigin,
      ...(init.headers ?? {}),
    },
  });
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const live = await request('/health/live');
  assert(live.ok, `health/live falhou: ${live.status}`);
  assert(live.headers.get('x-request-id'), 'X-Request-Id ausente');
  assert(live.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options ausente');
  assert(live.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options ausente');

  const ready = await request('/health/ready');
  assert(ready.ok, `health/ready falhou: ${ready.status}`);

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) {
    throw new Error(`login falhou: ${login.status} ${await login.text()}`);
  }
  assert(login.headers.get('set-cookie')?.includes('HttpOnly'), 'refresh cookie nao veio HttpOnly');
  const auth = await login.json() as { token?: string; refreshToken?: string };
  assert(auth.token, 'access token ausente');
  assert(!('refreshToken' in auth), 'refresh token vazou no JSON');

  const unauthProjects = await request('/projects');
  assert(unauthProjects.status === 401, `projects sem token deveria negar, veio ${unauthProjects.status}`);

  const traversal = await request('/clips/../../etc/passwd/download', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  assert([400, 401, 404].includes(traversal.status), `path traversal teve status inesperado ${traversal.status}`);

  const badLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-errada-smoke' }),
  });
  assert(badLogin.status === 401 || badLogin.status === 429, `senha errada deveria falhar, veio ${badLogin.status}`);

  console.log(JSON.stringify({ ok: true, apiBase, checked: ['health', 'security-headers', 'auth-cookie', 'auth-required', 'path-traversal', 'bad-login'] }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
