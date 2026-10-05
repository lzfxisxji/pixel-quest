# 奇幻岛大冒险 / ISLAND QUEST

Open http://localhost:4173/island.html or menu card 08. This is a new game, independent of 01 冒险闯关.

## Modules and isolation

- island-stages.js: 16 original layouts, four worlds, original secrets/fruit/checkpoints and boss stages 1-4/2-4/3-4/4-4.
- island-core.js: fixed-step movement, jump buffering, coyote time, variable jump, double jump, collisions/slopes, stamina, combat, enemies, bosses, mounts and cooperative camera.
- island-assets.js: original procedural pixel art for scenery, eight enemies, four bosses, fruit, eggs, weapons and five mounts. Character images are buffered without changing their original artwork.
- island-view.js: parallax, animated sprites, particles, telegraphs, stamina/life HUD.
- island.js: independent keyboard/touch input, procedural Web Audio effects, setup, pause, stage reports and progression.
- island.html/island.css: independent page/styles; no other mode stylesheet imports.
- Character assets are read-only. All nine characters use identical physics and damage; visual poses differ.
- Only lobby.js/lobby.css and menu checks changed for integration. Existing adventure/game engines were verified against island-baseline.json. This snapshot is acceptance evidence for this implementation, not a permanent restriction on future intentional edits.

## Controls

1P A/D move; K or Space jump/double jump; hold J fire; R dismount.
2P Left/Right move; Up jump/double jump; hold 1 fire; 2 dismount. Number row and numpad supported.
P/Esc pause. Mobile exposes 1P touch controls. Local 2P uses independent keyboard controls.
Double jump requires a second press in the air; a held key cannot repeatedly jump. One extra jump per airtime; landing restores it.

## Rules

Start with three lives, two health and the stone axe. Stamina drains at easy/normal/hard rates 1.8/2.5/3.3 per second. Zero stamina has a two-second grace period before health loss. Six fruit types restore 10–30 stamina. Death respawns at the latest shared checkpoint with two seconds of protection. No friendly fire.
Weapons last 60 seconds or until a new stage: axe, fireball, boomerang, ice shard, energy disc (maximum two targets). Three projectiles per player maximum. Bosses only take weapon damage during their visible green weak window. Low health increases boss aggression; difficulty changes speed, enemy count, stamina consumption and hazard/boss frequency, not HP.
Five mounts: skateboard (speed/momentum), ground dino (slow, strong bounce), fire dino (short-range fire), wing dino (hold jump to glide for 1.5 seconds), water dino (normal speed in water, safe swimming over deep water). Contact costs the mount before health; R/2 drops a mount for recollection after one second.
Eggs have subtle glints, reveal through approach/jump/attacks, then open through contact or another attack. Rewards include weapons/mounts/fruit, invincibility, life, rare score and a harmless slow surprise.
Both surviving players must reach the goal, and the boss must be defeated. The shared camera follows their midpoint; separation is limited to 470 pixels with safe regroup assistance. Stage reports include total score, time, fruit, enemies, secrets and bonus. The next stage returns to character selection, preserving campaign score/lives. Completed stages unlock independently through pq-island-unlocked; best score uses pq-island-best. These never write the original Adventure save.

## Implementation/acceptance order

One original test stage was built and tested first (test-island-first.cjs and check-island-first.cjs). World 1 was then expanded and traversed with movement/attack inputs (test-island-world1.cjs). Only after this passed were the other three worlds expanded.

Commands:
- npm run check: all project syntax checks, including new Island modules.
- npm test: existing mode regressions plus Island mechanisms, double jump and campaign tests.
- npm run test-island: 16 mechanism checks, double jump, 16-stage traversal.
- npm run check-island: desktop/mobile Playwright flow, independent 2P controls, real keyboard double jump, stage report/next selection, unlock persistence, world/boss screenshots, ending/home and all seven previous mode launch checks.
- node check-island-preservation.cjs: hashes of original Adventure/shared art/other engines against the pre-change snapshot.

Campaign traversal is automated simulation using normal movement and attacks, easy difficulty, default three lives, no god mode or teleportation. Browser tests use deterministic state fixtures for checkpoint/ending/world screenshots, and real keyboard/touch input for movement/jumping/attacks. They are not a claim that a human manually played every difficulty. No browser runtime errors were found.

The Browser plugin was not available; browser verification used the existing bundled Playwright runtime and installed Chrome. No new runtime dependencies or external artwork/music were installed.
