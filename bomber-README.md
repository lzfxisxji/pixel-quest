# Bomber Battle / 爆破竞技场

Open http://localhost:4173/bomber.html or choose BOMBER BATTLE on the Pixel Quest title menu. Run `npm start` if the existing server is not running.

## Game formats

- **1P vs 3 AI**: four-way free-for-all. One human, three independent opponents.
- **Local 2P cooperative**: two human teammates against two AI teammates. Allied bombs do not damage teammates, but your own bombs remain lethal. Dora's shield protects the human team.
- **Local 2P competitive**: choose pure human 1v1, or keep the two additional AI rivals enabled for a four-way free-for-all.

The match has up to three rounds. Two wins end it early; otherwise round three concludes with the team having the most round wins. Equal wins are a draw. A simultaneous final elimination draws the round. Results show every participant's score and round wins, with rematch, arena selection and home controls.

Rounds last at most 120 seconds. Sudden death starts closing the outer walkable ring at 95 seconds, then advances every five seconds. Its upcoming boundary is outlined on screen; AI includes future closures in its danger forecast. Closing walls eliminate occupants regardless of shield. Three drawn rounds still conclude, so no match can remain open forever.

## Controls

| Action | 1P | 2P |
|---|---|---|
| Move | WASD | Arrow keys |
| Place bomb | J or Space | Enter or Numpad 0 |
| Ability | K | Right Shift or Numpad 1 |
| Pause / resume | P or Escape | P or Escape |

Place and ability are single-press actions. Movement commits to one grid step and animates smoothly between its centers, with the latest held direction applied at the next center. Players can leave a bomb they occupy when it is placed, but cannot reenter it afterward. Players can pass each other. Mobile touch buttons operate player 1. Window blur automatically pauses the match, including fuses and round timing.

## Arenas and difficulty

**Sunrise Garden**, **Neon Factory** and **Frost Palace** have separate colors, obstacles and fixed pillar arrangements. Soft crate placement and hidden pickups use a seedable random stream each round. Every corner spawn has a tested escape path for both regular and enhanced first bombs.

**Relaxed**, **Arcade** and **Expert** change AI reaction time, movement speed and attack pacing. AI seeks opponents, pickups and destructible-wall frontiers. It predicts future blast intervals, propagates early chain-reaction timing, accounts for destroyed crates, refuses bombs in traps and plans a safe escape before placing a bomb. Unpredictable traps and newly planted rival bombs can still eliminate it; it is not invulnerable.

## Bombs, items and scoring

Bomb fuse: 2.4 seconds. Blast: four cardinal rays plus the center, active for 0.66 seconds. Steel stops fire, crates are destroyed and stop ordinary rays, and touched bombs detonate immediately. A brief amber warning highlights imminent blast cells. Bomb owners are eliminated by their own fire unless protected.

Crates have a 36% chance of hiding an item. It appears after the current flames clear, and future explosions can destroy exposed pickups:

- **B**: bomb capacity +1, maximum 5.
- **F**: blast range +1, maximum 6.
- **»**: movement speed +0.4, maximum 5 cells/s.
- **S**: absorbs one blast and gives a one-second escape window.
- **✦**: energy +45.

Crate destruction scores 10; enemy elimination scores 200; pickup scores 25; round victory scores 500 for each member of the winning team. Energy regenerates at 6/s and an enemy elimination adds 30. Only the dedicated `pq-bomber-best` record is persisted; no other mode's saved progress is touched.

## Original characters, distinct abilities

All six character artwork and existing walk frames come directly from `character-assets.js`, without changes to that file. Mode animation scales and flips those original pixels; no new character artwork is introduced. All abilities cost 100 energy:

| Character | Ability |
|---|---|
| Mario / Pixel Explorer | Next bomb gains 2 blast range |
| Commando | Existing owned bombs detonate after a 0.7-second warning; requires a bomb |
| Three-Eyed Kid | Next bomb passes through one crate per ray, stopping at the second |
| Doraemon | One-hit bubble shield for seven seconds; protects the team in co-op |
| Son Goku | Teleports to a reachable safe tile up to three grid steps away |
| Nezha | Seven seconds of speed, with two seconds of blast immunity; procedural Wind Fire Wheels appear during this ability |

## Independent implementation

- `bomber-core.js`: DOM-free simulation, seeded maps, movement, bombs, forecast, AI, abilities, score and match results.
- `bomber-assets.js`: locally generated arena tiles, crates, bombs, items, fire and effects; read-only original character renderer.
- `bomber.js`: isolated input, UI, fixed-step rendering and synthesized Web Audio effects.
- `bomber.html` and `bomber.css`: standalone entry and scoped appearance.

No Adventure, Badminton, Fighting or Tank engine or stylesheet is loaded. Existing gameplay systems are unchanged. Integration edits are limited to a title-menu entry/keyboard routing, menu layout support, documentation and test commands.

## Verification

- `node test-bomber.cjs`: 26 checks including all formats, maps, original IDs, safe initial spawns, movement, obstruction, fuse timing, cross blast, wall behavior, chain prediction, cooperative friendly-fire rules, shields, all pickups and abilities, AI escape/refusal, pause, rounds/results, draws and sudden death.
- `node soak-bomber.cjs`: 54 complete automated AI-controlled matches across all three maps, difficulties and formats, cycling all six characters and two seeds per combination. Asserts finite/legal positions, meaningful bomb activity and bounded match completion. Pure competitive matches use two actors; solo/co-op use four. This is automated simulation acceptance, not a claim of human-played campaign completion.
- `node check-bomber.cjs`: 17 real Chrome checks for setup, keyboard actions for both humans, natural bomb escape, visible blast, pause, pure local duel, round/results fixtures, rematch, mobile UI, menu keyboard launch, active solo AI, all six live sprites, touch taps and runtime errors.
- `npm run check`, `npm test`, `npm run check-menu`: syntax checks and all retained mode/core/menu regression suites.

Review captures: `preview-bomber-setup.png`, `preview-bomber-battle.png`, `preview-bomber-mobile.png`. Browser checks use the configured Codex-bundled Playwright and installed Chrome; the playable production game itself requires no external assets, packages or network services.
