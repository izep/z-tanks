# Tanks-a-Lot TS

A TypeScript Progressive Web App (PWA) port of the classic artillery game.

## Gameplay

Tanks-a-Lot is a turn-based artillery game where players control tanks and try to destroy each other on a destructible 2D terrain.

### Core Mechanics
- **Turn-Based Combat:** Players take turns moving their tanks, aiming, and firing a variety of weapons.
- **Economy:** Players earn credits by dealing damage to opponents. These credits can be used to purchase a wide array of weapons and items from the in-game shop.
- **Destructible Terrain:** The terrain is fully destructible, so strategy and positioning are key.
- **Physics:** Projectiles are affected by gravity and wind, and tanks are subject to fall damage.
- **AI Opponents:** The game features AI-controlled opponents for single-player action.

## Features
- Destructible Terrain (Canvas-based) with settling/landslides
- Physics (Gravity, Wind, Projectile Motion), both configurable at setup
- Max firing power tied to tank strength (1000 at full health), as in the original
- Tank Movement and Aiming with fuel consumption
- Hotseat Multiplayer & 8 AI personalities (Moron through Cyborg)
- Full Scorched Earth arsenal: missiles, nukes, MIRV, Death's Head (9 warheads), rollers, diggers, sandhogs, riot weapons, dirt weapons, napalm, tracers, Funky Bomb, Leapfrog
- Energy weapons (Laser, Plasma Blast) powered by batteries
- Guidance systems (Heat Guidance, Lazy Boy) that steer shots toward enemies
- Defensive accessories: Shields, Mag Deflector, Contact Triggers, Auto Defense, Parachutes
- Economy: dynamic market pricing, configurable interest and market volatility, earnings for damage and kills, sell-back of unused gear, and arms-level shop restrictions
- Main menu with How-to-Play guide, and a pause menu (Esc or ⏸) with audio controls and Save & Quit
- Save/Load: the game autosaves every turn; resume from the main menu with "Continue Saved Game"
- Retro synthesized sound effects and a chiptune music loop, with volume/mute/music controls
- Unit Tests (Vitest) and browser end-to-end tests (Playwright), both run in CI before every deploy

## Controls
- **A / D**: Move Tank (consumes fuel)
- **Arrow Left / Right**: Adjust Angle
- **Arrow Up / Down**: Adjust Power (capped by tank health)
- **Space**: Fire Weapon
- **Tab**: Cycle to Next Weapon
- **S**: Toggle Shield
- **B**: Use Battery (restores health and max power)
- **T**: Arm/disarm Contact Triggers
- **Esc**: Pause / resume

On touch devices, use the on-screen D-pad (aim/power), the ⏪/⏩ buttons to move, the 🔋 button to use a battery, and the action buttons on the right. Long-press the weapon, shield, or guidance button to open a selector. The 🔊 button toggles sound.

## Weapons & Items

Tanks-a-Lot implements the original Scorched Earth arsenal (see `Requirements.md` for the full table). Highlights:

### Weapons
- **Missile family:** Baby Missile (infinite) and Missile.
- **Nukes:** Baby Nuke and Nuke for area devastation.
- **MIRV / Death's Head:** Split into 5 missile / 9 nuclear warheads at apogee; they fizzle if they hit something on the way up.
- **Rollers:** Roll downhill and detonate at the bottom — they bounce off shields.
- **Diggers & Sandhogs:** Tunnel through terrain; sandhogs carry explosive warheads.
- **Riot & Dirt weapons:** Clear dirt or create it, for unburying yourself or burying enemies.
- **Napalm:** Splashes and burns, flowing downhill.
- **Energy weapons:** The Laser cuts a straight line through anything; the Plasma Blast radiates from your tank. Both consume up to 3 batteries per shot and are weak without them.
- **Tracers:** Free trajectory testing without damage.

### Items
- **Fuel:** Replenishes your tank's fuel supply.
- **Shield / Heavy Shield:** Absorb 200 / 400 damage before your hull takes hits.
- **Parachute:** Saves your tank from fall damage.
- **Battery:** Restores health, which also raises your max firing power, and powers energy weapons.
- **Heat Guidance:** Steers your shot toward the nearest enemy as it descends. Consumed one per shot.
- **Lazy Boy:** Full-flight homing guidance — fire and forget. Arm either via the crosshair button (click to toggle, long-press to choose).
- **Mag Deflector:** Magnetic field that kicks incoming shots off course. It doesn't absorb damage, and each deflection drains its charge.
- **Contact Triggers:** Your shots detonate on first contact — MIRVs explode even before apogee and rollers blow up on touch instead of rolling. Arm with **T**, one consumed per shot.
- **Auto Defense:** Automatically raises your best shield at the start of every round. Buy once, works all game.

## Economy

- Players start with configurable cash (default $10,000).
- Earn credits for every point of damage dealt and a bounty for each kill; the round's last tank standing earns a win bonus.
- Unspent credits collect 10% interest between rounds.
- Prices fluctuate with demand; unused gear can be sold back in the shop at a fraction of the current price.

## Development

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Run Tests
```bash
npm test
```

### Run End-to-End Tests (Playwright)
```bash
npx playwright install chromium   # first time only
npm run test:e2e
```
The e2e suite launches the game in a headless browser and verifies the real
gameplay loop: setup options, HUD, aiming/power input, weapon cycling, firing,
turn passing, shields, and guidance systems.

## Deployment

This project is configured to automatically deploy to GitHub Pages on every merge to the `main` branch.

### Setup GitHub Pages (First Time Only)

1. Go to your repository Settings → Pages
2. Under "Build and deployment" → Source, select "GitHub Actions"
3. The workflow will automatically deploy on the next push to `main`

The site will be available at: `https://izep.github.io/tanks-ts/`

### Manual Deployment

You can also deploy manually using:
```bash
npm run deploy
```
