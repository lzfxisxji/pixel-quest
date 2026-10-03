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

The main menu (the title screen inside the arcade cabinet) offers three modes: **ADVENTURE**, **BADMINTON** and **PIXEL KART**. ADVENTURE opens the character selector, choose a character, then start. Left / Right selects a card and Enter confirms. Continue Adventure resumes the saved character directly. Touch devices get movement, run, jump, and fire buttons. Fullscreen and audio controls are above the game. Browser audio begins after an input gesture.

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

Run `npm run check` for syntax checks and `node test-game.cjs` for deterministic gameplay acceptance checks covering movement, jumping, character-specific pickups, weapons, enemies, fireworks, stage progression, and victory. With the server running, `node check-pickups.cjs` checks the item art in Chrome and writes `preview-powerups.png`; `node check-finish.cjs` checks the finish sequence; `node check-menu.cjs` drives real Chrome over the DevTools protocol (no Playwright install needed) to check the main menu mode row, Adventure Mode, Badminton Mode, returning to the main menu from either mode, and the phone layout, writing `preview-mode-select.png` and `preview-mode-select-mobile.png`. Point it at the deployed copy instead of localhost with `PQ_SITE=https://lzfxisxji.github.io/pixel-quest/ node check-menu.cjs`; the same 10 checks pass against GitHub Pages. `node check-badminton-move.cjs` proves the four-way footwork in a real browser the same way: it holds the arrow keys, reads the lane and the along-court position out of the simulation, and reads the sprite's contact point out of the same projection the renderer draws with, then checks that the four directions are four distinct screen diagonals, that sprites scale with distance around a live match, and the phone pad layout, writing `preview-badminton-lanes.png` and `preview-badminton-touch-lanes.png`.

The game uses a fixed 60 Hz simulation with a capped accumulator, responsive pixel-rendered canvas, procedural parallax scenery, and Web Audio synthesis. The game and its art are an original homage, not an official Nintendo release.
# Shuttle Club — independent badminton mode

Open `http://localhost:4173/badminton.html`, choose **BADMINTON** on the Pixel Quest main menu, or choose **SHUTTLE CLUB** above the adventure cabinet. The court, net, racket, shuttle, particles and sounds are generated locally. No new runtime dependencies are required.

Badminton Mode is the same standalone page reached from the main menu, so nothing in the adventure changed. Return to the main menu with **BACK TO PIXEL QUEST** on the pause or result screen, or the **ADVENTURE** link in the page switch.

