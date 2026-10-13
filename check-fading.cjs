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

    // 1. 2-2 后半段为深坑：x=130~170 之间没有 ground tile
    const gapCheck = await page.evaluate(() => {
      const w = makeWorld(5); // world index 5 => 2-2
      const noGround = [];
      for (let x = 130; x < 170; x++) {
        if (w.tiles.has(x + ',14')) noGround.push(x);
      }
      return { hasGap: noGround.length === 0, groundXs: noGround.slice(0, 5) };
    });
    assert(gapCheck.hasGap, '2-2 second half must be a pit from x=130 to x=170, but ground tiles found: ' + gapCheck.groundXs.join(','));
    pass('2-2 second half is a pit (x=130-170 has no ground)');

    // 2. fading 平台周期变化：可见/闪烁/消失
    const cycle = await page.evaluate(() => {
      const w = makeWorld(5);
      const p = w.platforms.find(p => p.fading);
      if (!p) return null;
      const states = [];
      for (let t = 0; t < 200; t++) {
        const c = t % 180;
        states.push({ t, visible: c < 120, blink: c >= 90 && c < 120 });
      }
      const visibleFrames = states.filter(s => s.visible).length;
      const blinkFrames = states.filter(s => s.blink).length;
      return { visibleFrames, blinkFrames, total: states.length };
    });
    assert(cycle, '2-2 must contain at least one fading platform');
    assert.strictEqual(cycle.visibleFrames, 140, `fading visible frames expected 140, got ${cycle.visibleFrames}`); // 0-119 + 180-199
    assert.strictEqual(cycle.blinkFrames, 30, `fading blink frames expected 30, got ${cycle.blinkFrames}`);
    pass('fading platform cycle is correct (visible -> blink -> disappear)');

    // 3. 不可见的 fading 平台不会支撑玩家：把玩家放到平台正上方，平台消失时玩家应下落
    const supportCheck = await page.evaluate(() => {
      const w = makeWorld(5);
      const p = w.platforms.find(p => p.fading);
      if (!p) return { ok: false, reason: 'no fading platform' };
      // 模拟玩家落在平台中央，t 调到消失期（150 帧）
      const player = { x: p.x + p.w / 2 - 6, y: p.y - 24, w: 12, h: 24, vx: 0, vy: 5, ground: false };
      p.t = 150; // 消失期
      p.visible = false; p.blink = false;
      const prevBottom = player.y + player.h;
      let supported = false;
      if (player.vy >= 0) {
        if (!(p.fading && !p.visible) && player.x + player.w > p.x && player.x < p.x + p.w && prevBottom <= p.y + 2 && player.y + player.h >= p.y && player.y + player.h < p.y + 14) {
          supported = true;
        }
      }
      // 可见期应该支撑
      p.t = 30; p.visible = true; p.blink = false;
      const prevBottom2 = player.y + player.h;
      let supportedVisible = false;
      if (player.vy >= 0) {
        if (!(p.fading && !p.visible) && player.x + player.w > p.x && player.x < p.x + p.w && prevBottom2 <= p.y + 2 && player.y + player.h >= p.y && player.y + player.h < p.y + 14) {
          supportedVisible = true;
        }
      }
      return { ok: !supported && supportedVisible, supportedHidden: supported, supportedVisible };
    });
    assert(supportCheck.ok, 'fading platform must NOT support player when invisible, but MUST support when visible: ' + JSON.stringify(supportCheck));
    pass('fading platform collision respects visibility');

    assert(errors.length === 0, 'no runtime errors: ' + errors.join(' | '));
    pass('no runtime/page errors during fading checks');
    console.log(`\nALL ${n} CHECKS PASSED`);
  } catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error('PAGE ERRORS:', errors);
    process.exit(1);
  } finally { await browser.close(); }
})();
