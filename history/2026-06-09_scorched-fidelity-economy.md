# 2026-06-09: Scorched Earth fidelity + economy completion (spec 018)

## What was done
- Aligned blast radii to the Requirements.md table; Death's Head now 9 warheads;
  MIRV-family fizzles pre-apogee.
- Found and fixed a silent bug: `triggerExplosion` had an early-return branch for
  `baby_missile` that skipped the tank-damage pass entirely — the default weapon
  (and Funky Bomb children) dealt zero damage. Watch for early `return`s in that
  method when adding weapon types.
- Max power tied to health (`getMaxPower` in GameState.ts), clamped in three
  places: aiming input, per-frame tank update, fire time.
- Implemented Laser/Plasma as instant-fire paths in `PhysicsSystem.fireProjectile`
  (like riot charges), not projectile behaviors.
- Centralized damage in `PhysicsSystem.applyTankDamage` — handles shields, death,
  and credit attribution. Napalm/sandhog now route through it via PhysicsContext.
- Shield activation centralized in `activateShield()` (WeaponData.ts).
- Economy: starting cash, 10% interest at round end (GameEngine SHOP transition),
  $20/damage + $5k/kill earnings, sell-back at 60% in ShopSystem.

## Lessons
- Tests pin costs (weapon-costs.test) and earth-weapon radii (riot-bombs.test),
  but standard-weapon radii were unpinned and had drifted ~2x from the spec.
  Added tests/scorched_fidelity.test.ts to pin them.
- physics.test.ts placed a tank at the edge of the old inflated missile radius;
  shrinking radii required moving the test tank 10px closer.
- Mock-context tests for weapon behaviors must include every PhysicsContext
  member; `applyTankDamage` was added to the interface.
