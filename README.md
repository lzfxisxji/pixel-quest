# Pixel Quest

A complete, original four-stage browser platformer inspired by the feel of 8-bit classics. All sprites, stages, music, and sound effects are generated in code. No paid assets or game engine required.

## Play

**Play now in your browser: <https://lzfxisxji.github.io/pixel-quest/>** — the main menu offers **ADVENTURE** or **BADMINTON**, and both return to the main menu. The badminton court alone is at <https://lzfxisxji.github.io/pixel-quest/badminton.html>.

To run it on your own machine, open `index.html` directly in a modern browser, or run `npm run dev` from a command prompt in this folder and visit **http://localhost:4173**. `npm run dev` starts the local server with caching disabled, so edited scripts and styles show up on reload. `npm start` serves the same folder on the same port without that. Node.js is required only for the optional local server. The game itself has no package dependencies. Web fonts are optional; built-in fallbacks work offline. Set `PORT` to serve on another port.

## Controls

| Action | Keyboard |
| --- | --- |
| Move | Left / Right or A / D |
| Normal jump | K / Up / W — hold for a higher jump |
| High jump | Space — ground high jump only; no midair jump |
| Double jump | Press K again in midair (one extra jump before landing) |
| Run | Hold Shift |
| Attack | J (X also works), after collecting the selected hero's attack upgrade |
| Pause / resume | P toggles pause; Escape opens the pause menu |
| Return home | On pause, choose RETURN HOME or press Escape again; confirm or cancel |
| Start / continue | Enter |
| Restart adventure | R |
| Mute | M |

The main menu (the title screen inside the arcade cabinet) offers two modes: **ADVENTURE** and **BADMINTON**. ADVENTURE opens the character selector, choose a character, then start. Left / Right selects a card and Enter confirms. Continue Adventure resumes the saved character directly. Touch devices get movement, run, jump, and fire buttons. Fullscreen and audio controls are above the game. Browser audio begins after an input gesture.

Returning home saves the current world, score, lives, character, and powers. CONTINUE ADVENTURE starts that world again from its beginning. Cancel returns to pause without changing the run.

## Characters

- **Pixel Explorer:** the original platforming hero. Mushrooms enlarge the entire character to 1.5 times its starting size; fire flowers unlock fireballs.
- **Commando:** an original pixel soldier with blond hair, a blue headband, white vest, blue trousers, and a rifle, inspired by classic run-and-gun games. He starts unable to attack. Collect the red **N** capsule to unlock normal bullets, then collect **L** for piercing lightning or **S** for five-pellet spread. L and S are alternate third-tier weapons and can replace each other when collected. Question blocks give N at the initial tier; later reward blocks choose L or S from their contents. Size remains fixed. Damage lowers the weapon to normal bullets, then no attack; a lost life restores the initial state. Weapon choice persists in saves and between stages.
- **Three-Eyed Kid:** a fixed-size mystic hero with a third eye, blue outfit, and brown shoes. His blue mystic orb upgrades **no attack → horizontal light wave → orange returning arrow**. Press J to attack. The arrow pierces enemies, flies horizontally at a fixed height, and returns along its original path to the launch point without following the player; only one arrow may be active at a time. Land on it from above to freeze it as a platform for five seconds of active gameplay. Its countdown cannot be reset by repeatedly stepping on it. Jump away with K or Space before it expires. Damage lowers the tier; a lost life restores the initial state.

Character choice and ammunition tier persist with the adventure save and between stages.

**Doraemon** is the fourth selectable character. His fixed-size pixel art includes the blue round head, white face and belly, red nose, whiskers, collar, and bell. Jumping shows an animated bamboo rotor above his head; it is visual and keeps the existing jump physics. Collecting dorayaki upgrades him from **no attack → air cannon → super air cannon**. J fires a horizontal air ring at tier two; tier three fires a larger pressure wave that hits at most two distinct enemies. After its first kill, remaining damage is halved (1 → 0.5); a normal second foe survives with half health, and a second-target boss loses half a health point. The wave expires on its second hit and knocks back surviving targets. Damage lowers one tier, and losing a life returns to tier one. Both normal and super air shots stop at terrain.

