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
    await page.evaluate(() => { start(); loadStage(4); });
    await page.waitForFunction(() => window.PixelQuest.snapshot.course === '2-1', 'loaded 2-1');
    pass('loaded 2-1 live');

    // Drive right + jump repeatedly to reach the final stairs and flag.
    await page.keyboard.down('ArrowRight');
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(160);
    }
    await page.keyboard.up('ArrowRight');

    const snap = await page.evaluate(() => ({ state: window.PixelQuest.snapshot && window.PixelQuest.snapshot.state, playerX: player && player.x, finishTime: finishTime, worldLength: world && world.length }));
    assert(['playing', 'gameover', 'stageclear', 'victory'].includes(snap.state), 'state must stay valid: ' + snap.state);
    pass('2-1 ran live for 5s with valid state: playerX=' + snap.playerX + ' state=' + snap.state);

    assert(errors.length === 0, 'no runtime errors during live 2-1: ' + errors.join(' | '));
    pass('no runtime/page errors while playing 2-1');
    console.log(`\nALL ${n} CHECKS PASSED`);
  } catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error('PAGE ERRORS:', errors);
    process.exit(1);
  } finally { await browser.close(); }
})();
