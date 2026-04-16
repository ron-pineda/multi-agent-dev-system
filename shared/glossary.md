# Glossary

<!-- Domain terms used across projects. Append-only. Format: **Term** — definition -->

<!-- ── GameProject terms added T-001 (2026-04-09) ── -->

**One-tap mechanic** — A game input model where the entire control surface is a single tap (or tap-and-hold) anywhere on the screen. Maximizes accessibility and removes onboarding friction; the gold standard for Flappy Bird-tier casual games.

**Flappy Bird tier** — Informal classification for casual games with a single-gesture input, infinite/reflex-based gameplay, sub-2-minute sessions, and a frustration-ownership death loop. Named after the 2014 viral title by Dong Nguyen.

**"One more try" loop** — The psychological retry mechanism in casual games where the player attributes failure to their own action (or inaction) rather than to the game. Essential for session-over-session retention without any explicit progression system.

**Frustration-ownership** — The game design property where a player's death is clearly traceable to a specific decision or input error they made, making retry feel imperative rather than unfair. Contrast with "BS death" — death caused by apparent randomness or unfair game behavior, which breaks retry motivation.

**Endless runner** — A game subgenre where the player character moves automatically at a constant (or escalating) speed and the player's only agency is avoiding obstacles. Examples: Temple Run, Subway Surfers, Chrome Dino.

**Speed escalation** — A difficulty curve technique where the game's base speed increases incrementally over time, ensuring sessions stay under a target duration and creating a natural skill ceiling that keeps high-score competition meaningful.

**Close-call system** — An engineered game mechanic that detects near-miss collisions (player clears an obstacle within a defined pixel tolerance) and triggers a visual/audio reward event. Designed to produce clip-worthy shareable moments.

**Variable-hold jump** — A jump mechanic where the height and/or distance of the jump is proportional to how long the player holds the input, as opposed to a fixed-height jump triggered on tap-down. Adds a skill dimension (precision hold duration) to otherwise simple one-tap runner games.

**Gravity flip** — A game mechanic where tapping inverts the direction of gravitational pull on the player character, causing it to fall toward the ceiling rather than the floor (or vice versa). Core to games like VVVVVV and the Gravity Flip Cave concept.

**Pendulum re-anchor** — In the Pendulum Path concept: the act of changing the pivot point of a swinging body mid-swing by tapping, transferring momentum to a new arc. Requires timing to preserve swing speed.

**Wobble window** — In the Stack Snap concept: the brief time interval during which a falling block visibly oscillates at the alignment point, signaling to the player that a perfect-snap tap is available. Narrowing the wobble window is the primary difficulty escalation mechanism.

**IAP (In-App Purchase)** — A mobile monetization model where players pay real money for digital goods or features within a free-to-download app. In GameProject the sole IAP is "Remove Ads" at $2.99.

**AdMob** — Google's mobile advertising platform, used in GameProject as the primary revenue source for non-paying players. Displays banner and interstitial ads between game sessions.

**Flame engine** — An open-source 2D game engine built on top of Flutter/Dart. Provides a game loop, sprite rendering, collision detection, and camera utilities. Chosen for GameProject due to zero licensing cost and strong Flutter ecosystem integration.

**Interstitial ad** — A full-screen ad unit served between natural pause points in an app (e.g., between game runs). Higher CPM than banner ads but must be shown sparingly to avoid damaging retention.

**CPM (Cost Per Mille)** — Advertising revenue metric: the amount an advertiser pays per 1,000 ad impressions. Used to estimate AdMob revenue projections for GameProject.

**Hitbox** — The invisible collision boundary used by a game engine to determine when two game objects have made contact. Distinct from the visual sprite; often smaller than the visual to give players perceptual leniency ("coyote tolerance").

**Coyote tolerance** — Informal game design term for intentionally making hitboxes slightly smaller than the visible sprite, so collisions feel fair and leniency is baked in. Reduces "BS death" perception.
