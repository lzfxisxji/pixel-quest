/* Maze Chase — page glue, rendering, input, loop. Part of 小霸王游戏合集. */
(function () {
  'use strict';
  const T = window.MazeCore.T;
  const { W, H } = window.MazeCore;
  const assets = window.PixelModeCharacters;

  // ---- audio (self-contained, mirrors the collection's retro blips) ----
  let muted = false;
  class AudioEngine {
    constructor() { this.context = null; this.next = 0; }
    init() { if (!this.context) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.context = new AC(); this.bus = this.context.createGain(); this.bus.gain.value = .16; this.bus.connect(this.context.destination); } this.context.resume().catch(() => {}); }
    tone(freq, duration = .12, type = 'square', volume = .25, delay = 0, slide = 0) {
      if (!this.context || muted) return; const c = this.context, o = c.createOscillator(), g = c.createGain(), now = c.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(freq, now); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), now + duration);
      g.gain.setValueAtTime(volume, now); g.gain.exponentialRampToValueAtTime(.001, now + duration);
      o.connect(g); g.connect(this.bus); o.start(now); o.stop(now + duration);
    }
    sfx(name) {
      const lists = {
        eat: [[1318, .05]], power: [[392, .1], [494, .1], [587, .1], [784, .22]],
        ghost: [[200, .1, 'square', .3, 0, 80]], death: [[494, .15], [392, .15], [330, .2], [262, .4]],
        clear: [[523, .15], [659, .15], [784, .15], [1046, .4]], step: [[660, .03]]
      };
      let d = 0; for (const n of lists[name] || []) { this.tone(n[0], n[1], n[2] || 'square', n[3] || .3, d + (n[4] || 0), n[5] || 0); d += n[1] * .8; }
    }
  }
  const audio = new AudioEngine();

  // ---- sprite helper (reuse existing character art) ----
  function drawSprite(ctx, id, scale) {
    const pose = id === 'explorer' ? 'hero' : id;
    const rows = assets.art[pose]; if (!rows) return;
    const pal = Object.assign({}, assets.palette, assets.colors[id] || {});
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const s = Math.min(1, (T - 2) / Math.max(w, h));
    const ox = Math.round((T - w * s) / 2), oy = Math.round((T - h * s) / 2);
    ctx.save(); ctx.translate(ox, oy);
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch !== '.') { ctx.fillStyle = pal[ch] || '#fff'; ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.ceil(s), Math.ceil(s)); } }
    ctx.restore();
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let game = new window.MazeCore.MazeGame('normal', currentHero());
  let paused = false, testMode = false, prevState = 'ready';
  let held = [];

  function currentHero() { try { const h = localStorage.getItem('pq-hero'); return assets.ids.includes(h) ? h : 'explorer'; } catch (e) { return 'explorer'; } }

  // ---- DOM ----
  const $ = s => document.querySelector(s);
  const setup = $('#setup'), modal = $('#modal'), top = $('.top'), hudScore = $('#score'), hudLives = $('#lives'), hudStage = $('#stage'), hudPower = $('#power');

  // character roster
  const roster = $('#roster');
  let selected = currentHero();
  function buildRoster() {
    roster.innerHTML = '';
    for (const id of assets.ids) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'portrait' + (id === selected ? ' sel' : '');
      b.dataset.id = id;
      const c = document.createElement('canvas'); c.width = 40; c.height = 40;
      const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
      const pose = id === 'explorer' ? 'hero' : id; const rows = assets.art[pose];
      const w = Math.max(...rows.map(r => r.length)), h = rows.length;
      const s = Math.min(2, 36 / Math.max(w, h));
      const pal = Object.assign({}, assets.palette, assets.colors[id] || {});
      cc.save(); cc.translate(Math.round((40 - w * s) / 2), Math.round((40 - h * s) / 2));
      for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch !== '.') { cc.fillStyle = pal[ch] || '#fff'; cc.fillRect(Math.round(x * s), Math.round(y * s), Math.ceil(s), Math.ceil(s)); } }
      cc.restore();
      b.appendChild(c);
      const lbl = document.createElement('span'); lbl.textContent = assets.names[id] || id; b.appendChild(lbl);
      b.onclick = () => { selected = id; [...roster.children].forEach(n => n.classList.toggle('sel', n.dataset.id === id)); audio.init(); };
      roster.appendChild(b);
    }
  }
  buildRoster();

  function startGame() {
    const diff = $('#difficulty').value;
    try { localStorage.setItem('pq-hero', selected); } catch {}
    game = new window.MazeCore.MazeGame(diff, selected);
    game.onEat = () => audio.sfx('eat');
    game.onPower = () => audio.sfx('power');
    game.onEatGhost = () => audio.sfx('ghost');
    game.onClear = () => onEnd('clear');
    game.begin();
    setup.hidden = true; modal.hidden = true; paused = false; prevState = 'playing';
    held = []; $('#retry').hidden = false; $('#next').hidden = true; $('#resume').hidden = true;
    audio.init();
  }

  function onEnd(kind) {
    try { const best = Number(localStorage.getItem('pq-maze-best') || 0);
      if (game.score > best) localStorage.setItem('pq-maze-best', String(game.score)); } catch {}
    setup.hidden = true; paused = false; held = []; game.setDir(null);
    $('#modal-tag').textContent = kind === 'clear' ? 'STAGE CLEAR' : 'GAME OVER';
    $('#modal-title').textContent = kind === 'clear' ? '过关！' : '游戏结束';
    $('#modal-copy').innerHTML = `得分 <b>${game.score}</b> · 用时 ${game.time.toFixed(0)}s · 能量点 ${game.dotsCollected} · 击败 ${game.enemiesDefeated}`;
    $('#retry').textContent = '再来一局 ↻';
    $('#retry').hidden = kind === 'clear';
    $('#next').hidden = kind !== 'clear';
    $('#resume').hidden = true;
    $('#menu').hidden = false;
    modal.hidden = false;
    if (kind === 'clear') audio.sfx('clear'); else audio.sfx('death');
  }

  $('#start').onclick = startGame;
  $('#retry').onclick = startGame;
  $('#next').onclick = () => { if (game.state !== 'clear') return; game.nextStage(); held = []; game.setDir(null); modal.hidden = true; paused = false; prevState = 'playing'; };
  $('#menu').onclick = () => location.href = './';
  $('#pause').onclick = togglePause;
  $('#resume').onclick = () => { modal.hidden = true; paused = false; };
  $('#fullscreen').onclick = () => { if (!document.fullscreenElement) document.querySelector('.cabinet').requestFullscreen?.(); else document.exitFullscreen?.(); };
  $('#sound').onclick = () => { muted = !muted; $('#sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON'; };

  function togglePause() { if (game.state !== 'playing') return; paused = !paused; if (paused) { $('#modal-tag').textContent = 'PAUSED'; $('#modal-title').textContent = '已暂停'; $('#modal-copy').textContent = '按 P / Esc 或点击继续'; $('#retry').hidden = true; $('#next').hidden = true; $('#resume').hidden = false; $('#menu').hidden = false; modal.hidden = false; } else modal.hidden = true; }

  // ---- input ----
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  function applyDir() { game.setDir(held.length ? held[held.length - 1] : (game.inputDir.x || game.inputDir.y ? null : null)); if (!held.length) game.setDir(null); }
  function pressDir(name) { if (!held.includes(name)) held.push(name); game.setDir(name); }
  function releaseDir(name) { held = held.filter(d => d !== name); if (held.length) game.setDir(held[held.length - 1]); else game.setDir(null); }
  window.addEventListener('keydown', e => {
    if (['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    const d = KEYMAP[e.code]; if (d && game.state === 'playing' && !paused) { e.preventDefault(); audio.init(); pressDir(d); }
  });
  window.addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) releaseDir(d); });
  window.ArcadeJoystick && window.ArcadeJoystick.bind(
    c => { audio.init(); const d = KEYMAP[c]; if (d) pressDir(d); },
    c => { const d = KEYMAP[c]; if (d) releaseDir(d); }
  );

  // ---- render ----
  function render() {
    ctx.fillStyle = '#0c1622'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const g = game.grid;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = g[y][x]; const px = x * T, py = y * T;
      if (t === window.MazeCore.WALL) {
        ctx.fillStyle = '#1d2c63'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#2c43a0'; ctx.fillRect(px + 1, py + 1, T - 2, 2);
        ctx.fillStyle = '#16224f'; ctx.fillRect(px + 1, py + T - 3, T - 2, 2);
      } else if (t === window.MazeCore.DOT) {
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(px + T / 2 - 1.5, py + T / 2 - 1.5, 3, 3);
      } else if (t === window.MazeCore.POWER) {
        const pulse = 3 + Math.sin(performance.now() / 150) * 1.5;
        ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, pulse, 0, 7); ctx.fill();
      } else if (t === window.MazeCore.DOOR) {
        ctx.fillStyle = '#ffb0d0'; ctx.fillRect(px, py + 2, T, T - 4);
      }
    }
    // ghosts
    for (const gh of game.ghosts) {
      const cx = gh.tile.x * T + T / 2 + gh.ox, cy = gh.tile.y * T + T / 2 + gh.oy;
      let body = gh.color;
      if (gh.state === 'frightened') body = (Math.floor(performance.now() / 200) % 2 && game.powerTimer > 2) ? '#ffffff' : '#2b4cff';
      else if (gh.state === 'eaten') body = '#5a6b8c';
      ctx.fillStyle = body; ctx.fillRect(cx - 8, cy - 8, 16, 14);
      ctx.fillRect(cx - 8, cy - 10, 16, 3);
      // wavy bottom
      ctx.fillRect(cx - 8, cy + 5, 4, 3); ctx.fillRect(cx - 1, cy + 5, 4, 3); ctx.fillRect(cx + 6, cy + 5, 4, 3);
      // eyes
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 5, cy - 5, 4, 4); ctx.fillRect(cx + 2, cy - 5, 4, 4);
      ctx.fillStyle = '#16224f'; const ex = gh.dir.x < 0 ? -1 : gh.dir.x > 0 ? 1 : 0, ey = gh.dir.y < 0 ? -1 : gh.dir.y > 0 ? 1 : 0;
      ctx.fillRect(cx - 5 + ex, cy - 5 + ey, 2, 2); ctx.fillRect(cx + 2 + ex, cy - 2 + ey, 2, 2);
    }
    // player
    const p = game.player; const cx = p.tile.x * T + T / 2 + p.ox, cy = p.tile.y * T + T / 2 + p.oy;
    if (game.invuln > 0 && Math.floor(performance.now() / 120) % 2) { /* blink */ }
    else { ctx.save(); ctx.translate(Math.round(cx - T / 2), Math.round(cy - T / 2)); drawSprite(ctx, game.character, 1); ctx.restore(); }
  }
  function updateHud() {
    hudScore.textContent = 'SCORE ' + String(game.score).padStart(6, '0');
    hudLives.textContent = 'LIVES ' + game.lives;
    hudStage.textContent = 'STAGE ' + game.stage;
    if (game.powerTimer > 0) { hudPower.hidden = false; hudPower.textContent = 'POWER ' + game.powerTimer.toFixed(1) + 's'; }
    else hudPower.hidden = true;
  }

  let last = 0;
  function frame(ts) {
    const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0; last = ts;
    if (game.state === 'playing' && !paused && !testMode) game.update(dt);
    if (game.state !== prevState) { prevState = game.state; if (game.state === 'gameover') onEnd('gameover'); }
    render(); updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- test hooks (deterministic, used by check-maze.cjs) ----
  window.PixelMaze = {
    get game() { return game; },
    start(diff, char) { selected = char || 'explorer'; if (diff && $('#difficulty')) $('#difficulty').value = diff; startGame(); },
    setDir(name) { game.setDir(name); },
    tick(ms) { game.update(ms / 1000); },
    snapshot() { return game.snapshot(); },
    setTestMode(v) { testMode = !!v; }
  };
})();
