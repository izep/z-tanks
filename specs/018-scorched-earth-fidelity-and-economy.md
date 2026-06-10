# Spec 018: Scorched Earth Fidelity & Economy Completion

## Goal
Bring weapons, defenses, and the economy in line with the original Scorched Earth
(v1.5) behavior described in Requirements.md, and close out the remaining
gameplay-critical features.

## Changes

### Weapon fidelity
- Blast radii now match the Requirements.md table: Baby Missile 10, Missile 20,
  Baby Nuke 40, Nuke 75, MIRV 20, Death's Head 35, Funky Bomb 80.
- Death's Head splits into **9** nuclear warheads at apogee (was 5).
- MIRV and Death's Head **fizzle** (no explosion) if they hit before apogee.
- Fixed a bug where Baby Missile explosions dealt no tank damage (early-return
  in `triggerExplosion` skipped the damage pass). This also fixed Funky Bomb
  sub-munitions.

### Power & batteries (Requirements 1.5)
- Max firing power = `min(1000, health * 10)`; clamped while aiming, when
  damaged, and at fire time. Batteries restore health and therefore the cap.

### Energy weapons (Requirements 2.1)
- **Laser**: instant straight beam, cuts through terrain, damages every tank in
  its path. Consumes up to 3 batteries; damage 25 (unpowered) to 160.
- **Plasma Blast**: radial blast from the tank itself (turret direction has no
  effect). Radius 10–75 and damage 50–200 scaling with up to 3 batteries.

### Defenses
- Added **Heavy Shield** ($30,000, absorbs 400). Removed dangling
  `super_shield` references. All shield activation goes through
  `activateShield()` (consumes inventory, sets strength from WeaponData);
  fixed AI activating shields with only 20 HP.
- Napalm burn and sandhog warhead damage now respect shields.

### Economy (Requirements 3.2, 7.3)
- Configurable starting cash (default $10,000).
- 10% interest on unspent credits between rounds.
- Earnings: $20 per damage point dealt, $5,000 kill bounty (no self-awards),
  $10,000 round-win bonus.
- Shop sell-back: one unit at 60% of current unit market price; selling
  nudges the market price down.

### Game options (Requirements 3.1)
- Setup screen: Wind (none/normal/strong), Gravity (low/normal/high),
  Starting Cash.

## Acceptance Criteria
- [x] All weapon radii match the Requirements.md table values.
- [x] Death's Head deploys 9 warheads; MIRV deploys 5.
- [x] Pre-apogee MIRV-family impacts fizzle without damage.
- [x] Firing power can never exceed 1000 or `health * 10`.
- [x] Laser/Plasma consume batteries and scale with them.
- [x] Shields (both tiers) purchasable, activatable, and damage-absorbing.
- [x] Interest, kill/damage earnings, and sell-back work.
- [x] `npm test` and `npm run build` pass.

NR_OF_TRIES: 1
