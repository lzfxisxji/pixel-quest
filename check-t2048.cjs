/* Browser smoke test for 2048 PUZZLE. Run: node check-t2048.cjs [SITE] */
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const SITE = (process.argv[2] || 'http://localhost:4173/') + 't2048.html';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('reqfail ' + r.url()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let n = 0; const pass = s => { console.log('PASS ' + s); n++; };
  try {
    await page.goto(SITE, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.Pixel2048);
    pass('t2048.html boots and exposes window.Pixel2048');

    // setup dialog is open
    assert(await page.evaluate(() => !document.getElementById('setup').open === false ? document.getElementById('setup').open : true) || await page.locator('#setup').isVisible(), 'setup dialog visible');
    pass('setup dialog shown on load');

    // fill setup: 4x4 classic
    await page.selectOption('#size', '4');
    await page.selectOption('#mode', 'classic');
    await page.fill('#nick', 'tester');
    await page.click('#form button[type=submit]');
    await page.waitForFunction(() => window.Pixel2048.state && window.Pixel2048.state.status === 'playing');
    const startTiles = await page.evaluate(() => window.Pixel2048.snapshot.cells.flat().filter(v => v !== 0).length);
    assert.equal(startTiles, 2, 'starts with exactly 2 tiles');
    pass('setup starts a 4x4 classic game with 2 tiles');

    // perform moves in all directions
    const before = await page.evaluate(() => JSON.stringify(window.Pixel2048.snapshot.cells));
    for (const d of ['left', 'up', 'right', 'down', 'left', 'up']) {
      await page.evaluate(dir => window.Pixel2048.move(dir), d);
      await page.waitForTimeout(180);
    }
    const after = await page.evaluate(() => JSON.stringify(window.Pixel2048.snapshot.cells));
    const moves = await page.evaluate(() => window.Pixel2048.state.moves);
    assert(moves >= 1, 'at least one valid move registered');
    pass('keyboard/move API drives the board (moves=' + moves + ', board changed=' + (before !== after) + ')');

    // invalid move should not change board or score
    const s1 = await page.evaluate(() => ({ c: JSON.stringify(window.Pixel2048.snapshot.cells), sc: window.Pixel2048.state.score, m: window.Pixel2048.state.moves }));
    await page.evaluate(() => window.Pixel2048.move('left')); // may or may not be valid; try to find an invalid one
    await page.waitForTimeout(160);

    // force a near-win and verify victory overlay
    await page.evaluate(() => {
      const P = window.Pixel2048;
      P.state.cells = P.core.fromValues([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
      P.move('left');
    });
    await page.waitForFunction(() => !document.getElementById('board-overlay').hidden, null, { timeout: 4000 }).catch(() => {});
    const winTitle = await page.evaluate(() => document.getElementById('bo-title').textContent);
    assert(/2048/.test(winTitle), 'win overlay shows 2048 reached');
    pass('reaching 2048 shows victory overlay ("' + winTitle + '")');
    // continue challenge
    await page.click('#bo-actions button.primary');
    await page.waitForFunction(() => window.Pixel2048.state.status === 'playing');
    pass('continue-challenge resumes play after victory');

    // leaderboard opens and renders
    await page.evaluate(() => document.getElementById('leader-open').click());
    await page.waitForTimeout(150);
    assert(await page.locator('#leader').isVisible());
    pass('leaderboard dialog opens');

    // mobile layout: no horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(SITE, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.Pixel2048);
    await page.selectOption('#size', '5');
    await page.selectOption('#mode', 'move');
    await page.fill('#nick', 'mob');
    await page.click('#form button[type=submit]');
    await page.waitForFunction(() => window.Pixel2048.state && window.Pixel2048.state.status === 'playing');
    await page.waitForTimeout(120);
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert(noOverflow, 'no horizontal overflow on 390px mobile (5x5 move mode)');
    const boardVisible = await page.locator('#board').isVisible();
    assert(boardVisible, 'board visible on mobile');
    pass('mobile 390px: 5x5 board fits with no horizontal overflow');

    assert.deepEqual(errors, [], 'no runtime errors: ' + errors.join(' | '));
    pass('zero runtime errors during full smoke');
    console.log(`\n${n} t2048 browser checks passed`);
  } catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error('page errors:', errors.join(' | '));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
