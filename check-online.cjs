const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const SITE = process.argv[2] || process.env.PQ_SITE || 'http://localhost:4173/';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; const failed = [];
  const blocked = r => /fonts\.(googleapis|gstatic)\.com/.test(r.url());
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (!blocked(r)) failed.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400 && !blocked(r)) failed.push(r.status() + ' ' + r.url()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let n = 0; const pass = s => { console.log('PASS ' + s); n++; };
  try {
    const resp = await page.goto(SITE, { waitUntil: 'load' });
    assert.equal(resp.status(), 200, 'main document must be 200');
    await page.waitForFunction(() => window.PixelQuest?.state === 'title');
    assert((await page.title()).includes('小霸王游戏合集'), 'title must carry the current brand');
    pass('home page returns 200 with the expected title and brand');

    assert(await page.locator('#arcade-lobby').isVisible(), 'arcade lobby must be visible');
    assert.equal(await page.locator('.lobby-card').count(), 8);
    pass('arcade lobby shows all eight mode cards');

    for (const [id, url, api] of [
      ['play-badminton', 'badminton', 'PixelBadminton'],
      ['play-tank', 'tank', 'PixelTank'],
      ['play-fighting', 'fighting', 'PixelFighting'],
      ['play-bomber', 'bomber', 'PixelBomber'],
      ['play-blocks', 'blocks', 'PixelBlocks'],
      ['play-frost', 'frost', 'PixelFrost'],
      ['play-island', 'island', 'PixelIsland'],
    ]) {
      await page.goto(SITE);
      await page.waitForFunction(() => window.PixelQuest?.state === 'title');
      await page.locator(`[data-launch=${id}]`).click();
      await page.waitForURL('**/' + url + '.html');
      await page.waitForFunction(a => !!window[a], api);
      for (const g of ['PixelQuest', 'PixelBadminton', 'PixelTank', 'PixelFighting', 'PixelBomber', 'PixelBlocks', 'PixelFrost', 'PixelIsland'].filter(x => x !== api)) {
        assert.equal(await page.evaluate(k => typeof window[k], g), 'undefined',
          `${url}.html must not load ${g}`);
      }
      pass(`${url}.html boots standalone (only ${api} loaded)`);
    }

    await page.goto(SITE + 'kart.html');
    await page.waitForURL('**/tank.html');
    pass('legacy kart.html still redirects to tank.html');

    for (const w of [390, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.goto(SITE);
      await page.waitForFunction(() => window.PixelQuest?.state === 'title');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `horizontal overflow at ${w}px`);
      for (const id of ['play', 'play-badminton', 'play-tank', 'play-fighting', 'play-bomber', 'play-blocks', 'play-frost', 'play-island']) {
        assert(await page.locator(`[data-launch=${id}]`).isVisible(), `${id} card hidden at ${w}px`);
      }
    }
    pass('lobby fits phone, tablet and desktop with no horizontal overflow');

    assert.deepEqual(failed, [], 'no 4xx/5xx or failed requests: ' + failed.join(', '));
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(', '));
    pass('zero failed requests and zero runtime errors across every mode');
    console.log(`\n${n} online checks passed on ${SITE}`);
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await browser.close(); }
})();
