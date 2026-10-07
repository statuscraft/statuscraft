import { expect, test, type Page } from '@playwright/test';

async function openMods(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: /Mods/ }).click();
  await expect(page.getByText('Claude Code, with your mods')).toBeVisible();
}

async function drag(page: Page, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test.describe('StatusCraft mods', () => {
  test('adds a spinner mod by clicking it in the mod box', async ({ page }) => {
    await openMods(page);
    await page.getByText('Tool Counter', { exact: true }).first().click();
    await expect(page.getByText('This mod')).toBeVisible();
    await expect(page.locator('[data-slot="spinner"]')).toContainText('🔧 7 tools');
    await expect(page.getByText('placed').first()).toBeVisible();
  });

  test('drags the live status line onto the band above the prompt', async ({ page }) => {
    await openMods(page);
    const mod = page.getByText('Live Status Line', { exact: true }).first();
    const band = page.locator('[data-slot="band"]');
    await band.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const target = (await band.boundingBox())!;
    await drag(page, (await mod.boundingBox())!, { x: target.x + 200, y: target.y + target.height / 2 });
    await expect(band).toContainText('Opus 5.5');
  });

  test('puts a mod dropped on the wrong spot where it belongs', async ({ page }) => {
    await openMods(page);
    const mod = page.getByText('Turn Timer', { exact: true }).first();
    await page.locator('[data-slot="hint"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const hint = (await page.locator('[data-slot="hint"]').boundingBox())!;
    await drag(page, (await mod.boundingBox())!, { x: hint.x + 100, y: hint.y + hint.height / 2 });
    await expect(page.locator('[data-slot="spinner"]')).toContainText('⏱');
    await expect(page.getByText(/lives in “Spinner”/)).toBeVisible();
  });

  test('pops up alerts and asks before risky commands in the danger scenario', async ({ page }) => {
    await openMods(page);
    await page.getByText('Context Alert', { exact: true }).first().click();
    await page.getByText('Danger Guard', { exact: true }).first().click();
    await page.getByRole('button', { name: '😱 Danger' }).click();
    await expect(page.locator('.terminal')).toContainText('Context is 93% full');
    await page.getByLabel('Try a command').fill('git push --force');
    await expect(page.getByText(/force pushes/).first()).toBeVisible();
    await page.getByLabel('Try a command').fill('git status');
    await expect(page.getByText('✓ Runs as usual.')).toBeVisible();
  });

  test('remembers mods in demo mode', async ({ page }) => {
    await openMods(page);
    await page.getByText('Context Meter', { exact: true }).first().click();
    await expect(page.locator('[data-slot="band"]')).toContainText('56%');
    await page.reload();
    await expect(page.locator('[data-slot="band"]')).toContainText('56%');
  });

  test('undoes a mod after visiting the status line tab', async ({ page }) => {
    await openMods(page);
    await page.getByText('Context Meter', { exact: true }).first().click();
    await page.getByRole('tab', { name: /Status line/ }).click();
    await page.getByRole('tab', { name: /Mods/ }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-slot="band"]')).toContainText('drop a mod here');
  });

  test('times slow tool calls on their rows', async ({ page }) => {
    await openMods(page);
    await page.getByText('Tool Timer', { exact: true }).first().click();
    const tools = page.locator('[data-slot="tools"]');
    await expect(tools).toContainText('Bash(npm test) ⏱ 4.2s');
    await expect(tools).not.toContainText('Read(src/settings.tsx) ⏱');
  });

  test('protects files and grows prompt shortcuts', async ({ page }) => {
    await openMods(page);
    await page.getByText('Protected Files', { exact: true }).first().click();
    await page.getByLabel('Try a file Claude wants to change').fill('/repo/.git/config');
    await expect(page.getByText(/matches “\.git\/”/)).toBeVisible();
    await expect(page.locator('[data-slot="guard"]')).toContainText('🛡️ asks Edit .env');
    await page.getByText('Prompt Shortcuts', { exact: true }).first().click();
    await expect(page.locator('[data-slot="prompt"]')).toContainText(';tests → Write tests');
  });
});
