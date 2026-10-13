/* 2048 PUZZLE — UI, input, animation, modes, undo, leaderboard, rules.
 * Depends on t2048-core.js (globalThis.T2048Core). Standalone page. */
(function () {
  'use strict';
  const Core = globalThis.T2048Core;
  const $ = id => document.getElementById(id);

  const ANIM = 125;                 // ms per move animation
  const TIME_LIMIT = 180000;       // 3 minutes
  const MOVE_LIMIT = 100;          // 100 steps
  const UNDO_MAX = 3;
  const MILESTONES = [2048, 4096, 8192];
  const GAP = 10;                   // px gap between cells

  // ---- persistent state ----
  let state = null;
  let tileEls = {};                // id -> element
  let bgCells = [];
  let cellSize = 0;
  let tickTimer = null;
  let soundOn = true;
  let audioCtx = null;

  // ---- DOM ----
  const board = $('board');

  // ---- colour palette ----
  function tileStyle(v) {
    if (v <= 4) return { bg: v === 2 ? '#eee4da' : '#ede0c8', fg: '#6b6358' };
    if (v <= 64) return { bg: ['#f2b179', '#f59563', '#f67c5f', '#f65e3b', '#f65e3b'][Math.min(4, Math.log2(v) - 3)], fg: '#f9f6f2' };
    if (v <= 512) return { bg: ['#edcf72', '#edcc61', '#edc850'][Math.log2(v) - 7], fg: '#f9f6f2' };
    if (v === 1024) return { bg: '#edc53f', fg: '#f9f6f2' };
    if (v === 2048) return { bg: '#edc22e', fg: '#f9f6f2' };
    return { bg: '#3c3a32', fg: '#f9f6f2' };
  }

  function translateFor(y, x) {
    return `translate(${GAP + x * (cellSize + GAP)}px, ${GAP + y * (cellSize + GAP)}px)`;
  }

  function fontSizeFor(v) {
    const digits = String(v).length;
    let f = 0.46;
    if (digits === 2) f = 0.40;
    else if (digits === 3) f = 0.32;
    else if (digits >= 4) f = 0.26;
    return Math.floor(cellSize * f) + 'px';
  }

  function createTileEl(id) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.id = id;
    board.appendChild(el);
    return el;
  }

  function setTileValue(el, v) {
    const s = tileStyle(v);
    el.style.background = s.bg;
    el.style.color = s.fg;
    el.style.fontSize = fontSizeFor(v);
    el.textContent = v;
    el.classList.toggle('super', v > 2048);
  }

  // ---- layout ----
  function computeMetrics() {
    const N = state ? state.N : 4;
    const inner = board.clientWidth; // .board has inset box-shadow, not a layout border
    cellSize = (inner - GAP * (N + 1)) / N;
    // background cells
    if (bgCells.length !== N * N) {
      board.querySelectorAll('.cell').forEach(c => c.remove());
      bgCells = [];
      for (let i = 0; i < N * N; i++) {
        const c = document.createElement('div');
        c.className = 'cell';
        board.appendChild(c);
        bgCells.push(c);
      }
    }
    bgCells.forEach((c, i) => {
      const x = i % N, y = (i / N) | 0;
      c.style.width = c.style.height = cellSize + 'px';
      c.style.transform = translateFor(y, x);
    });
    // tiles
    for (const id in tileEls) {
      const el = tileEls[id];
      el.style.width = el.style.height = cellSize + 'px';
    }
    if (state) reconcile();
  }

  // ---- reconcile tiles to authoritative state (safety net + first paint) ----
  function reconcile() {
    if (!state) return;
    const pos = Core.positions(state.cells);
    for (const id in tileEls) {
      if (!pos[id]) { tileEls[id].remove(); delete tileEls[id]; }
    }
    for (const id in pos) {
      let el = tileEls[id];
      if (!el) { el = createTileEl(id); tileEls[id] = el; }
      setTileValue(el, pos[id].value);
      el.style.width = el.style.height = cellSize + 'px';
      el.style.transform = translateFor(pos[id].y, pos[id].x);
    }
  }

  // ---- meters ----
  function fmtTime(ms) {
    ms = Math.max(0, ms);
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function updateMeters() {
    if (!state) return;
    $('m-score').textContent = state.score;
    $('m-best').textContent = getBest(state.N, state.mode);
    $('m-max').textContent = Core.maxTile(state.cells);
    $('m-moves').textContent = state.moves;
    const label = $('m-time-label');
    if (state.mode === 'time') {
      label.textContent = 'REMAINING';
      $('m-time').textContent = fmtTime(TIME_LIMIT - state.durationMs);
    } else if (state.mode === 'move') {
      label.textContent = 'STEPS LEFT';
      $('m-time').textContent = state.steps;
    } else {
      label.textContent = 'TIME';
      $('m-time').textContent = fmtTime(state.durationMs);
    }
    $('undo-left').textContent = state.undosLeft;
    $('undo').disabled = state.undosLeft <= 0 || state.undoStack.length === 0;
  }

  // ---- sound ----
  function beep(freq, dur, type) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = 0.05;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // ---- game lifecycle ----
  function newGame(N, mode, nick) {
    state = {
      N, mode, nick,
      cells: Core.init(N),
      score: 0, moves: 0, steps: MOVE_LIMIT,
      durationMs: 0, lastTick: Date.now(),
      status: 'playing', animating: false,
      undosLeft: UNDO_MAX, undoStack: [],
      celebrated: new Set(), saved: false,
    };
    // clear tiles
    for (const id in tileEls) { tileEls[id].remove(); }
    tileEls = {};
    computeMetrics();
    reconcile();
    hideOverlay();
    updateMeters();
    $('status').textContent = `${N}×${N} · ${modeName(mode)} · ${nick}`;
    startTick();
  }

  function modeName(m) {
    return m === 'classic' ? '经典' : m === 'time' ? '限时' : '步数';
  }

  function startTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (!state || state.status !== 'playing') { state && (state.lastTick = Date.now()); return; }
      const now = Date.now();
      const dt = now - state.lastTick;
      state.lastTick = now;
      state.durationMs += dt;
      if (state.mode === 'time') {
        const rem = TIME_LIMIT - state.durationMs;
        if (rem <= 0) { endGame(); return; }
      }
      updateMeters();
    }, 100);
  }

  // ---- moves ----
  function doMove(dir) {
    if (!state || state.status !== 'playing' || state.animating) return;
    const res = Core.move(state.cells, dir);
    if (!res.moved) return; // invalid: no spawn, no step cost, no score

    // snapshot for undo (before committing)
    state.undoStack.push({
      cells: Core.clone(state.cells),
      score: state.score, moves: state.moves, steps: state.steps,
      maxTile: Core.maxTile(state.cells),
      celebrated: new Set(state.celebrated),
    });
    if (state.undoStack.length > UNDO_MAX) state.undoStack.shift();

    state.animating = true;
    state.score += res.gained;
    state.moves += 1;
    if (state.mode === 'move') state.steps = Math.max(0, state.steps - 1);

    const oldPos = Core.positions(state.cells);
    const newCells = res.cells;
    const newPos = Core.positions(newCells);

    // slide survivors; merge pop; slide consumed into survivor
    const pairTarget = {};
    for (const p of res.pairs) pairTarget[p.consumed] = newPos[p.survivor];

    for (const id in tileEls) {
      const el = tileEls[id];
      const np = newPos[id];
      if (!np) {
        // consumed tile: slide into survivor then remove
        const tgt = pairTarget[id];
        if (tgt) el.style.transform = translateFor(tgt.y, tgt.x);
        el.classList.add('merge');
        setTimeout(() => { if (tileEls[id]) { tileEls[id].remove(); delete tileEls[id]; } }, ANIM);
      } else {
        const op = oldPos[id];
        if (op && (op.y !== np.y || op.x !== np.x)) el.style.transform = translateFor(np.y, np.x);
        if (op && op.value !== np.value) {
          setTimeout(() => {
            if (!tileEls[id]) return;
            setTileValue(tileEls[id], np.value);
            tileEls[id].classList.add('merge');
            setTimeout(() => tileEls[id] && tileEls[id].classList.remove('merge'), ANIM);
          }, ANIM);
        }
      }
    }
    if (res.gained > 0) beep(420, 0.08, 'triangle'); else beep(240, 0.05);

    setTimeout(() => {
      state.cells = newCells;
      const sp = Core.spawn(state.cells, Math.random);
      state.cells = sp.cells;
      if (sp.spawned) {
        const el = createTileEl(sp.spawned.id);
        tileEls[sp.spawned.id] = el;
        setTileValue(el, sp.spawned.value);
        el.style.width = el.style.height = cellSize + 'px';
        el.style.transform = translateFor(sp.spawned.y, sp.spawned.x);
        el.classList.add('appear');
        setTimeout(() => el.classList.remove('appear'), 160);
      }
      reconcile();
      state.animating = false;
      updateMeters();
      afterMove();
    }, ANIM);
  }

  function afterMove() {
    // win milestones first
    const mx = Core.maxTile(state.cells);
    for (const m of MILESTONES) {
      if (mx >= m && !state.celebrated.has(m)) {
        state.celebrated.add(m);
        showWin(m);
        return;
      }
    }
    // lose only if no moves available
    if (!Core.canMove(state.cells)) { endGame(); return; }
    if (state.mode === 'move' && state.steps <= 0) { endGame(); return; }
  }

  // ---- overlays ----
  function showOverlay(title, copy, actions) {
    $('bo-title').textContent = title;
    $('bo-copy').textContent = copy;
    const box = $('bo-actions');
    box.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.primary) b.className = 'primary';
      b.addEventListener('click', a.onClick);
      box.appendChild(b);
    }
    $('board-overlay').hidden = false;
  }
  function hideOverlay() { $('board-overlay').hidden = true; }

  function showWin(m) {
    state.status = 'won';
    updateMeters();
    board.classList.add('win');
    setTimeout(() => board.classList.remove('win'), 1000);
    beep(660, 0.12, 'square'); setTimeout(() => beep(880, 0.16, 'square'), 130);
    showOverlay(`达成 ${m}！`, `继续挑战更大的数字，或结束本局结算成绩。`,
      [
        { label: '继续挑战 CONTINUE', primary: true, onClick: () => { hideOverlay(); state.status = 'playing'; state.lastTick = Date.now(); } },
        { label: '结束本局 END', onClick: () => { hideOverlay(); endGame(); } },
      ]);
  }

  function endGame() {
    if (!state || state.status === 'over') return;
    state.status = 'over';
    updateMeters();
    const record = buildRecord();
    const canSave = !state.saved && record.score > 0;
    let savedMsg = state.saved ? '本局成绩已保存。' : '本局成绩将计入本地排行榜。';
    showOverlay('游戏结束', `得分 ${record.score} · 最大 ${record.maxTile} · 步数 ${record.moves}`,
      [
        { label: '保存成绩 SAVE', primary: true, onClick: () => { if (saveRecord(record)) { state.saved = true; savedMsg = '已保存到本地排行榜！'; $('bo-copy').textContent = savedMsg; $('best-note').textContent = `本机最佳（${state.N}×${state.N} · ${modeName(state.mode)}）：${getBest(state.N, state.mode)}`; updateMeters(); } else { $('bo-copy').textContent = '成绩已存在或无法保存。'; } } },
        { label: '再来一局 NEW', onClick: () => { openSetup(); } },
        { label: '排行榜 RANK', onClick: () => { renderLeaderboard(); $('leader').showModal(); } },
      ]);
    // auto-save once
    if (canSave) { saveRecord(record); state.saved = true; }
    $('best-note').textContent = `本机最佳（${state.N}×${state.N} · ${modeName(state.mode)}）：${getBest(state.N, state.mode)}`;
  }

  function buildRecord() {
    return {
      nickname: state.nick, score: state.score, maxTile: Core.maxTile(state.cells),
      moves: state.moves, durationMs: Math.round(state.durationMs),
      date: new Date().toISOString().slice(0, 10), id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    };
  }

  // ---- undo ----
  function doUndo() {
    if (!state || state.status !== 'playing' || state.animating) return;
    if (state.undosLeft <= 0 || state.undoStack.length === 0) return;
    const snap = state.undoStack.pop();
    state.cells = snap.cells;
    state.score = snap.score;
    state.moves = snap.moves;
    state.steps = snap.steps;
    state.celebrated = snap.celebrated;
    state.undosLeft -= 1;
    reconcile();
    updateMeters();
    beep(300, 0.06);
  }

  // ---- pause ----
  function togglePause() {
    if (!state) return;
    if (state.status === 'playing') {
      state.status = 'paused'; state.lastTick = Date.now();
      showOverlay('已暂停 PAUSED', '游戏已暂停。', [
        { label: '继续 RESUME', primary: true, onClick: () => { hideOverlay(); state.status = 'playing'; state.lastTick = Date.now(); } },
        { label: '重开 RESTART', onClick: () => { openSetup(); } },
      ]);
    } else if (state.status === 'paused') {
      hideOverlay(); state.status = 'playing'; state.lastTick = Date.now();
    }
  }

  // ---- leaderboard ----
  function lbKey(N, mode) { return `t2048-lb-${N}-${mode}`; }
  function loadLB(N, mode) {
    try { return JSON.parse(localStorage.getItem(lbKey(N, mode)) || '[]'); } catch { return []; }
  }
  function sortLB(rows, mode) {
    return rows.sort((a, b) =>
      b.score - a.score ||
      (mode === 'classic' ? (b.maxTile - a.maxTile || a.moves - b.moves) : 0) ||
      0);
  }
  function saveRecord(rec) {
    const rows = loadLB(state.N, state.mode);
    if (rows.some(r => r.id === rec.id && r.score === rec.score)) return false;
    rows.push(rec);
    const sorted = sortLB(rows, state.mode).slice(0, 20);
    localStorage.setItem(lbKey(state.N, state.mode), JSON.stringify(sorted));
    // overall best for lobby "我的战绩"
    const prev = Number(localStorage.getItem('pq-2048-best') || 0);
    if (rec.score > prev) localStorage.setItem('pq-2048-best', String(rec.score));
    return true;
  }
  function getBest(N, mode) {
    const rows = loadLB(N, mode);
    return rows.length ? Math.max(...rows.map(r => r.score)) : 0;
  }
  function renderLeaderboard() {
    const N = state ? state.N : 4, mode = state ? state.mode : 'classic';
    const tabs = $('leader-tabs');
    tabs.innerHTML = '';
    const combos = [[4, 'classic'], [4, 'time'], [4, 'move'], [5, 'classic'], [5, 'time'], [5, 'move']];
    combos.forEach(([n, m], i) => {
      const b = document.createElement('button');
      b.textContent = `${n}×${n} ${modeName(m)}`;
      if (state && n === N && m === mode) b.className = 'selected';
      b.addEventListener('click', () => { renderLeaderboardTable(n, m); });
      tabs.appendChild(b);
    });
    renderLeaderboardTable(N, mode);
  }
  function renderLeaderboardTable(N, mode) {
    const rows = sortLB(loadLB(N, mode), mode);
    const body = $('leader-body');
    body.innerHTML = '';
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" style="color:#9ab4c0;text-align:center">暂无记录，快来挑战！</td></tr>';
      return;
    }
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (state && r.nickname === state.nick && r.score === state.score) tr.className = 'current';
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(r.nickname)}</td><td>${r.score}</td><td>${r.maxTile}</td><td>${r.moves}</td><td>${fmtTime(r.durationMs)}</td><td>${r.date}</td>`;
      body.appendChild(tr);
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---- setup ----
  function openSetup() {
    if (state && state.status === 'playing') { state.status = 'paused'; }
    const last = localStorage.getItem('t2048-nick') || '';
    $('nick').value = last;
    $('setup').showModal();
  }
  $('form').addEventListener('submit', e => {
    e.preventDefault();
    const N = parseInt($('size').value, 10);
    const mode = $('mode').value;
    const nick = $('nick').value.trim();
    if (nick.length < 2 || nick.length > 12) { $('form-error').textContent = '昵称需 2～12 个字符。'; return; }
    $('form-error').textContent = '';
    localStorage.setItem('t2048-nick', nick);
    $('setup').close();
    newGame(N, mode, nick);
  });
  // prevent dismissing setup without starting
  $('setup').addEventListener('cancel', e => {
    if (!state || state.status !== 'playing') { e.preventDefault(); }
  });

  // ---- buttons / dialogs ----
  $('new-game').addEventListener('click', openSetup);
  $('undo').addEventListener('click', doUndo);
  $('pause').addEventListener('click', togglePause);
  $('sound-toggle').addEventListener('click', () => {
    soundOn = !soundOn;
    $('sound-toggle').textContent = '声音 SOUND ' + (soundOn ? 'ON' : 'OFF');
    $('sound').textContent = 'SOUND ' + (soundOn ? 'ON' : 'OFF');
    if (soundOn) beep(520, 0.06);
  });
  $('rules-open').addEventListener('click', () => $('rules').showModal());
  $('rules-close').addEventListener('click', () => $('rules').close());
  $('leader-open').addEventListener('click', () => { renderLeaderboard(); $('leader').showModal(); });
  $('leader-close').addEventListener('click', () => $('leader').close());

  // ---- keyboard ----
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  };
  window.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') { if (state) openSetup(); return; }
    if (e.key === 'p' || e.key === 'P') { if (state) togglePause(); return; }
    if (e.key === 'Escape') return;
    const dir = KEYMAP[e.key];
    if (dir) { e.preventDefault(); doMove(dir); }
  });

  // ---- touch / pointer swipe (no scroll, no zoom) ----
  let sx = 0, sy = 0, swiping = false;
  function onStart(x, y) { sx = x; sy = y; swiping = true; }
  function onEnd(x, y) {
    if (!swiping) return; swiping = false;
    const dx = x - sx, dy = y - sy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return;
    if (ax > ay) doMove(dx > 0 ? 'right' : 'left');
    else doMove(dy > 0 ? 'down' : 'up');
  }
  board.addEventListener('touchstart', e => { const t = e.touches[0]; onStart(t.clientX, t.clientY); }, { passive: true });
  board.addEventListener('touchmove', e => { if (swiping) e.preventDefault(); }, { passive: false });
  board.addEventListener('touchend', e => { const t = e.changedTouches[0]; onEnd(t.clientX, t.clientY); }, { passive: true });
  // pointer (mouse drag) for desktop testing
  board.addEventListener('pointerdown', e => onStart(e.clientX, e.clientY));
  board.addEventListener('pointerup', e => onEnd(e.clientX, e.clientY));

  // ---- responsive ----
  window.addEventListener('resize', () => { if (state) computeMetrics(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (state) computeMetrics(); }).observe(board);

  // ---- boot ----
  computeMetrics();
  openSetup();

  // ---- public hook (for tests / integration) ----
  window.Pixel2048 = {
    get state() { return state; },
    get snapshot() { return state ? Object.assign({}, state, { cells: Core.values(state.cells) }) : null; },
    get animating() { return state ? state.animating : false; },
    move: doMove,
    undo: doUndo,
    pause: togglePause,
    openSetup,
    newGame,
    core: Core,
  };
})();
