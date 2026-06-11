# Spec 021: Production Polish Pass

Covers six items from the production-readiness assessment: sound/music,
defensive accessories, mobile UX, economy settings, talking tanks, and CI.

## Sound & music (Requirements 6.2)
- SFX rebuilt with noise+filter synthesis (boom, whoosh, clank) instead of
  bare oscillator beeps.
- Chiptune background music loop (Am–G–F–E, lookahead scheduler), starting
  with the first game.
- Master volume slider + music checkbox on setup; in-game 🔊/🔇 mute button.
  Settings persist in localStorage (`tanksalot_audio_v1`).

## Defensive accessories (Requirements 2.2)
- **Mag Deflector** ($10,000): armed via the shield selector. Kicks enemy
  projectiles away (one impulse per projectile, 25 charge each, 100 charge);
  does NOT absorb damage.
- **Contact Triggers** ($1,000 for 5): toggled with T, consumed per shot.
  Pre-apogee MIRVs explode instead of fizzling; rollers detonate on touch.
- **Auto Defense** ($15,000, sticky): auto-activates the best owned shield at
  the start of every round.

## Mobile UX (Requirements 8.2)
- Touch buttons for tank movement (⏪/⏩, fuel-consuming) and battery use (🔋).
- Canvas scaling verified: object-fit contain + dynamic viewport + safe areas.

## Economy/settings exposure (Requirements 2.3, 3.2, 3.4)
- Setup options: market volatility, interest rate (0–20%), arms level 1–4,
  Talking Tanks toggle.
- Arms level filters the shop grid and blocks purchases (human and AI).
- All new settings persist through save/load.

## Talking tanks (Requirements 3.4)
- Centralized in TankTalk.ts with 12-phrase pools (player fire, AI fire,
  death); honors the setup toggle.

## CI
- GitHub Actions: test job (vitest + Playwright in headless Chromium) gates
  the build/deploy jobs; e2e artifacts uploaded on failure.

## Acceptance Criteria
- [x] All three accessories purchasable and functional (9 unit tests).
- [x] Audio settings persist; music starts on game start.
- [x] Setup options apply to game state (e2e verified).
- [x] 152 unit + 14 e2e tests pass; build passes.

NR_OF_TRIES: 1
