/* Pure-node rule tests for the 2048 engine. Run: node test-t2048.cjs */
const assert = require('node:assert/strict');
const C = require('./t2048-core.js');

let n = 0;
const pass = (s) => { console.log('PASS ' + s); n++; };

// helpers
const build = grid => C.fromValues(grid);
const vals = cells => C.values(cells);
const eq2d = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const countTiles = cells => C.values(cells).flat().filter(v => v !== 0).length;
const tileValues = grid => grid.flat().filter(v => v !== 0);

// 1. line merges (classic 2048 rule: each tile merges at most once)
{
  const g = [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const r = C.move(build(g), 'left');
  assert(eq2d(vals(r.cells)[0], [4, 4, 0, 0]), '2,2,2,2 left -> 4,4,0,0');
  pass('2,2,2,2 left -> 4,4,0,0 (no 8 collapse)');
}
{
  const g = [[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const r = C.move(build(g), 'left');
  assert(eq2d(vals(r.cells)[0], [4, 4, 0, 0]), '2,2,4 left -> 4,4,0,0');
  pass('2,2,4,0 left -> 4,4,0,0');
}
{
  const g = [[4, 4, 8, 8], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const r = C.move(build(g), 'left');
  assert(eq2d(vals(r.cells)[0], [8, 16, 0, 0]), '4,4,8,8 left -> 8,16,0,0');
  pass('4,4,8,8 left -> 8,16,0,0');
}
{
  // 2,2,2 left on a 3-wide line: only the first pair merges -> 4,2,0
  const g = [[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const r = C.move(build(g), 'left');
  assert(eq2d(vals(r.cells)[0], [4, 2, 0, 0]), '2,2,2 left -> 4,2,0,0 (single merge per pass)');
  pass('2,2,2 left -> 4,2,0,0 (no chained merge)');
}

// 2. all four directions move/merge identically
{
  const g = [[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]];
  const r = C.move(build(g), 'up');
  assert(eq2d(vals(r.cells).map(row => row[0]), [4, 8, 0, 0]), 'vertical column merges up');
  pass('up merges a vertical column (2,2,4,4 -> 4,8)');
}
{
  const g = [[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]];
  const r = C.move(build(g), 'down');
  assert(eq2d(vals(r.cells).map(row => row[0]), [0, 0, 4, 8]), 'vertical column merges toward bottom');
  pass('down merges a vertical column (2,2,4,4 -> 4,8)');
}
{
  const g = [[2, 2, 4, 8], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const r = C.move(build(g), 'right');
  assert(eq2d(vals(r.cells)[0], [0, 4, 4, 8]), '2,2,4,8 right -> 0,4,4,8 (single merge, no chain)');
  pass('2,2,4,8 right -> 0,4,4,8');
}

// 3. score gained equals sum of merged values
{
  const g = [[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const r = C.move(build(g), 'left');
  assert.equal(r.gained, 4 + 8, 'gained 4 (2+2) + 8 (4+4) = 12');
  pass('score gained = 12 for 2,2,4,4 merge');
}

// 4. invalid move: nothing changes, no gained
{
  // checkerboard of distinct non-mergeable values, full board
  const g = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  for (const dir of ['up', 'down', 'left', 'right']) {
    const r = C.move(build(g), dir);
    assert.equal(r.moved, false, dir + ' is an invalid move on a full distinct board');
    assert.equal(r.gained, 0, dir + ' gains nothing');
    assert(eq2d(vals(r.cells), g), dir + ' leaves board unchanged');
  }
  pass('invalid moves: no change, no score, all 4 directions');
}

// 5. canMove false on full board with no adjacent equals
{
  const g = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  assert.equal(C.canMove(build(g)), false, 'no moves available');
  pass('canMove() false when board full and no merges possible');
}

// 6. win detection at 2048 (and milestones)
{
  const g = [
    [2048, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  assert.equal(C.maxTile(build(g)), 2048, 'maxTile reports 2048');
  pass('maxTile detects 2048 (win condition)');
}

// 7. init: correct size + exactly 2 starting tiles of 2 or 4
for (const N of [4, 5]) {
  const cells = C.init(N);
  assert.equal(cells.length, N, N + 'x' + N + ' grid height');
  assert.equal(cells[0].length, N, N + 'x' + N + ' grid width');
  const tv = tileValues(vals(cells));
  assert.equal(tv.length, 2, N + 'x' + N + ' starts with 2 tiles');
  assert(tv.every(v => v === 2 || v === 4), N + 'x' + N + ' starting tiles are 2 or 4');
  pass(N + 'x' + N + ' init: square, 2 starting tiles (2 or 4)');
}

// 8. spawn adds exactly one tile (until full); full board -> null
{
  let cells = C.init(4);
  const before = countTiles(cells);
  const r = C.spawn(cells);
  assert.equal(countTiles(r.cells), before + 1, 'spawn adds one tile');
  assert(r.spawned && (r.spawned.value === 2 || r.spawned.value === 4), 'spawned value 2 or 4');
  pass('spawn adds exactly one tile (value 2 or 4)');
}
{
  const full = build([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  const r = C.spawn(full);
  assert.equal(r.spawned, null, 'spawn on full board returns null');
  pass('spawn on full board returns null (no overflow)');
}

// 9. a valid move + spawn preserves tile accounting
{
  const g = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const start = countTiles(build(g));
  const mv = C.move(build(g), 'left'); // merges to one 4 -> 1 tile, gained 4
  assert.equal(countTiles(mv.cells), 1, 'one merge leaves one tile');
  const after = C.spawn(mv.cells);
  assert.equal(countTiles(after.cells), 2, 'spawn restores to 2 tiles');
  pass('valid move + spawn tile accounting correct (2 -> 1 -> 2)');
}

// 10. 5x5 line merge
{
  const g = [
    [2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ];
  const r = C.move(build(g), 'left');
  assert(eq2d(vals(r.cells)[0], [4, 4, 2, 0, 0]), '5x5 2,2,2,2,2 left -> 4,4,2,0,0');
  pass('5x5: 2,2,2,2,2 left -> 4,4,2,0,0');
}

console.log(`\n${n} t2048 core checks passed`);
