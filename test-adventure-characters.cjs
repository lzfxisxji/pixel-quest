const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const SITE = process.argv[2] || 'http://localhost:4173/';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  let n = 0; const pass = s => { console.log('PASS ' + s); n++; };
  try {
    await p.goto(SITE, { waitUntil: 'load' });
    await p.waitForFunction(() => window.makeWorld && window.selectCharacter && window.start, 'adventure globals ready');
    pass('adventure page loads with character globals');

    const ids = ['explorer', 'astro', 'happy', 'wuwa', 'siwa'];
    for (const id of ids) {
      await p.evaluate(i => { try { selectCharacter(i); } catch (e) { throw new Error('select ' + i + ': ' + e.message); } }, id);
      await p.evaluate(() => { try { start(); } catch (e) { throw new Error('start ' + id + ': ' + e.message); } });
      await p.waitForFunction(() => window.PixelQuest && window.PixelQuest.snapshot && window.PixelQuest.snapshot.state === 'playing', 'entered playing for ' + id).catch(() => {});
      // drive: move + jump + attack a few times
      await p.keyboard.down('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.up('ArrowRight');
      await p.keyboard.press('Space'); await p.waitForTimeout(200);
      await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(300); await p.keyboard.up('ArrowLeft');
      await p.keyboard.press('KeyK'); await p.waitForTimeout(200);
      await p.keyboard.press('KeyJ'); await p.waitForTimeout(800);
      const st = await p.evaluate(() => ({ state: window.PixelQuest.snapshot.state, hero: window.player && window.player.character }));
      assert(['playing', 'gameover', 'stageclear'].includes(st.state), `${id}: bad state ${st.state}`);
      pass(`${id} selectable + playable (state=${st.state})`);
    }
    assert.deepEqual(errors, [], 'no runtime errors across all characters: ' + errors.join(' | '));
    pass('no runtime/page errors while playing every character');
    console.log(`\nALL ${n} CHARACTER CHECKS PASSED`);
  } catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error('PAGE ERRORS:', errors);
    process.exit(1);
  } finally { await browser.close(); }
})();
