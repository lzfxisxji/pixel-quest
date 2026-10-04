# Bomber Arena: two independent games

Open http://localhost:4173/bomber.html or choose **BOMBER ARENA** on the existing Pixel Quest main menu. The main menu keeps one entry for this section; Hammer Battle has no separate menu entry or standalone game URL.

The first screen offers **BOMB BATTLE** and **HAMMER BATTLE**. Each opens the reusable character/map/difficulty/player setup. **Back to Modes** returns from setup, pause or results to the internal chooser. Choose Arena returns to the current game's setup; Rematch preserves that setup. The home link returns to Pixel Quest.

## Independence

Bomb Battle continues to use the original `bomber-core.js` without any changes to its simulation, AI, bomb fuse, cross explosions, chain reactions, score or three-round victory rules. See `bomber-README.md` for those rules.

Hammer Battle uses only `hammer-core.js` for combat, AI, health, shields, projectiles, respawning, weapons, score and the first-to-ten elimination outcome. `hammer-view.js` renders its own mallet swings, special weapons, health, elimination counters and respawn countdowns. It does not instantiate the Bomb Match or use bomb mechanics.

The section's `bomber.js` provides the common chooser/setup/navigation, keyboard/touch input, sound and result components, then selects exactly one active simulation and renderer. Both read the six original characters from `character-assets.js`; existing idle/walk pixels remain unchanged. Procedural map textures come from `bomber-assets.js`, with the same three themed steel layouts and dedicated Hammer textures from hammer-assets.js: each map starts with at least 43 destructible obstacles, including crates, barrels and reinforced chests, plus three themed solid obstacle variants. Spawn routes remain clear. No Adventure, Badminton, Fighting or Tank engine is used or edited.

## Hammer rules

- Solo: 1 human against 3 AI. Local co-op: two humans versus two AI in teams. Local versus: pure 1v1, or enable two AI rivals for four-way competition.
- 1 health per spawn. Shield pickups raise health to at least 2; mount pickups grant 3 health and a visible mount. A damaged mount is lost below 3 health. Healing is capped by the acquired upgrade; respawning clears health upgrades and mounts. A regular forward mallet deals 1 damage, with a 0.56-second recovery. One swing hits each opponent only once; steel and crates obstruct attacks. Crates can be smashed for score and random drops.
- At zero health, the player immediately respawns at their original spawn position with 1 health and a 1-second spawn shield. Unlimited respawns continue until a player/team reaches **10 credited enemy eliminations**. Allied damage is disabled; cooperative eliminations accumulate for the team. There is no round timer or bomb victory condition.
- Dora's skill shield absorbs two attacks within their duration. Damage grants brief hit protection and can knock opponents back into an open neighboring cell.
- Seven pickups: **H** heavy mallet (2 damage, longer reach, 0.8-second recovery), **T** thunder mallet (radial swing), **R** returning mallet (melee plus a returning projectile), **S** shield (2 HP), **M** mount (3 HP), **+** health and **E** energy. Weapon effects last 12 seconds. Extra items periodically appear on open tiles; crates can also drop them.
- Character skills consume 100 energy; energy regenerates at 8/s. Mario has a heavy radial fire strike; Commando throws a lightning mallet; Three-Eyed Kid throws a piercing returning light mallet; Dora shields allies and repels nearby enemies; Goku fires a 2-damage Kamehameha; Nezha performs a radial strike and gains five seconds of Wind Fire Wheel speed.
- Enemy elimination scores 200, broken crate 10, pickup 25. Results show team KOs and individual score; Hammer stores only `pq-hammer-best`, separate from Bomb's `pq-bomber-best`.

## Shared controls

| Action | 1P | 2P |
|---|---|---|
| Move / face | WASD | Arrow keys |
| Bomb placement / Hammer attack | J or Space | Enter or Numpad 0 |
| Character ability | K | Right Shift or Numpad 1 |
| Pause | P or Escape | P or Escape |

Actions are single presses. Grid movement interpolates between cells and applies direction changes at centers. Mobile buttons operate player one. Window blur pauses the active game.

## Verification

- `node test-hammer.cjs`: 20 acceptance groups covering formats, six characters, movement, directional damage, walls, crate destruction, shields, respawn protection, team damage, exactly-ten outcomes, every skill and pickup, returning weapons, pause, and **27 complete AI-controlled matches** across all maps, difficulties and formats.
- `node check-arena.cjs`: 12 Chrome checks including the single renamed menu entry, internal selection, Back buttons, independent engine selection, real keyboard movement/mallet attacks/skills for both humans, pause, respawn, ten-KO result fixture, returning to functional Bomb gameplay and mobile co-op navigation.
- Original Bomb acceptance remains `node test-bomber.cjs` (26 groups), `node check-bomber.cjs` (17 Chrome checks, updated only to enter the new chooser) and `node soak-bomber.cjs` (54 complete AI matches).
- `npm run check`, `npm test`, `node check-menu.cjs`: syntax and retained-mode/menu regression checks.
- `arena-preservation.json` records the pre-update hashes used to confirm original Bomb simulation, shared character art and other mode gameplay files were preserved in this update.

Gameplay renders and assets are generated locally, with no production dependencies or remote services. Automated full-match runs are AI-controlled simulations; browser KO/result checks additionally use controlled test fixtures.

Hammer pacing: movement is 3.3 cells/s (previously 3.9); normal swings take 0.4s with a 0.56s recovery interval. Initial destructible obstacle count is increased by one third, rounded up, while retaining safe spawn routes.
