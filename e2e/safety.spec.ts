import { expect, test, type Page } from '@playwright/test';
import { createDefaultConfig, getPreset, type CommandApproval } from '../packages/core/src';

async function connectedEditor(page: Page, commands = true) {
  const layout = commands ? { ...getPreset('minimal')!.layout, lines: [[{ id: 'command', type: 'custom-command', commandPath: 'echo reviewed' }]] } : getPreset('minimal')!.layout;
  const config = createDefaultConfig(layout);
  const approvals: CommandApproval[] = [];
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  let revision: string | null = JSON.stringify(config);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postDataJSON() as Record<string, unknown> | null;
    if (request.method() !== 'GET') calls.push({ path, body: body ?? {} });
    let data: unknown;
    if (path === '/api/state') data = {
      version: '1.1.0', config, configPath: '/config/config.json', configExists: true, configRevision: revision,
      commandTrust: { version: 1, approvals }, hasLastInput: false,
      install: { configured: true, ours: true, settingsFile: '/claude/settings.json', disabledByHooksSetting: false },
      project: { dir: '/work', errors: [], projectRevision: null, localRevision: null },
    };
    else if (path === '/api/mods' && request.method() === 'GET') data = {
      mods: { version: 1, mods: [] }, path: '/config/mods.json', exists: false, revision: null,
      commandTrust: { version: 1, approvals }, plugin: { claude: { found: false }, modsSupported: false, installed: false, enabled: false, disabledByHooksSetting: false },
    };
    else if (path === '/api/config') { revision = JSON.stringify(body?.config); data = { saved: true }; }
    else if (path === '/api/commands/trust') { approvals.push(...body?.approvals as CommandApproval[]); data = { approved: true }; }
    else data = {};
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  await page.goto('/');
  if (await page.getByRole('dialog').isVisible()) await page.getByRole('button', { name: 'Close' }).click();
  return { calls, initialRevision: revision };
}

test('declining command approval saves the design without authorizing execution', async ({ page }) => {
  const { calls, initialRevision } = await connectedEditor(page);
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('echo reviewed');
    expect(dialog.message()).toContain('Cancel saves your design');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: /Apply/ }).click();
  await expect.poll(() => calls.filter((call) => call.path === '/api/config').length).toBe(1);
  expect(calls.find((call) => call.path === '/api/config')?.body.expectedRevision).toBe(initialRevision);
  expect(calls.filter((call) => call.path === '/api/commands/trust')).toHaveLength(0);
});

test('accepting the review authorizes only the exact displayed command', async ({ page }) => {
  const { calls } = await connectedEditor(page);
  page.once('dialog', async (dialog) => { expect(dialog.message()).toContain('echo reviewed'); await dialog.accept(); });
  await page.getByRole('button', { name: /Apply/ }).click();
  await expect.poll(() => calls.filter((call) => call.path === '/api/commands/trust').length).toBe(1);
  expect(calls.find((call) => call.path === '/api/commands/trust')?.body.approvals).toEqual([{ kind: 'statusline', scope: 'global', command: 'echo reviewed' }]);
});

test('built-in presets save without a command approval prompt', async ({ page }) => {
  const { calls } = await connectedEditor(page, false);
  let prompted = false;
  page.on('dialog', async (dialog) => { prompted = true; await dialog.dismiss(); });
  await page.getByRole('button', { name: /Apply/ }).click();
  await expect.poll(() => calls.filter((call) => call.path === '/api/config').length).toBe(1);
  expect(prompted).toBe(false);
});
