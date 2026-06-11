# Spec 022: Main Menu & Pause Screen

## Goal
Give the game a proper front door and an in-game pause (Requirements 7.1):
no more booting straight into the setup form, and a way to stop mid-game.

## Main menu
- New `MENU` phase is the boot state. Title screen with NEW GAME (-> setup),
  CONTINUE SAVED GAME (shown when a save exists), and HOW TO PLAY.
- Game over returns to the menu (Enter), not the setup screen.

## Pause
- `state.isPaused` freezes `GameEngine.update()` entirely (input, physics,
  AI timers, settling) while rendering continues. Never persisted.
- Toggled by Esc or the on-screen ⏸ button (play phases only; the engine
  guards via PLAY_PHASES).
- Pause menu: RESUME, HOW TO PLAY, SAVE & QUIT TO MENU, plus volume slider
  and music toggle synced with the persisted audio settings.
- Quit-to-menu performs a best-effort save (stable phases save immediately;
  otherwise the turn-start autosave stands).

## Help overlay
- Full controls table (keyboard + touch) and gameplay tips; reachable from
  both the menu and the pause screen; Esc closes it.

## Fixed along the way
- Enter on the game-over screen only worked for draws: the handler matched
  the literal text "GAME OVER", which a winner banner doesn't contain. Now
  keyed off the GAME_OVER phase.
- Enter in the shop never worked: the handler checked for display 'block'
  but the shop layer uses 'flex'.

## Acceptance Criteria
- [x] App boots to the menu; New Game/Continue/Help all work.
- [x] Esc/⏸ pause freezes the simulation; resume/quit work; Esc is a no-op
      on the menu.
- [x] 152 unit + 17 e2e tests pass; build passes.

NR_OF_TRIES: 1
