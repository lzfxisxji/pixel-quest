# 俄罗斯方块

Independent mode: `blocks.html`, `blocks.css`, `blocks.js`, `blocks-core.js`. Open http://localhost:4173/blocks.html or the sixth lobby card. No dependency on any other mode engine or global CSS. All visual assets and sounds are drawn/synthesized locally.

Two independent 10 × 20 fields receive identical seeded seven-bag streams and identical initial obstacle patterns (0–10 rows). Piece consumption is independent, so slower players still receive the same sequence. Clearing lines never alters the opponent's field. Hold, SRS clockwise/counterclockwise rotation with I-specific kicks, ghost, five-piece preview, soft/hard drop, bounded lock-delay resets, personal combos and back-to-back bonuses are supported.

## Rules

The only victory condition is **Survival**: the last surviving player wins. Score and line totals are personal records and never determine the winner. One player topping out awards the survivor the match; simultaneous topouts draw. There is no line target or match deadline. Both simultaneously accelerate every 45 seconds; landing lock time also gradually decreases (500 ms to a minimum of 120 ms), so extended matches remain challenging.

Both fields have the same selected Easy / Normal / Hard / Expert starting gravity. Personal levels increase every ten lines. AI difficulty is separate: Easy occasionally chooses imperfect placements, Normal evaluates stack height / holes / roughness / line clears, Hard also looks ahead at the next publicly visible piece. All AI speeds have been reduced: action intervals are 450 / 280 / 180 ms, with minimum planning-to-placement times of 1.1 / 0.85 / 0.65 seconds. AI movement uses the same engine actions and gravity as human play.

## Controls

1P: A/D move, S soft drop, W clockwise, Q counterclockwise, Space hard drop, E hold.

2P: Left/Right move, Down soft drop, Up clockwise, Right Shift counterclockwise, Enter hard drop, Right Ctrl hold. Held horizontal movement uses 160 ms DAS / 45 ms ARR; soft drop repeats at 35 ms. Hard drop, hold and rotation are edge-triggered. P / Esc pauses both fields and clock. Blur or hidden page pauses automatically. Mobile has 1P touch controls.

## Scoring

Single 100, double 300, triple 500, Tetris 800, multiplied by current level. Consecutive Tetrises gain 1.5× base score. Consecutive clears gain 50 × combo index × level. All-clear bonus 2000 × level. Soft drop 1 point per cell, hard drop 2 per cell. No T-spin bonus is claimed. Best 1P score is saved only to `pq-blocks-best`.

Run `node test-blocks.cjs` for engine tests and `npm run check-blocks` for live Chromium checks with the local server running. Existing mode tests remain included in `npm test`.
