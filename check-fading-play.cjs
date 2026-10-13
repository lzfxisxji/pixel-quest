const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const SITE = process.argv[2] || ('file://' + require('path').resolve(__dirname, 'index.html'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let n = 0; const pass = s => { console.log('PASS ' + s); n++; };
  try {
    await page.goto(SITE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.PixelQuest && window.loadStage, 'globals ready');
    await page.evaluate(() => { start(); loadStage(5); });
    await page.waitForFunction(() => window.PixelQuest.snapshot.course === '2-2', 'loaded 2-2');
    const meta = await page.evaluate(() => ({ kind: window.PixelQuest.snapshot.scene, course: window.PixelQuest.snapshot.course }));
    assert.equal(meta.course, '2-2', 'must be on 2-2');
    pass('loaded 2-2 live without throwing during build');

    // Drive right + jump repeatedly for ~3s to exercise fading platforms in the second half.
    await page.keyboard.down('ArrowRight');
    const t0 = Date.now();
    while (Date.now() - t0 < 3200) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(160);
    }
    await page.keyboard.up('ArrowRight');

    const snap = await page.evaluate(() => window.PixelQuest.snapshot);
    assert(['playing', 'gameover', 'stageclear', 'victory'].includes(snap.state), 'state must stay valid: ' + snap.state);
    pass('2-2 ran live for ~3.2s (moving + jumping) with a valid game state: ' + snap.state);

    assert(errors.length === 0, 'no runtime errors during live 2-2: ' + errors.join(' | '));
    pass('no runtime/page errors while playing 2-2 with fading platforms');
    console.log(`\nALL ${n} CHECKS PASSED`);
  } catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error('PAGE ERRORS:', errors);
    process.exit(1);
  } finally { await browser.close(); }
})();
