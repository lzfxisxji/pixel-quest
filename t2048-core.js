/* 2048 PUZZLE — pure rule engine (no DOM, no animation).
 * Board is a 2D array of cells; each cell is 0 (empty) or {id, value}.
 * The `id` exists only so the UI can animate tiles between moves;
 * all game truth lives in the numeric `value`.
 * Exposed as globalThis.T2048Core and module.exports for Node tests. */
(function (r) {
  'use strict';

  let _id = 1;
  const nextId = () => _id++;

  const clone = cells =>
    cells.map(row => row.map(c => (c ? { id: c.id, value: c.value } : 0)));

  // numeric view of the board (for equality / display / tests)
  const values = cells => cells.map(row => row.map(c => (c ? c.value : 0)));
  const fromValues = grid =>
    grid.map(row => row.map(v => (v ? { id: nextId(), value: v } : 0)));
  const size = cells => cells.length;

  const maxTile = cells =>
    cells.reduce(
      (m, row) => row.reduce((mm, c) => Math.max(mm, c ? c.value : 0), m),
      0
    );

  // any empty cell OR any two adjacent equal tiles -> a move is possible
  const canMove = cells => {
    const N = cells.length;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = cells[y][x];
        if (!c) return true;
        const v = c.value;
        if (x + 1 < N && cells[y][x + 1] && cells[y][x + 1].value === v) return true;
        if (y + 1 < N && cells[y + 1][x] && cells[y + 1][x].value === v) return true;
      }
    }
    return false;
  };

  // ---- grid transforms ----
  const transpose = cells => cells[0].map((_, x) => cells.map(row => row[x]));
  const reverseRows = cells => cells.map(row => row.slice().reverse());

  // merge one row toward the left. Returns new row, score gained, consumed ids, pairs.
  const mergeLeft = rowCells => {
    const nonZero = rowCells.filter(Boolean);
    const result = new Array(rowCells.length).fill(0);
    let gained = 0;
    const mergedIds = [];
    const pairs = [];
    let i = 0;
    let p = 0;
    while (i < nonZero.length) {
      const a = nonZero[i];
      if (i + 1 < nonZero.length && nonZero[i + 1].value === a.value) {
        // a and b merge into a's id with doubled value; b is consumed
        result[p] = { id: a.id, value: a.value * 2 };
        gained += a.value * 2;
        mergedIds.push(nonZero[i + 1].id);
        pairs.push({ survivor: a.id, consumed: nonZero[i + 1].id });
        i += 2;
      } else {
        result[p] = { id: a.id, value: a.value };
        i += 1;
      }
      p++;
    }
    return { row: result, gained, mergedIds, pairs };
  };

  // dir: 'up' | 'down' | 'left' | 'right'
  const move = (cells, dir) => {
    let work = clone(cells);
    if (dir === 'up') work = transpose(work);
    else if (dir === 'down') work = reverseRows(transpose(work));
    else if (dir === 'right') work = reverseRows(work);
    // 'left' keeps work as-is

    const N = work.length;
    let gained = 0;
    const mergedIds = [];
    const pairs = [];
    let out = [];
    for (let y = 0; y < N; y++) {
      const res = mergeLeft(work[y]);
      gained += res.gained;
      mergedIds.push(...res.mergedIds);
      pairs.push(...res.pairs);
      out.push(res.row);
    }

    if (dir === 'up') out = transpose(out);
    else if (dir === 'down') out = transpose(reverseRows(out));
    else if (dir === 'right') out = reverseRows(out);

    const moved = JSON.stringify(values(out)) !== JSON.stringify(values(cells));
    return { cells: out, moved, gained, mergedIds, pairs };
  };

  // place a new tile (2 at 90%, 4 at 10%) in a random empty cell
  const spawn = (cells, rng = Math.random) => {
    const N = cells.length;
    const empties = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (!cells[y][x]) empties.push([y, x]);
    if (!empties.length) return { cells: clone(cells), spawned: null };
    const [y, x] = empties[Math.floor(rng() * empties.length)];
    const value = rng() < 0.9 ? 2 : 4;
    const out = clone(cells);
    out[y][x] = { id: nextId(), value };
    return { cells: out, spawned: { y, x, value, id: out[y][x].id } };
  };

  // fresh board with `count` starting tiles
  const init = (N, rng = Math.random, count = 2) => {
    let cells = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let i = 0; i < count; i++) cells = spawn(cells, rng).cells;
    return cells;
  };

  // id -> {y,x,value} for animation diffing
  const positions = cells => {
    const map = {};
    for (let y = 0; y < cells.length; y++)
      for (let x = 0; x < cells.length; x++) {
        const c = cells[y][x];
        if (c) map[c.id] = { y, x, value: c.value };
      }
    return map;
  };

  r.T2048Core = {
    clone, values, fromValues, size, maxTile, canMove,
    move, spawn, init, positions, nextId, mergeLeft,
  };
  if (typeof module !== 'undefined') module.exports = r.T2048Core;
})(globalThis);
