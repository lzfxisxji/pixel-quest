# Tank Battle / 坦克大战

Open http://localhost:4173/tank.html or choose TANK BATTLE in the existing main menu. Run `npm start` from this project if the server is not running. The retired kart.html route redirects to Tank Battle; the Kart Racing implementation has been removed.

## Campaign

Six independently authored maps: Green Frontier, River Crossing, Iron Commander, Twilight Outpost, Frozen Siege and The Last Bastion. Stages 3 and 6 end with heavy tank bosses. Each stage adds enemies and faster fire rates. Clear the whole wave to advance automatically; stage 6 leads to the victory screen. Any stage can also be selected for practice.

Defend the eagle base (3 durability). Each player has 3 lives and a two-hit tank. A destroyed tank respawns after two seconds with a temporary shield, losing one weapon level. A teammate can continue after the other has exhausted their lives. The game ends when the base is destroyed or the entire team has no lives.

Brick walls break a 16-pixel section at a time. Steel is indestructible, water blocks movement, and forests conceal tanks. Projectiles cross forests/water and intercept opposing shells. Friendly fire is disabled, including shots at the base. A short base shield provides deployment time at the start of each stage. Player deployment positions are in front of the base enclosure so defenders can immediately reach its approach lanes.

## Controls

| Action | Player 1 | Player 2 |
|---|---|---|
| Move / aim | WASD | Arrow keys |
| Hold to fire | J or Space | Enter or Numpad 0 |
| Special ability | K | Right Shift or Numpad 1 |
| Pause / resume | P or Escape | P or Escape |

The second-player number keys are **numpad** keys, not the number row. Touch controls operate player 1. The latest held direction wins; movement is cardinal, with gentle alignment assistance when turning in narrow corridors. The game pauses on window blur to avoid unwanted losses.

## Six drivers

| Driver | Unique tank ability (100 energy) |
|---|---|
| Mario / Pixel Explorer | Three flaming explosive shells |
| Commando | Five-way spread, then 8 seconds of rapid fire |
| Three-Eyed Kid | Piercing light arrow that returns along its original line |
| Doraemon | Piercing air cannon and a 5-second shield for the whole team |
| Son Goku | High-damage piercing Kamehameha and a brief shield |
| Nezha | Returning Universe Ring, 5 seconds of speed and a brief shield |

Energy regenerates and kills add charge. Tanks have individual colors and turret insignia. The character picker reads the existing original character sprites without modifying them. All tank hulls, terrain, base, pickups, shells, skill projectiles, muzzle flashes and explosions are procedural local pixel artwork. Sound effects are synthesized locally with Web Audio after Start Mission; Sound Off mutes them.

## Power-ups

Enemies drop an item every third kill and on boss kills. Pickups expire after 16 seconds: Weapon (levels 1–3: single shot, stronger/faster shells, paired shells), Shield, Bomb, Freeze, Base Repair and Extra Life. Bombs wipe ordinary tanks and damage bosses. Score is awarded on enemy destruction; only the dedicated `pq-tank-best` record is persisted.

## Module boundaries

`tank-core.js` contains deterministic, DOM-free state/physics/AI; `tank-assets.js` draws pixel artwork; `tank.js` owns input/rendering/audio; `tank.html` and `tank.css` own this page only. It reads `character-assets.js` and loads no other mode's engine or stylesheet. Existing adventure, badminton and fighting simulation/configuration files are unchanged.

## Verification

- `node test-tank.cjs`: 20 logic checks, including all maps/characters, collision, terrain destruction, firing, damage, skills, all pickups, friendly-fire isolation, base defense, respawn, co-op, pause, bosses, seeded AI and full six-stage transition fixtures.
- `node check-tank.cjs`: 17 Chrome checks using real keyboard input for both players, character selection, skills, mobile layout and actual touch taps, pause, boss spawn, automatic transitions, victory UI, current menu links, old URL redirect and retained mode initialization. Progression tests use controlled state fixtures; they do not claim a human-played campaign completion.
- `node check-menu.cjs`: 7 menu/regression checks including adventure's home confirmation, badminton save isolation and responsive four-mode menus.
- `npm run check` and `npm test`: syntax checks and retained-mode plus tank simulation checks.
- `npm run verify`: all of the above plus the existing badminton footwork browser suite. Browser checks require the bundled Codex Playwright installation and Chrome at the configured Windows path; no production dependencies are needed.

Visual review artifacts: preview-tank-setup.png, preview-tank-battle.png and preview-tank-mobile.png.
