import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test.describe('StatusCraft editor', () => {
  test('welcomes new visitors with starter kits', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toContainText('Pick a starter kit');
    await page.getByRole('button', { name: /Minimal/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Live preview')).toBeVisible();
  });

  test('adds a brick by clicking it in the brick box', async ({ page }) => {
    await openEditor(page);
    await page.getByText('Session Cost', { exact: true }).first().click();
    await expect(page.getByText('This brick')).toBeVisible();
    await expect(page.locator('.terminal')).toContainText('Cost $3.87');
  });

  test('shows warning colors in the danger scenario', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: /Danger/ }).click();
    await expect(page.locator('.terminal')).toContainText('Ctx 93%');
    await expect(page.getByText('Pip feels panic')).toBeVisible();
  });

  test('shares a layout as an install command in demo mode', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: /Share/ }).click();
    await expect(page.getByRole('dialog').locator('input').first()).toHaveValue(/^npx statuscraft apply sc1\./);
  });

  test('drags a brick from the brick box onto the line', async ({ page }) => {
    await openEditor(page);
    const brick = page.getByText('Weekly limit', { exact: true }).first();
    await brick.scrollIntoViewIfNeeded();
    const line = page.getByText(/^Line 1/).first();
    const from = (await brick.boundingBox())!;
    const to = (await line.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 400, to.y + 40, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('.terminal')).toContainText('7d 38%');
  });

  test('ignores a brick dropped outside the baseplate', async ({ page }) => {
    await openEditor(page);
    const before = (await page.locator('.terminal').textContent()) ?? '';
    const brick = page.getByText('Weekly limit', { exact: true }).first();
    await brick.scrollIntoViewIfNeeded();
    const from = (await brick.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y - 120, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('.terminal')).toHaveText(before);
  });
});

