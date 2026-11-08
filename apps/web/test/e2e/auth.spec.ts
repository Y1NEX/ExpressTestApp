import { test, expect, type Page, type Route } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
if (!email || !password || !process.env.E2E_BASE_URL)
  throw new Error('Run via npm run test:web to use isolated fixtures');
const credentials = { email, password };
const screenshots = resolve('.artifacts/web/screenshots');
test.beforeAll(async () => {
  await mkdir(screenshots, { recursive: true });
});

async function fillLogin(page: Page) {
  await page.getByLabel('E-Mail-Adresse').fill(credentials.email);
  await page.getByLabel(/^Passwort(?:\s*\*)?$/).fill(credentials.password);
}
async function signIn(page: Page) {
  await page.goto('/login');
  await fillLogin(page);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Willkommen in SnippetShelf.' }),
  ).toBeVisible();
}
const failureBody = (code: string) => ({
  error: {
    code,
    message: 'provider detail should never be shown',
    requestId: '381d16e7-1165-4130-bec1-6f98a21b20a2',
  },
});

test('shows the v7 route fallback until the initial session check finishes', async ({
  page,
}) => {
  let pending: Route | undefined;
  let holdSessionCheck = true;
  await page.route('**/api/auth/me', (route) => {
    if (holdSessionCheck) pending = route;
    else return route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Einen Moment …')).toBeVisible();
  await expect(page.getByRole('heading')).toHaveCount(0);
  await expect.poll(() => Boolean(pending)).toBe(true);
  if (!pending) throw new Error('Expected pending session request');
  holdSessionCheck = false;
  await pending.continue();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Willkommen zurück.' }),
  ).toBeVisible();
});

test('checks authentication again when browser Back revisits a protected route', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/unknown');
  await expect(page.getByText('Hier ist noch nichts.')).toBeVisible();
  await page.getByRole('link', { name: 'Zur Startseite' }).click();
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Willkommen zurück.' }),
  ).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});

test('disables the form while login is pending', async ({ page }) => {
  let pending: Route | undefined;
  await page.goto('/login');
  await fillLogin(page);
  await page.route('**/api/auth/login', (route) => {
    pending = route;
  });
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Anmeldung läuft …' }),
  ).toBeDisabled();
  await expect(page.getByLabel('E-Mail-Adresse')).toBeDisabled();
  await expect.poll(() => Boolean(pending)).toBe(true);
  if (!pending) throw new Error('Expected pending login request');
  await pending.continue();
  await expect(
    page.getByRole('heading', { name: 'Willkommen in SnippetShelf.' }),
  ).toBeVisible();
});

test('protects the homepage and validates required fields before a login request', async ({
  page,
}) => {
  let loginRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/login')) loginRequests++;
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle('Anmelden · SnippetShelf');
  await page.screenshot({
    path: resolve(screenshots, 'login-desktop.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(
    page.getByText('Bitte gib eine gültige E-Mail-Adresse ein.'),
  ).toBeVisible();
  await expect(page.getByText('Bitte gib dein Passwort ein.')).toBeVisible();
  expect(loginRequests).toBe(0);
});

test('reports wrong credentials safely and permits correcting them', async ({
  page,
}) => {
  await page.goto('/login');
  await fillLogin(page);
  await page.getByLabel(/^Passwort(?:\s*\*)?$/).fill('incorrect-password');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'E-Mail oder Passwort ist nicht richtig.',
  );
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(
    credentials.email,
  );
  await page.getByLabel(/^Passwort(?:\s*\*)?$/).fill(credentials.password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('keeps login on reload, redirects authenticated login visits, and invalidates logout', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Willkommen in SnippetShelf.' }),
  ).toBeVisible();
  await expect(page.getByText(credentials.email)).toBeVisible();
  await page.screenshot({
    path: resolve(screenshots, 'home-desktop.png'),
    fullPage: true,
  });
  const cookies = await context.cookies();
  const cookie = cookies.find((entry) => entry.name === 'snippet.sid');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'snippet.sid',
  );
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({ local: [], session: [] });
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await context.addCookies(cookies);
  const response = await context.request.get('/api/auth/me');
  expect(response.status()).toBe(401);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('supports keyboard login, password visibility, and a narrow mobile layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('E-Mail-Adresse')).toBeFocused();
  await page.keyboard.type(credentials.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/^Passwort(?:\s*\*)?$/)).toBeFocused();
  await page.keyboard.type(credentials.password);
  await page.getByRole('button', { name: 'Passwort anzeigen' }).click();
  await expect(page.getByLabel(/^Passwort(?:\s*\*)?$/)).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Passwort verbergen' }).click();
  await expect(page.getByLabel(/^Passwort(?:\s*\*)?$/)).toHaveAttribute(
    'type',
    'password',
  );
  await page.screenshot({
    path: resolve(screenshots, 'login-mobile.png'),
    fullPage: true,
  });
  await page.getByLabel(/^Passwort(?:\s*\*)?$/).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Willkommen in SnippetShelf.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve(screenshots, 'home-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('handles a lost session on reload', async ({ page, context }) => {
  await signIn(page);
  await context.clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test('shows a retry state for an unavailable server instead of exposing the homepage', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 503, json: failureBody('DATABASE_UNAVAILABLE') }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Kurz nicht erreichbar.' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'Server ist gerade nicht erreichbar',
  );
  await expect(page.getByText('provider detail', { exact: false })).toHaveCount(
    0,
  );
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('retains the form after a network failure and allows retry', async ({
  page,
}) => {
  await page.goto('/login');
  await fillLogin(page);
  await page.route('**/api/auth/login', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Server ist gerade nicht erreichbar',
  );
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(
    credentials.email,
  );
  await page.unroute('**/api/auth/login');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const code of ['CSRF_INVALID', 'RATE_LIMITED']) {
  test(`shows a safe ${code} message without navigating`, async ({ page }) => {
    await page.goto('/login');
    await fillLogin(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: code === 'CSRF_INVALID' ? 403 : 429,
        json: failureBody(code),
      }),
    );
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      code === 'CSRF_INVALID'
        ? 'Sitzung hat sich geändert'
        : 'Zu viele Anmeldeversuche',
    );
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('retains the authenticated page after failed logout and permits retry', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({ status: 503, json: failureBody('SERVICE_UNAVAILABLE') }),
  );
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Server ist gerade nicht erreichbar',
  );
  await expect(page).toHaveURL(/\/$/);
  await page.unroute('**/api/auth/logout');
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('does not trust a forged redirect query and handles unknown routes', async ({
  page,
}) => {
  await page.goto('/login?redirect=https://example.org');
  await fillLogin(page);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(`${process.env.E2E_BASE_URL}/`);
  await page.goto('/does-not-exist');
  await expect(
    page.getByRole('heading', { name: 'Hier ist noch nichts.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Zur Startseite' }).click();
  await expect(page).toHaveURL(/\/$/);
});
