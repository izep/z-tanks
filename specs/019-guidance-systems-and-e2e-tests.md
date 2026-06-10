# Spec 019: Guidance Systems & End-to-End Browser Tests

## Goal
Implement the guidance accessories from Requirements 2.2 and add automated
browser tests that verify the real gameplay loop end to end.

## Guidance systems
- **Heat Guidance** ($6,000): steers a projectile toward the nearest living
  enemy, but only while descending. One unit consumed per shot.
- **Lazy Boy** ($19,000): strong homing for the entire flight.
- Armed via the new crosshair HUD button: click toggles (strongest owned),
  long-press opens a selector. The HUD shows the armed system and remaining
  stock; arming auto-clears when supply runs out.
- Implementation: `tank.activeGuidance` is consumed in
  `PhysicsSystem.fireProjectile` and attached as `projectile.guidance`;
  steering lives in `StandardFlightBehavior` (never targets the owner).
- Cyborg/Spoiler AIs buy Lazy Boys when rich and arm guidance before firing.

## End-to-end tests (Playwright, tests/e2e.spec.ts)
Headless Chromium against the vite dev server (port 5174), driving the real
DOM/keyboard and asserting on `window.game` state:
- App shell loads (canvas, UI layer, setup screen) with no page errors.
- Setup exposes wind/gravity/cash options and they apply to game state.
- HUD appears on game start; angle/power respond to arrow keys; power never
  exceeds the 1000 cap; Tab cycles weapons.
- Space fires, phase transitions to PROJECTILE_FLYING, and the turn passes
  to the next player; a full exchange completes without errors.
- Guidance: HUD row appears when owned, button arms it, firing consumes a
  unit and the projectile carries the guidance flag.
- Shield: S key activates a shield with 200 HP.

Also fixed: page `<title>` was the package-name placeholder, which the
pre-existing `app.spec.ts` asserted against (it could never pass).

## Acceptance Criteria
- [x] Guidance items purchasable, armable, consumed per shot, steering works.
- [x] AI uses guidance.
- [x] `npm test` passes (136 unit tests incl. 7 guidance tests).
- [x] `npm run test:e2e` passes (12 browser tests).
- [x] `npm run build` passes.

NR_OF_TRIES: 1
