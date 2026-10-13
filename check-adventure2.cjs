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
    await page.waitForFunction(() => window.PixelQuest && window.makeWorld && window.buildLegacyWorld2, 'adventure globals ready');
    pass('page loads and adventure globals are present (World 1 also boots)');

    const report = await page.evaluate(() => {
      const out = [];
      for (let i = 4; i < 8; i++) {
        const w = makeWorld(i);
        out.push({ i, course: w.course && w.course.id, kind: w.kind, tiles: w.tiles.size, enemies: w.enemies.length, platforms: w.platforms.length, sinking: w.platforms.filter(p => p.sinking).length, flagX: w.flagX, length: w.length, hasFlag: w.hasFlag });
      }
      return out;
    });
    for (const r of report) {
      assert(r.tiles > 50, `stage ${r.i} (${r.course}) must have tiles`);
      assert(r.enemies >= 1, `stage ${r.i} must have enemies`);
      assert(r.flagX > 0 && r.flagX < r.length, `stage ${r.i} flagX valid`);
      console.log(`INFO ${r.course} kind=${r.kind} tiles=${r.tiles} enemies=${r.enemies} platforms=${r.platforms} sinking=${r.sinking}`);
    }
    pass('all four World 2 stages build with tiles/enemies/flag');

    assert(report[1].kind === 'underground', `2-2 must be underground (got ${report[1].kind})`);
    assert(report[2].kind === 'bridge', `2-3 must be bridge (got ${report[2].kind})`);
    assert(report[2].sinking >= 3, `2-3 must have sinking platforms in the second half (got ${report[2].sinking})`);
    assert(report[0].kind === 'surface' && report[3].kind === 'castle', '2-1 surface and 2-4 castle');
    pass('2-2 is underground; 2-3 has sinking platforms; 2-1 surface / 2-4 castle');

    assert(errors.length === 0, 'no runtime errors: ' + errors.join(' | '));
    pass('no runtime/page errors while building World 2');
    console.log(`\nALL ${n} CHECKS PASSED`);
  } catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error('PAGE ERRORS:', errors);
    process.exit(1);
  } finally { await browser.close(); }
})();
