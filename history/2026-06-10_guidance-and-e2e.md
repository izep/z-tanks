# 2026-06-10: Guidance systems + Playwright e2e (spec 019)

## What was done
- Heat Guidance / Lazy Boy accessories; steering in StandardFlightBehavior
  gated on `projectile.guidance`; consumed in fireProjectile; armed via
  `tank.activeGuidance` and a new crosshair HUD button.
- Playwright e2e suite (tests/e2e.spec.ts) driving real keyboard/DOM and
  asserting on the `window.game` handle. 12 tests, all passing headless.

## Lessons
- Playwright was configured (port 5174, webServer) but no browser was ever
  installed and the lone app.spec.ts asserted a title that didn't exist in
  index.html — e2e had clearly never been run. `npx playwright install
  chromium` is required once per machine.
- `window.game` (exposed in main.ts) makes e2e assertions deterministic;
  prefer `expect.poll` on game state over timeouts. Turn resolution after a
  shot (settling) can take >10s — use a 20s poll timeout.
- The setup screen defaults Player 2 to AI; select 'human' in e2e to keep
  turns deterministic.
- InputManager ignores keys when focus is on INPUT/SELECT; clicking the START
  button first leaves focus on a BUTTON, which is fine.
