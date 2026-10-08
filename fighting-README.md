# Pixel Clash — standalone fighting mode

Open `http://localhost:4173/fighting.html` on the existing server. This mode adds only its own HTML, CSS, frontend, simulation and tests. It reads `character-assets.js` without modifying it and uses no adventure, kart, badminton or global styles.

Player one: A/D movement, W jump, S block, J punch, K kick, L directional roll, U special, I ultimate. Player two: arrows movement/jump/block, 1 punch, 2 kick, 3 directional roll, 4 special, 5 ultimate (number row or numpad). P/Escape pauses. Touch buttons support player one. Local two-player matches use a keyboard.

Tap J or 1 again after each swing to chain jab, cross and finisher inside a 650ms window. Heavy attacks trade startup for damage and knockback. Guard works from the front while grounded, costs eight energy per attack (shared across a projectile volley) and reduces damage to 30%; an exhausted guard breaks. Energy regenerates and increases on successful hits and taking damage. Specials cost 25; ultimates cost 100. First to win two rounds takes the match. Rounds last 60 seconds; equal health at timeout draws and repeats without awarding a win.

Each hero has a themed special and ultimate. Commando fires a three-bullet spread, Three-Eyed Kid's arrow returns, Nezha throws a ring and summons a red sash, and the remaining heroes launch their signature energy attacks. Ultimates have a longer startup, larger hit area and higher damage. All fighters share movement and health for local fairness.

Validation: `node --check fighting-core.js`, `node --check fighting.js`, `node test-fighting.cjs`. The core is also CommonJS-compatible for testing. `window.PixelFighting.snapshot` exposes read-only copied combat state for browser inspection.

Roll follows the held movement direction, or current facing when no direction is held. A roll lasts 380ms, has a 700ms cooldown, and prevents attacks and blocking. Rolling can be interrupted by damage and evades non-ultimate projectiles during its middle window (80–300ms after startup). Ultimates and melee remain dangerous.

## Character skill combos

P1: J → J → U or J → K → U; P2: 1 → 1 → 4 or 1 → 2 → 4. The first costs 30 energy, the second 35. Each accepted move must follow within 1.15 seconds. The last 320ms of recovery permits buffering the next move. Getting hit resets the sequence. Ordinary standalone special attacks still cost 25.

- Explorer: three fireballs / rushing rising strike with launch.
- Commando: five-shot suppression / fast lightning pulse.
- Three-Eyed Kid: straight third-eye wave / two returning arrows.
- Doraemon: two air cannon shots / close-range air shockwave with strong knockback.
- Son Goku: afterimage rush / charged Kamehameha.
- Nezha: two pursuing rings / red-sash strike with launch.

J → K → I (P1) or 1 → 2 → 5 (P2) spends 100 energy on each character's enhanced ultimate: 26 damage, larger projectile. Ordinary standalone ultimates remain available. The page shows the selected characters' move lists and displays the completed combo name above the fighter. `node check-fighting-combos.cjs` verifies both players' keyboard sequences for every character.
Fighting-only sprite poses live in fighting-sprites.js. Characters render at 96 logical pixels high, with five-stage punch and kick sequences that alter their own limbs. Shared assets are unchanged. Normal melee draws no extra weapon, front square or motion trail, and the in-arena bottom action dock has been removed. U/I remain the player-one special/ultimate keys. Validate with node check-fighting-poses.cjs.

Damage balance: punches deal 2.5 / 2.5 / 5 (10 total); kicks deal 8. Standalone specials deal 11 total; ordinary ultimates deal 28 and combo ultimates 26. Energy costs and timing remain unchanged.

Defense: held frontal guard absorbs 70% of all incoming damage, with ten total guard energy shared across a combo volley. Ultimates consume eighteen guard energy and receive the same 70% mitigation as basic attacks and combo skills. Blocking recovery permits continued guarding while the key is held; releasing guard, attacks from behind, air attacks and insufficient energy still expose the defender. Evaded projectiles continue travelling and cannot hit the same defender again. A successful dodge displays 闪避 and a brief visual fade.

Anti-pressure protection: after four distinct unblocked landed attacks, the defender gains one second of invulnerability and immediately recovers from hitstun. Successive attacks must land within 1.2 seconds; a longer gap resets the count. Multiple pellets from the same action count once. Blocking and evading do not build the counter. Both players and AI use the same rules. Protected fighters blink and display 无敌保护; paused matches freeze the timer.
