// The six heroes are shared by all five modes. Whatever the player picks last
// in 1P should preselect the next mode they open, without locking the choice.
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('assert/strict');
const BASE = 'http://localhost:4173/';

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  // A dedicated context keeps pq-hero out of every other suite's storage.
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let n = 0;
  const pass = s => { n++; console.log('PASS ' + s); };
  try {
    // 1. a stored hero preselects 1P in tank
    await p.goto(BASE + 'tank.html');
    await p.waitForFunction(() => window.PixelTank);
    await p.evaluate(() => localStorage.setItem('pq-hero', 'nezha'));
    await p.reload();
    await p.waitForFunction(() => window.PixelTank);
    assert.equal(await p.evaluate(() => PixelTank.pick.p1), 'nezha');
    assert.equal(await p.locator('#roster1 button[aria-pressed="true"]').count(), 1);
    pass('a remembered hero preselects 1P in tank battle');

    // 2. picking a different hero there is remembered for the next mode
    await p.locator('#roster1 button[data-id=goku]').click();
    assert.equal(await p.evaluate(() => localStorage.getItem('pq-hero')), 'goku');
    pass('picking in tank battle updates the remembered hero');

    // 3. bomber and badminton read the same key
    await p.goto(BASE + 'bomber.html');
    await p.waitForFunction(() => window.PixelBomber);
    assert.equal(await p.evaluate(() => PixelBomber.pick.p1), 'goku');
    pass('bomber arena preselects the same hero');

    await p.goto(BASE + 'badminton.html');
    await p.waitForFunction(() => window.PixelBadminton);
    assert.equal(await p.evaluate(() => PixelBadminton.snapshot.options.character), 'goku');
    pass('shuttle club preselects the same hero');

    // 4. fighting keeps p2 distinct so a mirror match cannot start
    await p.goto(BASE + 'fighting.html');
    await p.waitForFunction(() => window.PixelFighting);
    const pressed = await p.locator('#p1-roster button[aria-pressed="true"]').getAttribute('data-character');
    const p2pressed = await p.locator('#p2-roster button[aria-pressed="true"]').getAttribute('data-character');
    assert.ok(pressed && p2pressed, 'both fighters must be preselected');
    assert.notEqual(pressed, p2pressed, 'p1 and p2 must never be the same hero');
    assert.equal(pressed, 'goku', 'the remembered hero preselects p1');
    pass('pixel clash never starts a mirror match from the remembered hero');

    // 5. the player can still override it inside a mode
    await p.goto(BASE + 'tank.html');
    await p.waitForFunction(() => window.PixelTank);
    await p.locator('#roster1 button[data-id=dora]').click();
    assert.equal(await p.evaluate(() => PixelTank.pick.p1), 'dora');
    pass('the preselect is only a default and stays overridable');

    // 6. a corrupt stored value falls back instead of breaking setup
    await p.evaluate(() => localStorage.setItem('pq-hero', 'not-a-hero'));
    await p.reload();
    await p.waitForFunction(() => window.PixelTank);
    assert.equal(await p.locator('#roster1 button[aria-pressed="true"]').count(), 1);
    pass('an invalid stored hero falls back to a valid default');

    assert.deepEqual(errors, []);
    pass('no runtime errors while switching heroes across modes');
    console.log(`\n${n} shared-hero checks passed`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await ctx.close(); await b.close(); }
})();
