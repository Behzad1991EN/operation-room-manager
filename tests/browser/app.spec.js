import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
async function open(page, route = 'dashboard') {
  await page.goto(`./#/${route}`);
  await expect(page.locator('main h1')).toBeVisible();
}
async function setupDemo(page) {
  await open(page, 'employees');
  await page.getByRole('button', { name: 'Try demo employees' }).click();
  await expect(page.locator('.employee-card')).toHaveCount(16);
  await open(page, 'calendar');
  await page.getByLabel('Persian year').fill('1405');
  await page.getByLabel('Persian month').selectOption('6');
  await page.getByRole('button', { name: 'Apply month' }).click();
  await expect(page.locator('#notification')).toHaveText('Planning month updated.');
  await page.getByLabel('I reviewed official holidays for this month.').check();
  await open(page, 'generate');
  await page.getByLabel('I reviewed requested leave for this month.').check();
  await expect(page.locator('#notification')).toHaveText('Requested leave review saved.');
}
test('employee create, edit, delete, import preview and persistence', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, 'employees');
  await page.getByRole('button', { name: 'Add your first employee' }).click();
  await page.getByLabel('Full name').fill('کارمند آزمایشی');
  await page.getByLabel('Years of service', { exact: true }).fill('5');
  await page.getByLabel('Productivity category').selectOption('4–8');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.locator('.employee-card')).toHaveCount(1);
  await page.reload(); await expect(page.getByRole('heading', { name: 'کارمند آزمایشی' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit کارمند آزمایشی' }).click();
  await page.getByLabel('Years of service', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByText('9 years of service', { exact: false })).toBeVisible();
  await page.locator('#employee-file').setInputFiles({ name: 'team.csv', mimeType: 'text/csv', buffer: Buffer.from('name,yearsOfService,radiationBenefit,productivityCategory\nSecond employee,3,false,0-4\n') });
  await expect(page.getByRole('heading', { name: 'Review employee import' })).toBeVisible();
  await expect(page.locator('.employee-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Apply import' }).click();
  await expect(page.locator('.employee-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Second employee' }).click();
  await page.getByRole('button', { name: 'Delete employee', exact: true }).click();
  await expect(page.locator('.employee-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('an employee displayed after saving survives reload with a delayed storage commit', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const transaction = original.apply(this, args);
      if (this.name === 'operation-room-manager' && args[1] === 'readwrite') {
        const store = transaction.objectStore('application');
        const until = performance.now() + 400;
        const keepOpen = () => {
          if (performance.now() < until) store.get('test-commit-delay').onsuccess = keepOpen;
        };
        keepOpen();
      }
      return transaction;
    };
  });
  await open(page, 'employees');
  await page.getByRole('button', { name: 'Add your first employee' }).click();
  await page.getByLabel('Full name').fill('Durable employee');
  await page.getByLabel('Years of service', { exact: true }).fill('5');
  await page.getByLabel('Productivity category').selectOption('4–8');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.locator('#save-indicator')).toHaveText('Saving…');
  await expect(page.locator('.employee-card')).toHaveCount(0);
  await expect(page.locator('.employee-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Durable employee' })).toBeVisible();
});
test('calendar holiday overlap, review invalidation and keyboard navigation', async ({ page }) => {
  await open(page, 'calendar');
  await page.getByLabel('Persian year').fill('1405'); await page.getByLabel('Persian month').selectOption('6');
  await page.getByRole('button', { name: 'Apply month' }).click();
  await expect(page.locator('#notification')).toHaveText('Planning month updated.');
  const friday = page.locator('.calendar-day.friday').first();
  await friday.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.calendar-day.friday.official')).toHaveCount(1);
  await page.getByLabel('I reviewed official holidays for this month.').check();
  await expect(page.locator('#notification')).toHaveText('Official holiday review saved.');
  await page.reload(); await expect(page.locator('.calendar-day.friday.official')).toHaveCount(1);
  await expect(page.getByLabel('I reviewed official holidays for this month.')).toBeChecked();
  await page.locator('.calendar-day.friday.official').click();
  await expect(page.getByLabel('I reviewed official holidays for this month.')).not.toBeChecked();
});
test('real module Worker, validation, schedule, reports, export, reload and stale data', async ({ page }) => {
  const errors = [], failed = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/') && !process.env.APP_URL) external.push(r.url()); });
  await setupDemo(page); await open(page, 'employees');
  await page.getByRole('button', { name: 'Edit Demo employee 13', exact: true }).click();
  await page.getByRole('combobox', { name: 'چهارشنبه · Wednesday', exact: true }).selectOption('N');
  await page.getByRole('combobox', { name: 'پنج شنبه · Thursday', exact: true }).selectOption('M');
  await page.getByRole('button', { name: 'Save employee', exact: true }).click();
  await expect(page.locator('#notification')).toHaveText('Employee saved.');
  await page.reload();
  await page.getByRole('button', { name: 'Edit Demo employee 13', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'چهارشنبه · Wednesday', exact: true })).toHaveValue('N');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await open(page, 'generate');
  await expect(page.getByRole('button', { name: 'Generate schedule', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Enter requested days off' }).click();
  await page.getByLabel('Demo employee 01 — leave day numbers', { exact: true }).fill('۱، ۲، ۳، ۴');
  await page.getByLabel('Demo employee 13 — leave day numbers', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Save requested leave' }).click();
  await expect(page.locator('#notification')).toHaveText('Requested leave saved.');
  await page.reload();
  await expect(page.getByLabel('I reviewed requested leave for this month.')).toBeChecked();
  await page.getByRole('button', { name: 'Enter requested days off' }).click();
  await expect(page.getByLabel('Demo employee 01 — leave day numbers', { exact: true })).toHaveValue('1, 2, 3, 4');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Generate schedule', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel generation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A validated plan is ready.' })).toBeVisible({ timeout: 75000 });
  await open(page, 'schedule'); await expect(page.locator('table.matrix tbody tr')).toHaveCount(16);
  const csv = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV' }).click();
  const downloaded = await csv;
  expect(downloaded.suggestedFilename()).toBe('schedule-1405-06.csv');
  const contents = await readFile(await downloaded.path(), 'utf8');
  expect(contents.charCodeAt(0)).toBe(0xFEFF);
  expect(contents).toContain('1405-06-06 (جمعه)');
  expect(contents).toContain('1405-06-07 (شنبه)');
  expect(contents).toContain('"LEAVE"');
  const html = page.waitForEvent('download'); await page.getByRole('button', { name: 'Printable HTML' }).click();
  expect((await html).suggestedFilename()).toBe('schedule-1405-06-print.html');
  await page.getByRole('button', { name: 'Employee view', exact: true }).click();
  await expect(page.locator('.daily-row')).toHaveCount(31);
  await expect(page.locator('.daily-row .code.LEAVE')).toHaveCount(4);
  await page.getByLabel('Select employee').selectOption('demo-2'); await expect(page.getByRole('heading', { name: 'Demo employee 02' })).toBeVisible();
  await open(page, 'reports'); await expect(page.locator('.distribution-card')).toHaveCount(16);
  await page.reload(); await expect(page.locator('.distribution-card')).toHaveCount(16);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'schedule');
    await page.getByRole('button', { name: 'Employee view', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/schedule-employee-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Full matrix', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await open(page, 'reports');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await open(page, 'dashboard');
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
  }
  await open(page, 'calendar'); await page.locator('.calendar-day:not(.friday)').first().click();
  await open(page, 'schedule'); await expect(page.getByRole('heading', { name: 'No current schedule yet' })).toBeVisible();
  expect(errors).toEqual([]); expect(failed).toEqual([]); expect(external).toEqual([]);
});
test('cancellation ends generation promptly and permits another run', async ({ page }) => {
  await setupDemo(page); await open(page, 'generate');
  await page.getByRole('button', { name: 'Generate schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel generation' }).click();
  await expect(page.locator('.badge', { hasText: 'CANCELLED' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate schedule', exact: true })).toBeEnabled();
});
test('invalid import is atomic and continuous mode requires history', async ({ page }) => {
  await setupDemo(page);
  await page.locator('#employee-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('[{"name":"No service"}]') });
  await expect(page.getByRole('heading', { name: 'Import could not be completed' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await open(page, 'employees'); await expect(page.locator('.employee-card')).toHaveCount(16);
  await open(page, 'generate'); await page.getByLabel('Validation scope').selectOption('continuous');
  await page.getByRole('button', { name: 'Generate schedule', exact: true }).click();
  await expect(page.locator('#notification')).toContainText('Enter previous-month assignments');
  await page.getByRole('button', { name: 'Enter previous assignments' }).click();
  await expect(page.locator('.history-person')).toHaveCount(12);
});
for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) test(`all ordinary pages fit ${width}px without horizontal overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await setupDemo(page);
  for (const route of ['dashboard', 'employees', 'calendar', 'generate', 'rules']) {
    await open(page, route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${route} overflows ${width}px`).toBe(false);
  }
  await open(page, 'employees');
  await page.getByRole('button', { name: 'Edit Demo employee 01', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'چهارشنبه · Wednesday', exact: true })).toBeVisible();
  expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/weekly-pattern-${width}.png` });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await open(page, 'generate');
  await page.getByRole('button', { name: 'Enter requested days off' }).click();
  expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/requested-leave-${width}.png` });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).isVisible().then(async visible => {
    if (visible) { await page.getByRole('button', { name: 'Toggle navigation' }).click(); await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible(); await page.keyboard.press('Escape'); }
  });
  await page.screenshot({ path: `test-results/responsive-${width}.png`, fullPage: true });
});
