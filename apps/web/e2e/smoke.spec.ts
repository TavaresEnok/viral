import { test, expect } from '@playwright/test';

/**
 * Smoke E2E — valida o caminho crítico ponta-a-ponta (web + API + Postgres)
 * sem depender de dados pré-semeados. O cadastro cria seu próprio usuário,
 * então roda numa base limpa de CI. Seletores usam os ids reais dos campos.
 */
test.describe('Smoke — ViralForge', () => {
  test('landing carrega', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ViralForge/i);
  });

  test('login renderiza os campos', async ({ page }) => {
    await page.goto('/login');
    // A página de login tem o h1 do hero de marketing + o h1 do formulário;
    // filtramos pelo título do formulário pra evitar ambiguidade.
    await expect(page.locator('h1', { hasText: /estúdio|entra/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register renderiza os campos', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
  });

  test('cadastro de novo usuário sai do /register com sucesso', async ({ page }) => {
    const email = `e2e-${Date.now()}@viralforge.local`;
    await page.goto('/register');
    await page.fill('#name', 'E2E Smoke');
    await page.fill('#email', email);
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'Password123!');
    await page.click('button[type="submit"]');
    // Pós-cadastro o app leva ao dashboard (ou à verificação de e-mail, se
    // exigida). Ambos confirmam que o registro full-stack funcionou.
    await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 20000 });
    expect(page.url()).toMatch(/\/(dashboard|verify-email)/);
  });

  test('login inválido mostra erro', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'naoexiste@viralforge.local');
    await page.fill('#password', 'senhaerrada');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/inválid|erro|falh|incorret|não/i').first()).toBeVisible({ timeout: 15000 });
  });
});
