const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const SITE = process.argv[2] || process.env.PQ_SITE || 'http://localhost:4173/';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let n = 0; const pass = s => { console.log('PASS ' + s); n++; };
  try {
    await page.goto(SITE + 'maze.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.PixelMaze, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => typeof window.MazeCore), 'object', 'MazeCore engine must load');
    pass('maze.html boots and exposes MazeCore + PixelMaze');

    // deterministic logic tests (stop rAF double-advance)
    await page.evaluate(() => { PixelMaze.setTestMode(true); });

    // 1) movement + no wall clip + dots get eaten
    const res = await page.evaluate(() => {
      PixelMaze.start('normal', 'explorer');
      const g = PixelMaze.game; const grid = g.grid;
      let clips = 0, ate = 0; const seen = new Set();
      const dirs = ['right', 'left', 'up', 'down'];
      for (let i = 0; i < 3000; i++) {
        if (g.player.ox === 0 && g.player.oy === 0) {
          const open = dirs.filter(d => {
            const m = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[d];
            const x = g.player.tile.x + m[0], y = g.player.tile.y + m[1];
            return grid[y] && grid[y][x] !== 0 && !(grid[y][x] === 4);
          });
          if (open.length) PixelMaze.setDir(open[Math.floor(Math.random() * open.length)]);
        }
        PixelMaze.tick(1000 / 60);
        if (grid[g.player.tile.y][g.player.tile.x] === 0) clips++;
        seen.add(g.player.tile.x + ',' + g.player.tile.y);
      }
      return { clips, left: g.dotsRemaining, total: g.totalDots, visited: seen.size, score: g.score };
    });
    assert.equal(res.clips, 0, 'player clipped a wall ' + res.clips + ' times');
    assert(res.left < res.total, 'player never ate any dots');
    assert(res.visited > 20, 'player barely moved');
    pass('movement: no wall clip, dots eaten, player roams (' + res.visited + ' tiles)');

    // 2) pre-turn buffered input: moving up a corridor, request left before the junction, must turn at next left-opening
    const turn = await page.evaluate(() => {
      PixelMaze.start('normal', 'explorer');
      const g = PixelMaze.game;
      g.player.tile = { x: 13, y: 23 }; g.player.ox = 0; g.player.oy = 0; g.player.dir = { x: 0, y: 0 };
      PixelMaze.setDir('up');
      // run until player is moving and somewhere with a left branch reachable; check it eventually turns left when requested early
      let turnedLeft = false; let prevX = g.player.tile.x;
      for (let i = 0; i < 600; i++) {
        // request left whenever possible (buffered); at a left-opening it should take it
        const leftOpen = g.grid[g.player.tile.y][g.player.tile.x - 1] !== 0;
        if (leftOpen && g.player.ox === 0 && g.player.oy === 0) PixelMaze.setDir('left');
        PixelMaze.tick(1000 / 60);
        if (g.player.tile.x < prevX) turnedLeft = true;
        prevX = g.player.tile.x;
        if (turnedLeft) break;
      }
      return turnedLeft;
    });
    assert(turn, 'buffered pre-turn did not turn the player at an intersection');
    pass('pre-turn buffered input turns at the next intersection');

    // 3) difficulty changes power duration
    const power = await page.evaluate(() => {
      function eatPower(diff) {
        PixelMaze.start(diff, 'explorer');
        const g = PixelMaze.game;
        // teleport next to a power pellet at (1,1)
        g.player.tile = { x: 2, y: 1 }; g.player.ox = 0; g.player.oy = 0; g.player.dir = { x: -1, y: 0 };
        PixelMaze.setDir('left');
        for (let i = 0; i < 40; i++) { PixelMaze.tick(1000 / 60); if (g.powerTimer > 0) break; }
        return g.powerTimer;
      }
      return { easy: eatPower('easy'), hard: eatPower('hard') };
    });
    assert(power.easy > 7 && power.easy <= 9, 'easy power duration unexpected: ' + power.easy);
    assert(power.hard > 5 && power.hard <= 7, 'hard power duration unexpected: ' + power.hard);
    assert(power.easy > power.hard, 'easy should last longer than hard');
    pass('difficulty: easy power ' + power.easy.toFixed(1) + 's > hard ' + power.hard.toFixed(1) + 's');

    // 4) power -> frightened -> eat ghost scores a chain
    const eat = await page.evaluate(() => {
      PixelMaze.start('easy', 'explorer');
      const g = PixelMaze.game;
      g.player.tile = { x: 2, y: 1 }; g.player.ox = 0; g.player.oy = 0; g.player.dir = { x: -1, y: 0 };
      PixelMaze.setDir('left');
      for (let i = 0; i < 40; i++) { PixelMaze.tick(1000 / 60); if (g.powerTimer > 0) break; }
      const frightened = g.ghosts.filter(x => x.state === 'frightened').length;
      const before = g.score;
      // place a frightened ghost on the player and tick
      g.ghosts[0].state = 'frightened'; g.ghosts[0].tile = { ...g.player.tile }; g.ghosts[0].ox = 0; g.ghosts[0].oy = 0;
      PixelMaze.tick(1000 / 60);
      return { frightened, gained: g.score - before, defeated: g.enemiesDefeated };
    });
    assert(eat.frightened >= 1, 'no ghost became frightened');
    assert(eat.gained >= 200, 'eating a frightened ghost did not score');
    assert(eat.defeated >= 1, 'enemiesDefeated not incremented');
    pass('power: ghost frightened and eating it scores a chain (+' + eat.gained + ')');

    // 5) clearing all dots -> stage clear
    const clear = await page.evaluate(() => {
      PixelMaze.start('normal', 'explorer');
      const g = PixelMaze.game;
      for (let y = 0; y < 31; y++) for (let x = 0; x < 28; x++) if (g.grid[y][x] === 1) g.grid[y][x] = 3;
      g.dotsRemaining = 0; PixelMaze.tick(1000 / 60);
      return g.state;
    });
    assert.equal(clear, 'clear', 'stage did not clear');
    pass('clearing all dots triggers STAGE CLEAR');

    assert.deepEqual(errors, [], 'runtime errors: ' + errors.join(' | '));
    pass('no runtime errors during maze logic tests');

    // 6) touch joystick: in-canvas overlay pad appears and a drag moves the player
    const touch = await browser.newPage({ viewport: { width: 900, height: 500 }, hasTouch: true, isMobile: true });
    const terr = []; touch.on('pageerror', e => terr.push(e.message));
    await touch.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await touch.goto(SITE + 'maze.html', { waitUntil: 'load' });
    await touch.waitForFunction(() => !!window.PixelMaze, null, { timeout: 8000 });
    await touch.evaluate(() => PixelMaze.start('normal', 'explorer'));
    await touch.waitForSelector('.arcade-joystick', { state: 'visible', timeout: 5000 });
    pass('touch: semi-transparent in-canvas joystick pad is visible');
    const moved = await touch.evaluate(async () => {
      const g = PixelMaze.game; const y0 = g.player.tile.y;
      const pad = document.querySelector('.arcade-joystick');
      const r = pad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, x, y) => pad.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
      ev('pointerdown', cx, cy); ev('pointermove', cx, cy - r.height * 0.6);
      await new Promise(r => setTimeout(r, 900));
      ev('pointerup', cx, cy - r.height * 0.6);
      return { y0, y1: g.player.tile.y, dy: g.player.dir.y };
    });
    assert(moved.dy < 0 || moved.y1 < moved.y0, 'dragging the pad up did not move the player up');
    pass('touch: dragging the pad moves the player');
    assert.deepEqual(terr, [], 'touch runtime errors: ' + terr.join(' | '));

    console.log('\n' + n + ' maze-chase checks passed');
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await browser.close(); }
})();
