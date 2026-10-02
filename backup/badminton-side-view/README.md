# Backup: Shuttle Club, side-view court (pre-2.5D)

Frozen copy of the whole badminton mode exactly as it was before the 2.5D isometric
redesign. Nothing in the live game loads these files; they exist only so the previous
court can be restored byte-for-byte.

| File | What it is |
|---|---|
| `badminton.html` | Court page markup, touch pads, instructions |
| `badminton.css` | Shuttle Club styles |
| `badminton-core.js` | Deterministic simulation (scoring, shots, AI, physics) |
| `badminton.js` | Side-view renderer and input |
| `test-badminton.cjs` | 21 simulation checks as they were |
| `check-badminton-move.cjs` | 6 browser checks for the two-axis side-view footwork |

## Restore

From the project root:

```bash
cp backup/badminton-side-view/{badminton.html,badminton.css,badminton-core.js,badminton.js} .
cp backup/badminton-side-view/{test-badminton.cjs,check-badminton-move.cjs} .
npm test && node check-badminton-move.cjs
```

The same state is also preserved in git history: commit `154c972`, tag
`badminton-side-view`, branch `backup/badminton-side-view`.

## What the redesign changed

Side view (length across the screen, court width compressed into a 30 px band) became an
oblique 2.5D court: a real pinhole camera over a metric court, so the floor is a
trapezoid, characters scale with distance, shadows sit on the slanted ground plane and
the shuttle flies through a full `x` / `z` / `y` volume.