Footwork has two independent axes, and the oblique camera makes both of them visible: **A**/**D** or **←**/**→** move along the court, between the back line and the net, and **W**/**S** or **↑**/**↓** move across it, between the back line and the front line, so the hero can attack from the front court or retreat behind the shuttle. Each direction is a different diagonal on screen, so you can always tell which way you are running. Jumping with **SPACE**/**K** stays the separate height axis, and each rally restarts from the middle of the court. The AI covers both axes as well. Touch devices get an up and a down button beside the left and right pair.

Choose any of the six heroes and any AI opponent, select Easy / Medium / Hard, then choose Normal or Hero Skills. Every match uses rally scoring: the point winner serves, the first side to 11 wins, with no deuce. In/out and net faults award one point. Rematch, settings, pause, exit confirmation and separate win/match records are included.

Controls: A/D or Left/Right move, Space or K jump, J serves or hits a clear, L plays a front-court drop, H plays a jumping smash (a drive from the ground), E uses the selected hero's ability at full charge. Hold J/L/H to repeat timed swing windows. Successful hits add 25% charge; skills consume 100% and have an 8-second cooldown. P or Esc opens/resumes the pause menu. Touch controls and fullscreen controls are included.

Hero skills: Explorer's Firebird clear, Commando's Lightning drive, Three-Eyed Kid's Third-eye orbit, Doraemon's Air cannon and brief footwork boost, Goku's Kamehameha smash, and Nezha's Crimson ribbon drop. The AI follows the same charge, reach and cooldown rules.

The 2D shuttle simulation uses a 13.4 m court mapped to 376 logical pixels, a 1.55 m net, 9.8 m/s² gravity, quadratic drag, a stable terminal fall and fixed simulation steps. Clear/drop/smash trajectories are solved through the same drag model. AI predicts descending interception positions; difficulty changes reaction time, movement speed, placement error and aerial play. This is an accessible arcade game, not a full 3D badminton simulator.

## The 2.5D court

The court is drawn through a pinhole camera looking at it from an oblique angle, so a player standing in the middle of the court can see where the shuttle will land and how far there is to run. `badminton-view.js` is the only place that converts the simulation's three axes into screen pixels: `x` runs along the 13.4 m length, `z` across the 5.18 m width, and `y` is height above the floor. The camera sits at 17 m, 27° above the horizon and 60° round, with a 50° lens aimed 0.75 m above the court centre.

That camera was chosen numerically rather than by eye, so that all of the following hold at once: the two ground axes meet at **67°** on screen instead of being nearly parallel, every footwork direction is a clear diagonal, the playable envelope plus a full sprite above the feet stays inside the frame and clear of the 45 px score bar, the whole court sits inside with room for the stand, and the near corner draws **1.8×** the far corner (62 px against 34 px), which is what makes the depth read. `preview-badminton-court.png` shows the result.

Everything follows from that one projection. Sprites are anchored at the feet and sized by their distance, so players further up the court are genuinely smaller. Shadows are projected onto the tilted floor and shrink and fade as the player jumps. The landing marker is predicted with the same `flight()` integration the simulation itself uses, so the marker and the shuttle can never drift apart, and it is drawn as a projected ring rather than a flat oval. Collision detection gained a lateral reach limit (`REACH_LANE`), so the corners of the court now have to be chased, and the AI covers the lane the shuttle is coming down in rather than a fixed depth. The court surface spans the full doubles width, with the singles sidelines, service lines and long-service lines marked on it as they are on a real court.

`character-assets.js` contains only immutable shared sprite data. `badminton-core.js` owns badminton physics, AI, scoring and skills; `badminton-view.js` owns the 2.5D camera and projection; `badminton.js` owns rendering, audio and input; the adventure keeps its existing game state and save key. Badminton records use `pq-badminton-records` only. Neither mode loads the other's game engine.

Run `npm run check` and `npm test`. The badminton tests cover physics, faults, service, movement, pause, match end, all six abilities, complete 11-point matches for all six characters in both formats, and the 2.5D projection itself — that the camera frames the whole court clear of the score bar, that the four footwork directions are four different screen directions, that sprites scale with distance, and that the metric bridge to the old simulation kept the net at 1.55 m and the floor at zero. Browser acceptance also checks real UI interactions, mobile layout, result/record updates and adventure-save isolation.

The previous side-view badminton mode is preserved byte-for-byte in `backup/badminton-side-view/` (also tagged `badminton-side-view` in git) if you want to compare or roll back.

The Badminton **Relaxed** AI is deliberately beatable. Its reaction delay is three times Competitive's (0.52s against 0.17s), it aims with 2.7x the placement error, it moves at two-thirds of the speed, and it jumps on only 18% of shots against 65%. It also makes timed visible mistakes: with a 34% chance per decision window it will, for half a second to a second at a time, aim at the wrong half of the court, drift out of its lane and hesitate over its swing, and its reaction is doubled for the duration. Competitive and Ruthless make no mistakes at all.

# Pixel Kart — independent kart racing mode

Open `http://localhost:4173/kart.html`, or choose **PIXEL KART** on the Pixel Quest main menu. It is a third standalone page: it loads neither the adventure nor the badminton engine, shares no game state and no save key with either, and the other two modes are unchanged.

| Control | Key |
| --- | --- |
| Accelerate | Up / W / Space |
| Brake, reverse | Down / S |
| Steer | Left / Right, or A / D |
| Drift | Shift or J, through a corner |
| Use item | Enter / L / U |
| Pause | P |

Pick one of the six characters as your driver, one of three circuits and one of three AI difficulties, then **START RACE**. Every race is five karts over two laps: you plus four AI, each in a different character's kart.

**Circuits.** *Sunrise Meadow* is long and open with room to drift. *Old Harbour* is tighter, with a narrow 33px half-width causeway that punishes late braking. *Neon Ridge* is the fastest of the three with a technical middle section. Every circuit is a generated closed loop — the shape is built from a star-shaped polar skeleton, smoothed with a centripetal Catmull-Rom spline, and resampled at a uniform 4px of arc length, so there are no cusps, no self-intersections and no fake hairpins from uneven sample spacing. The build refuses to produce a circuit it cannot measure: it checks that the tightest corner still has enough clear tarmac on the inside, and that separate stretches of the loop never pass too close together to be distinguishable.

**Driving.** Top speed is 330px/s on tarmac and 62% of that in the grass, so running wide costs real time. Hold Shift or J into a corner to drift: the kart's velocity separates from its heading, it slides, lays skid marks and throws sparks, and a longer slide pays a bigger boost on exit. Braking distance is planned backwards around the whole lap, so the speed limit at any point is the fastest the *rest* of the circuit still allows.

**Power-ups** are drawn at random, with the odds biased to what is useful: the leader is more likely to get defence, the back marker more likely to get a boost.

- **Banana** — dropped behind you for the pack to hit.
- **Ink** — dropped on the racing line; the kart that drives into it is partially blind for 1.6 seconds.
- **Lightning** — shrinks every rival for a while.
- **Boost** — a straight speed surge.
- **Shell** — a shield that absorbs one hit.

**AI.** The four opponents aim at a point on the racing line ahead, brake for what is coming, avoid hazards in a forward cone, drift through the corners worth sliding at, and make timed mistakes on the easier tiers. Each AI owns a private random stream for its own decisions, so a field is reliably slower on Relaxed than the same field on Ruthless. Measured over four seeds per circuit, the hard field spends 1.3% of a lap on Sunrise Meadow, 4.3% on Old Harbour and 3.9% on Neon Ridge in the grass.

**Files.** `kart-tracks.js` owns the circuit geometry and is the single source of truth for everything positional — the racing line, the corner speed limits, item box placement and the spatial hash all read from it. `kart-assets.js` bakes every kart in 16 headings, drawn in code with the driver seated in the vehicle; there are no image files. `kart-core.js` owns the race simulation, physics, AI and power-ups. `kart.js` owns rendering, audio, input and the camera.

**Tests.** `node test-kart.cjs` is 34 headless acceptance checks over geometry, physics, drifting, the AI, power-ups and lap counting. `node soak-kart.cjs` runs 54 full races across every circuit and difficulty and asserts none of them hangs, strands a kart, loses a kart or produces an impossible lap. `node check-kart.cjs` drives real Chrome over the DevTools protocol for the 16 things that only exist in a browser: that the page boots alone, that the track is genuinely painted, that all six drivers are visibly seated in their karts, that a drift really slides and lays marks, that a full two-lap race reaches the results screen, and that leaving the mode returns to a main menu where all three modes still work. `npm run verify` runs all six suites — 146 checks in total.

