import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

for (const width of [360, 768, 1440]) {
  test(`manages and copies snippets at ${width}px`, async ({
    page,
    context,
  }) => {
    const {
      E2E_EMAIL: email,
      E2E_PASSWORD: password,
      E2E_BASE_URL: origin,
    } = process.env;
    if (!email || !password || !origin)
      throw new Error('Use the isolated E2E runner');
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin,
    });
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel(/^Passwort(?:\s*\*)?$/).fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByRole('button', { name: 'Befehlsvorlagen' }).click();
    const sample = page.getByRole('article', {
      name: 'Git-Status kompakt anzeigen',
    });
    await sample.getByRole('button', { name: 'Kopieren' }).click();
    await expect(sample.getByRole('status')).toHaveText('Kopiert');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'git status --short --branch',
    );
    await sample.getByRole('button', { name: 'Als Snippet anpassen' }).click();
    await expect(page.getByRole('dialog').getByLabel('Titel')).toHaveValue(
      'Git-Status kompakt anzeigen',
    );
    await page.getByRole('dialog').getByLabel('Titel').fill('Eigener Entwurf');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await expect(page.getByRole('dialog').getByLabel('Titel')).toHaveValue(
      'Eigener Entwurf',
    );
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await page.getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await expect(page.getByText('Deine Sammlung ist noch leer')).toBeVisible();
    await page.getByRole('button', { name: 'Neues Snippet' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(
      dialog.getByText('Bitte gib einen Titel mit 1–120 Zeichen ein.'),
    ).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Vorlage' }).click();
    await page
      .getByRole('option', { name: 'Git-Status kompakt anzeigen' })
      .click();
    const title = 'Mein Git-Status ' + width;
    const code = '  git status --short\n' + '#' + 'x'.repeat(210) + '\n';
    await dialog.getByLabel('Titel').fill(title);
    await dialog.getByLabel('Code oder Befehl').fill(code);
    await dialog
      .getByLabel('Labels', { exact: true })
      .fill(' Bash, Linux, bash');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    const card = page.getByRole('article', { name: title, exact: true });
    await expect(card).toBeVisible();
    await page.reload();
    await expect(card.locator('code')).toHaveText(code, {
      useInnerText: false,
    });
    await card.getByRole('button', { name: 'Kopieren' }).click();
    await expect(card.getByRole('status')).toHaveText('Kopiert');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      code,
    );
    await card.getByRole('button', { name: 'Favorit', exact: true }).click();
    await expect(
      card.getByRole('button', { name: 'Favorit', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Nur Favoriten').check();
    await card.getByRole('button', { name: 'linux', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Ausführungsumgebung' }),
    ).toHaveText('linux');
    await page.getByLabel('Nach Labels gruppieren').check();
    await expect(
      page.getByRole('heading', { name: 'bash', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'linux', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: resolve('.artifacts/web/screenshots', `shelf-${width}.png`),
      fullPage: true,
    });
    await page.getByLabel('Nach Labels gruppieren').uncheck();
    const search = page.getByLabel('Suche in Titel und Code');
    await search.fill('kein solcher Befehl');
    await expect(page.getByText('Keine passenden Snippets')).toBeVisible();
    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await card.getByRole('button', { name: 'Bearbeiten' }).click();
    await dialog.getByLabel('Titel').fill(title + ' geändert');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    const changed = page.getByRole('article', { name: title + ' geändert' });
    await changed.getByRole('button', { name: 'Löschen', exact: true }).click();
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(changed).toBeVisible();
    await changed.getByRole('button', { name: 'Löschen', exact: true }).click();
    await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByText('Deine Sammlung ist noch leer')).toBeVisible();
  });
}
