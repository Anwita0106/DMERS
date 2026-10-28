// Browser end-to-end check of the main flow (needs the API and the frontend running).
//   BASE=http://localhost:4173 node tests_e2e/ui_flow.cjs
// Writes a citizen account and one incident into the database it runs against: use a test copy.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:5173';
const stamp = Date.now();
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const page = async () => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.route(/basemaps\.cartocdn\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };
  // 1. Citizen fills the report wizard, creates an account at the last step, submits
  const c = await page();
  await c.goto(`${BASE}/report`);
  await c.locator('select').nth(0).selectOption('FLOOD');
  await c.locator('select').nth(1).selectOption('HIGH');
  await c.fill('input[placeholder="Brief title of the incident"]', `UI test flood ${stamp}`);
  await c.click('text=Next');
  await c.fill('input[placeholder^="e.g. Railway"]', 'Gandhi Road, Katpadi');
  await c.locator('select').first().selectOption({ label: 'Katpadi (Vellore)' });
  await c.click('text=Next');
  await c.fill('textarea', 'Water entering houses');
  await c.setInputFiles('input[type=file]', { name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a' + '00'.repeat(64), 'hex') });
  await c.click('text=Next');
  await c.fill('input[autocomplete="name"]', 'UI Tester');
  await c.fill('input[type=email]', `ui.tester.${stamp}@mail.example.com`);
  await c.fill('input[type=password]', 'Secret123');
  await c.click('button:has-text("Create citizen account")');
  await c.click('button:has-text("Submit report")');
  await c.waitForSelector('text=Report received');
  const ref = (await c.locator('b').filter({ hasText: '#' }).first().textContent()).replace('#', '');
  console.log('citizen report created #' + ref);
  // persistence: reload My reports and the report is still listed (read back from PostgreSQL)
  await c.goto(`${BASE}/my-reports`); await c.reload();
  await c.waitForSelector(`text=UI test flood ${stamp}`);
  console.log('report still listed after page refresh: OK');

  // 2. Coordinator verifies and dispatches from the incident drawer
  const k = await page();
  await k.goto(`${BASE}/login`);
  await k.fill('input[type=email]', 'priya.natarajan@dmers.example.org');
  await k.fill('input[type=password]', 'Dmers@2026');
  await k.click('form button.btn-primary');
  await k.waitForURL(/\/command/);
  await k.goto(`${BASE}/command/incidents?open=${ref}`);
  await k.click('button:has-text("Verify")');
  await k.locator('[role=dialog] select').first().selectOption({ index: 2 });
  await k.locator('[role=dialog] button:has-text("Verify")').click();
  await k.waitForSelector(`text=Incident #${ref} verified`);
  await k.click('button:has-text("Dispatch unit")');
  await k.locator('[role=dialog] .grid button').first().click();
  await k.locator('[role=dialog] button:has-text("Dispatch")').last().click();
  await k.waitForSelector('[aria-live] >> text=dispatched');
  await k.waitForTimeout(800);
  const status = await k.locator('aside .chip').nth(1).textContent();
  console.log('incident status after dispatch:', status);
  await k.click('button:has-text("Allocate relief")');
  await k.locator('[role=dialog] select').selectOption({ index: 1 });
  await k.locator('[role=dialog] button:has-text("Allocate")').click();
  await k.waitForSelector('[aria-live] >> text=allocated');
  await k.click('button:has-text("Close incident")');
  await k.locator('[role=dialog] button:has-text("Close incident")').click();
  await k.waitForSelector(`text=Incident #${ref} closed`);
  console.log('verify -> dispatch -> allocate -> close: OK');
  if (status.trim() !== 'Responding') throw new Error('expected Responding, got ' + status);
  if (errors.length) throw new Error('page errors: ' + errors.join('; '));
  console.log('UI FLOW PASSED');
  await b.close();
})().catch((e) => { console.error('UI FLOW FAILED:', e.message); process.exit(1); });
