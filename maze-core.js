/* Maze Chase — core engine (pure, no DOM). Part of 小霸王游戏合集.
   Original 28x31 grid maze. Reuses no other mode's code. */
(function () {
  'use strict';
  const W = 28, H = 31, T = 20;
  const WALL = 0, DOT = 1, POWER = 2, EMPTY = 3, DOOR = 4;
  const UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 }, LEFT = { x: -1, y: 0 }, RIGHT = { x: 1, y: 0 };
  const DIRS = [UP, DOWN, LEFT, RIGHT];
  const TUNNEL_ROWS = new Set([15]);
  const PLAYER_START = { x: 13, y: 23 };
  const HOUSE = { x0: 11, x1: 16, y0: 12, y1: 14 };
  const HOUSE_CENTER = { x: 13, y: 13 };
  const GHOST_SPAWNS = [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 13, y: 14 }, { x: 14, y: 14 }];
  const RELEASE = [0, 1.5, 3, 4.5];
  const POWERS = [[1, 1], [26, 1], [1, 29], [26, 29]];
  const CORNERS = [{ x: 1, y: 1 }, { x: 26, y: 1 }, { x: 26, y: 29 }, { x: 1, y: 29 }];
  const DIFF = {
    easy: { gf: 0.62, power: 8, smart: false, ambush: 2 },
    normal: { gf: 0.9, power: 7, smart: true, ambush: 4 },
    hard: { gf: 1.02, power: 6, smart: true, ambush: 6 }
  };
  const PLAYER_SPEED = 100; // px/s
  const DIRMAP = { up: UP, down: DOWN, left: LEFT, right: RIGHT };
  const REV = d => ({ x: -d.x, y: -d.y });
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function buildStage(n) {
    const g = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        let t;
        if (x === 0 || x === W - 1 || y === 0 || y === H - 1) t = WALL;
        else if (y % 2 === 1) t = DOT;            // odd rows: full horizontal corridors
        else t = (x % 2 === 1) ? DOT : WALL;       // even rows: pillars at even cols
        row.push(t);
      }
      g.push(row);
    }
    // Dead-end stubs: wall a few odd-row cells at even cols. This turns the
    // vertical-corridor cell above/below into a dead end, while odd rows stay
    // connected via odd columns -> maze remains fully traversable.
    const stubs = [[10, 5], [17, 5], [10, 25], [17, 25], [5, 9], [22, 9], [5, 21], [22, 21], [8, 11], [19, 11], [8, 19], [19, 19], [13, 17], [14, 17]];
    for (const [c, r] of stubs) { if (g[r] && g[r][c] === DOT) g[r][c] = WALL; }
    // Central ghost house
    for (let x = HOUSE.x0; x <= HOUSE.x1; x++) {
      g[HOUSE.y0][x] = (x === 13 || x === 14) ? DOOR : WALL; // top wall + door
    }
    g[HOUSE.y0 + 1][HOUSE.x0] = WALL; g[HOUSE.y0 + 1][HOUSE.x1] = WALL;
    g[HOUSE.y0 + 2][HOUSE.x0] = WALL; g[HOUSE.y0 + 2][HOUSE.x1] = WALL;
    for (let x = HOUSE.x0 + 1; x < HOUSE.x1; x++) { g[HOUSE.y0 + 1][x] = EMPTY; g[HOUSE.y0 + 2][x] = EMPTY; }
    // Tunnel row (wrap left<->right)
    g[15][0] = EMPTY; g[15][W - 1] = EMPTY;
    // Power pellets
    let dots = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === DOT) dots++;
    for (const [x, y] of POWERS) { g[y][x] = POWER; dots--; }
    return { grid: g, dots };
  }

  function tileAhead(tile, dir) { return { x: tile.x + dir.x, y: tile.y + dir.y }; }
  function normTile(t) {
    let { x, y } = t;
    if (TUNNEL_ROWS.has(y)) { if (x < 0) x = W - 1; else if (x >= W) x = 0; }
    return { x, y };
  }
  function canEnter(grid, tile, isPlayer) {
    let { x, y } = tile;
    if (y < 0 || y >= H) return false;
    if (TUNNEL_ROWS.has(y)) { if (x < 0) x = W - 1; else if (x >= W) x = 0; }
    else if (x < 0 || x >= W) return false;
    const t = grid[y][x];
    if (t === WALL) return false;
    if (t === DOOR && isPlayer) return false;
    return true;
  }
  function px(e) { return e.tile.x * T + T / 2 + e.ox; }
  function py(e) { return e.tile.y * T + T / 2 + e.oy; }
  function atCenter(e) { return e.ox === 0 && e.oy === 0; }
  function openDirs(grid, tile, dir, isPlayer) {
    const opts = DIRS.filter(d => canEnter(grid, tileAhead(tile, d), isPlayer));
    const r = dir.x || dir.y ? REV(dir) : null;
    const nonRev = r ? opts.filter(d => !(d.x === r.x && d.y === r.y)) : opts;
    return nonRev.length ? nonRev : opts;
  }
  function pickDir(grid, tile, dir, target, minimize, isPlayer) {
    const opts = openDirs(grid, tile, dir, isPlayer);
    let best = opts[0], bestScore = minimize ? Infinity : -Infinity;
    for (const d of opts) {
      const nt = tileAhead(tile, d);
      const score = Math.hypot(nt.x - target.x, nt.y - target.y);
      if (minimize ? score < bestScore : score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }
  function stepEntity(grid, e, dt, chooseWant, isPlayer) {
    if (dt > 0.05) dt = 0.05;
    let dist = e.speed * dt;
    while (dist > 1e-6) {
      if (atCenter(e)) {
        const w = chooseWant(e);
        if (w && (w.x || w.y)) {
          if (canEnter(grid, tileAhead(e.tile, w), isPlayer)) { e.dir = { x: w.x, y: w.y }; }
          else if (!canEnter(grid, tileAhead(e.tile, e.dir), isPlayer)) { e.dir = { x: 0, y: 0 }; return; }
        } else if (!canEnter(grid, tileAhead(e.tile, e.dir), isPlayer)) { e.dir = { x: 0, y: 0 }; return; }
      }
      if (e.dir.x === 0 && e.dir.y === 0) return;
      const nt = tileAhead(e.tile, e.dir);
      if (!canEnter(grid, nt, isPlayer)) { e.ox = 0; e.oy = 0; return; }
      const rem = e.dir.x !== 0 ? (T / 2 - Math.abs(e.ox)) : (T / 2 - Math.abs(e.oy));
      const st = Math.min(dist, rem);
      e.ox += e.dir.x * st; e.oy += e.dir.y * st; dist -= st;
      if ((e.dir.x !== 0 && Math.abs(e.ox) >= T / 2 - 1e-6) || (e.dir.y !== 0 && Math.abs(e.oy) >= T / 2 - 1e-6)) {
        e.tile = normTile(nt); e.ox = 0; e.oy = 0;
      }
    }
  }

  const GHOST_DEFS = [
    { kind: 'chase', color: '#ff5b5b', name: '红' },
    { kind: 'patrol', color: '#5b8bff', name: '蓝' },
    { kind: 'ambush', color: '#ffd23f', name: '黄' },
    { kind: 'random', color: '#b96bff', name: '紫' }
  ];

  class MazeGame {
    constructor(diff, character) {
      this.diff = DIFF[diff] ? diff : 'normal';
      this.d = DIFF[this.diff];
      this.character = character || 'explorer';
      this.stage = 1;
      this.score = 0;
      this.lives = 3;
      this.state = 'ready'; // ready | playing | clear | gameover
      this.inputDir = { x: 0, y: 0 };
      this.load();
    }
    load() {
      const s = buildStage(this.stage);
      this.grid = s.grid;
      this.totalDots = s.dots;
      this.dotsRemaining = s.dots;
      this.dotsCollected = 0;
      this.enemiesDefeated = 0;
      this.powerTimer = 0;
      this.invuln = 0;
      this.chain = 0;
      this.time = 0;
      this.player = { tile: { ...PLAYER_START }, ox: 0, oy: 0, dir: { x: 0, y: 0 }, speed: PLAYER_SPEED, isPlayer: true };
      this.ghosts = GHOST_DEFS.map((def, i) => ({
        ...def, tile: { ...GHOST_SPAWNS[i] }, ox: 0, oy: 0, dir: { x: 0, y: 0 },
        speed: PLAYER_SPEED * this.d.gf, isPlayer: false,
        state: 'house', release: RELEASE[i], pi: i % 4
      }));
      this.state = 'ready';
    }
    begin() { if (this.state === 'ready' || this.state === 'clear') this.state = 'playing'; }
    setDir(name) { this.inputDir = DIRMAP[name] || { x: 0, y: 0 }; }
    nextStage() {
      if (this.stage < 5) this.stage++;
      this.load();
      this.state = 'playing';
    }
    ghostWant(g) {
      if (g.state === 'eaten') return pickDir(this.grid, g.tile, g.dir, HOUSE_CENTER, true, false);
      if (g.state === 'house') return UP;
      if (g.state === 'frightened') return pickDir(this.grid, g.tile, g.dir, this.player.tile, false, false);
      if (g.kind === 'random') { const o = openDirs(this.grid, g.tile, g.dir, false); return o[Math.floor(Math.random() * o.length)]; }
      if (!this.d.smart && Math.random() < 0.3) { const o = openDirs(this.grid, g.tile, g.dir, false); return o[Math.floor(Math.random() * o.length)]; }
      let target;
      if (g.kind === 'chase') target = this.player.tile;
      else if (g.kind === 'ambush') {
        const p = this.player; const a = this.d.ambush;
        target = { x: clamp(p.tile.x + p.dir.x * a, 1, W - 2), y: clamp(p.tile.y + p.dir.y * a, 1, H - 2) };
      } else { // patrol
        const pd = Math.hypot(g.tile.x - this.player.tile.x, g.tile.y - this.player.tile.y);
        if (pd < 6) target = this.player.tile;
        else { target = CORNERS[g.pi]; if (Math.hypot(g.tile.x - target.x, g.tile.y - target.y) < 1.5) g.pi = (g.pi + 1) % 4; }
      }
      return pickDir(this.grid, g.tile, g.dir, target, true, false);
    }
    die() {
      this.lives--;
      this.powerTimer = 0; this.chain = 0;
      if (this.lives <= 0) { this.state = 'gameover'; return; }
      this.player.tile = { ...PLAYER_START }; this.player.ox = 0; this.player.oy = 0; this.player.dir = { x: 0, y: 0 };
      this.inputDir = { x: 0, y: 0 };
      this.ghosts.forEach((g, i) => { g.tile = { ...GHOST_SPAWNS[i] }; g.ox = 0; g.oy = 0; g.dir = { x: 0, y: 0 }; g.state = 'house'; g.release = RELEASE[i] * 0.4; });
      this.invuln = 2;
    }
    update(dt) {
      if (this.state !== 'playing') return;
      this.time += dt;
      if (this.powerTimer > 0) {
        this.powerTimer -= dt;
        if (this.powerTimer <= 0) { this.powerTimer = 0; this.chain = 0; this.ghosts.forEach(g => { if (g.state === 'frightened') g.state = 'normal'; }); }
      }
      if (this.invuln > 0) this.invuln -= dt;
      stepEntity(this.grid, this.player, dt, () => this.inputDir, true);
      if (atCenter(this.player)) {
        const t = this.grid[this.player.tile.y][this.player.tile.x];
        if (t === DOT) { this.grid[this.player.tile.y][this.player.tile.x] = EMPTY; this.dotsRemaining--; this.dotsCollected++; this.score += 10; if (this.onEat) this.onEat(); }
        else if (t === POWER) { this.grid[this.player.tile.y][this.player.tile.x] = EMPTY; this.dotsRemaining--; this.dotsCollected++; this.score += 50; this.powerTimer = this.d.power; this.chain = 0; this.ghosts.forEach(g => { if (g.state === 'normal' || g.state === 'house') g.state = 'frightened'; }); if (this.onPower) this.onPower(); }
      }
      for (const g of this.ghosts) {
        if (g.state === 'house') {
          if (g.release > 0) { g.release -= dt; g.dir = { x: 0, y: 0 }; }
          else { stepEntity(this.grid, g, dt, () => UP, false); if (g.tile.y <= HOUSE.y0 - 1) g.state = this.powerTimer > 0 ? 'frightened' : 'normal'; }
          continue;
        }
        if (g.state === 'eaten') {
          stepEntity(this.grid, g, dt, () => pickDir(this.grid, g.tile, g.dir, HOUSE_CENTER, true, false), false);
          if (g.tile.y >= HOUSE.y0 && g.tile.y <= HOUSE.y1 && g.tile.x >= HOUSE.x0 + 1 && g.tile.x <= HOUSE.x1 - 1) { g.state = 'house'; g.release = 2; }
          continue;
        }
        stepEntity(this.grid, g, dt, (e) => this.ghostWant(e), false);
      }
      // collisions
      for (const g of this.ghosts) {
        if (g.state === 'eaten' || g.state === 'house') continue;
        if (Math.abs(px(this.player) - px(g)) < T * 0.6 && Math.abs(py(this.player) - py(g)) < T * 0.6) {
          if (g.state === 'frightened') {
            this.chain++; this.enemiesDefeated++;
            const pts = [200, 400, 800, 1600][Math.min(this.chain - 1, 3)];
            this.score += pts; g.state = 'eaten';
            if (this.onEatGhost) this.onEatGhost(pts);
          } else if (this.invuln <= 0) { this.die(); break; }
        }
      }
      if (this.dotsRemaining <= 0) { this.state = 'clear'; if (this.onClear) this.onClear(); }
    }
    snapshot() {
      return {
        state: this.state, score: this.score, lives: this.lives,
        dotsRemaining: this.dotsRemaining, totalDots: this.totalDots,
        powerTimer: this.powerTimer, invuln: this.invuln, stage: this.stage,
        player: { x: this.player.tile.x, y: this.player.tile.y },
        ghosts: this.ghosts.map(g => ({ x: g.tile.x, y: g.tile.y, state: g.state, kind: g.kind }))
      };
    }
  }

  function validate(stage) {
    const s = buildStage(stage);
    const grid = s.grid;
    const seen = Array.from({ length: H }, () => new Array(W).fill(false));
    const q = [PLAYER_START]; seen[PLAYER_START.y][PLAYER_START.x] = true;
    let reach = 0; const unreachable = [];
    while (q.length) {
      const t = q.shift();
      if (grid[t.y][t.x] === DOT) reach++;
      for (const d of DIRS) {
        const nt = tileAhead(t, d);
        if (!canEnter(grid, nt, true)) continue;
        const n = normTile(nt);
        if (!seen[n.y][n.x]) { seen[n.y][n.x] = true; q.push(n); }
      }
    }
    let total = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === DOT) total++;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === DOT && !seen[y][x]) unreachable.push([x, y]);
    return { ok: reach === total && unreachable.length === 0, reach, total, unreachable };
  }

  const API = { W, H, T, WALL, DOT, POWER, EMPTY, DOOR, MazeGame, buildStage, validate, canEnter, DIFF, PLAYER_START, TUNNEL_ROWS, px, py };
  if (typeof window !== 'undefined') window.MazeCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