**Son Goku (Dragon Ball)** is the fifth character. His pixel art has spiky black hair, an orange gi, blue belt and boots, and a tail. Four-star Dragon Balls upgrade **no attack → Kamehameha → Super Saiyan with stronger Kamehameha**. J fires a horizontal energy blast. Both attacks hit only one enemy and stop on terrain; the normal blast deals one boss health point, and the Super Saiyan blast deals two. The third tier adds golden hair, turquoise pupils, and animated golden aura. Nimbus appears beneath his feet while airborne, as a visual effect using the existing jump physics. Damage lowers the tier, and the selection and tier are saved normally. These damage values and progression are game adaptations. Canon-inspired references: [Official Goku technique compendium](https://en.dragon-ball-official.com/news/01_140.html), [Official Super Saiyan Goku and Kamehameha reference](https://en.dragon-ball-official.com/news/01_3393.html).

## Adventure

Explore Sunrise Meadow, The Crystal Cavern, Cloudtop Crossing, and Ember Keep. Strike question blocks from below. Pixel Explorer alone gets mushrooms for 1.5× growth and flowers for fireballs; other heroes get their own upgrade items. Stars give temporary invincibility. Stomp roaming foes, kick turtle shells, and watch for plants hiding in pipes. Invisible blocks hold bonus stars. Collect 100 coins for an extra life. Flags award height bonuses and remaining time becomes score. Defeat the five-hit keeper before claiming the final flag.

At each flag, fireworks launch over the finish area while the hero walks to the exit pipe, hops onto it, and disappears inside. The next world starts automatically. After the fourth pipe, the victory screen appears.

Each stage has a midway checkpoint for recovery after a lost life. Progress saves at stage entry, checkpoints, power-ups, and life changes. Continue from the title screen resumes the saved stage. Best scores persist locally; a completed or exhausted adventure clears its continue save.

## Validation

Run `npm run check` for syntax checks and `node test-game.cjs` for deterministic gameplay acceptance checks covering movement, jumping, character-specific pickups, weapons, enemies, fireworks, stage progression, and victory. With the server running, `node check-pickups.cjs` checks the item art in Chrome and writes `preview-powerups.png`; `node check-finish.cjs` checks the finish sequence; `node check-menu.cjs` drives real Chrome over the DevTools protocol (no Playwright install needed) to check the main menu mode row, Adventure Mode, Badminton Mode, returning to the main menu from either mode, and the phone layout, writing `preview-mode-select.png` and `preview-mode-select-mobile.png`. Point it at the deployed copy instead of localhost with `PQ_SITE=https://lzfxisxji.github.io/pixel-quest/ node check-menu.cjs`; the same 10 checks pass against GitHub Pages. `node check-badminton-move.cjs` proves the two-axis badminton footwork in the same way: it holds the arrow keys, reads the lane out of the simulation and the character's feet out of the rendered canvas, and also checks the phone pad layout, writing `preview-badminton-lanes.png` and `preview-badminton-touch-lanes.png`.

The game uses a fixed 60 Hz simulation with a capped accumulator, responsive pixel-rendered canvas, procedural parallax scenery, and Web Audio synthesis. The game and its art are an original homage, not an official Nintendo release.
# Shuttle Club — independent badminton mode

Open `http://localhost:4173/badminton.html`, choose **BADMINTON** on the Pixel Quest main menu, or choose **SHUTTLE CLUB** above the adventure cabinet. The court, net, racket, shuttle, particles and sounds are generated locally. No new runtime dependencies are required.

Badminton Mode is the same standalone page reached from the main menu, so nothing in the adventure changed. Return to the main menu with **BACK TO PIXEL QUEST** on the pause or result screen, or the **ADVENTURE** link in the page switch.

Footwork has two independent axes. **A**/**D** or **←**/**→** move along the court, between the back line and the net, and **W**/**S** or **↑**/**↓** move across it, between the back line and the front line, so the hero can attack from the front court or retreat behind the shuttle. Jumping with **SPACE**/**K** stays the separate height axis, and each rally restarts from the middle of the court. The AI covers both axes as well. Touch devices get an up and a down button beside the left and right pair.

Choose any of the six heroes and any AI opponent, select Easy / Medium / Hard, then choose Normal or Hero Skills. Every match uses rally scoring: the point winner serves, the first side to 11 wins, with no deuce. In/out and net faults award one point. Rematch, settings, pause, exit confirmation and separate win/match records are included.

Controls: A/D or Left/Right move, Space or K jump, J serves or hits a clear, L plays a front-court drop, H plays a jumping smash (a drive from the ground), E uses the selected hero's ability at full charge. Hold J/L/H to repeat timed swing windows. Successful hits add 25% charge; skills consume 100% and have an 8-second cooldown. P or Esc opens/resumes the pause menu. Touch controls and fullscreen controls are included.

Hero skills: Explorer's Firebird clear, Commando's Lightning drive, Three-Eyed Kid's Third-eye orbit, Doraemon's Air cannon and brief footwork boost, Goku's Kamehameha smash, and Nezha's Crimson ribbon drop. The AI follows the same charge, reach and cooldown rules.

The 2D shuttle simulation uses a 13.4 m court mapped to 376 logical pixels, a 1.55 m net, 9.8 m/s² gravity, quadratic drag, a stable terminal fall and fixed simulation steps. Clear/drop/smash trajectories are solved through the same drag model. AI predicts descending interception positions; difficulty changes reaction time, movement speed, placement error and aerial play. This is an accessible side-view game, not a full 3D badminton simulator.

`character-assets.js` contains only immutable shared sprite data. `badminton-core.js` owns badminton physics, AI, scoring and skills; `badminton.js` owns its rendering, audio and input; the adventure keeps its existing game state and save key. Badminton records use `pq-badminton-records` only. Neither mode loads the other's game engine.

Run `npm run check` and `npm test`. The badminton tests cover physics, faults, service, movement, pause, match end, all six abilities, and complete 11-point matches for all six characters in both formats. Browser acceptance also checks real UI interactions, mobile layout, result/record updates and adventure-save isolation.
