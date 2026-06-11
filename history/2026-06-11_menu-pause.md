# 2026-06-11: Main menu + pause (spec 022)

## What was done
MENU boot phase, pause via state.isPaused (early-return in GameEngine.update,
rendering continues), pause menu with audio controls and save-&-quit, help
overlay shared between menu and pause.

## Lessons
- Pause as a flag (not a phase) avoids touching every phase transition and
  keeps it out of SaveSystem automatically.
- Two long-standing Enter-key bugs hid in UIManager: game-over matched the
  literal "GAME OVER" text (winner banners don't contain it) and the shop
  check compared display against 'block' when the layer uses 'flex'.
  When gating on UI state, prefer game-state phase checks over DOM text/style.
- E2E helper `openSetup()` centralizes the menu->setup navigation; adding the
  menu only required touching tests at that one seam plus boot assertions.
