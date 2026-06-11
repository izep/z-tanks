# Spec 020: Save/Load Games

## Goal
Implement Requirements 8.4: saving and loading of games, including all player
states and terrain.

## Design
- **SaveSystem** (`src/systems/SaveSystem.ts`): single localStorage slot
  (`tanksalot_save_v1`, versioned). Saves only in stable phases (AIMING/SHOP).
- **Autosave**: GameEngine saves on every transition into AIMING (turn start)
  or SHOP, and clears the save on GAME_OVER.
- **Terrain**: `TerrainSystem.serialize()` snapshots the canvas as a PNG data
  URL; `loadFromDataURL()` redraws it and rebuilds the solidity mask from
  alpha and the height map — same pipeline as PNG map loading.
- **Tanks**: `aiController` (behavior, not data) is stripped on save and
  reconstructed from `aiPersonality` on load.
- **Market**: `EconomySystem.restoreMarketState()` restores current prices and
  purchase/sale counts; base prices stay authoritative from WeaponData.
- **UI**: setup screen shows a "Continue Saved Game" button when a save
  exists; loading restores phase, border strategy, wind/gravity settings.

## Acceptance Criteria
- [x] Autosave on turn start and shop entry; cleared on game over.
- [x] Resume restores tanks (credits, inventory, accessories, health),
      round, wind, gravity, border mode, market prices, and terrain.
- [x] AI opponents keep their personalities after load.
- [x] Corrupted or missing saves fail gracefully (button hidden / load no-op).
- [x] Unit tests (7) and an e2e reload-resume test pass; build passes.

NR_OF_TRIES: 1
