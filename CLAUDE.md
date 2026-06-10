# Claude Coding Agent Entry Point

> See **[AGENTS.md](./AGENTS.md)** for full instructions.

---

## Quick Context

**Project:** Tanks-a-Lot TS (Scorched Earth clone)  
**Constitution:** `.specify/memory/constitution.md`  
**Status:** Core gameplay complete — full arsenal, AI, economy, hotseat multiplayer. Remaining: online multiplayer, save/load (see TODO.md)

---

## Your Mode

### Ralph Loop (Autonomous)
If you were started by `./scripts/ralph-loop.sh`:
- Read constitution + specs + history
- Pick ONE incomplete spec
- Implement completely
- Test, commit, push
- Output: `<promise>DONE</promise>` (only when 100% done)

### Interactive (Normal Chat)
- Help create specs
- Answer questions
- Guide decisions
- Explain Ralph when ready

---

## Core Files

1. `.specify/memory/constitution.md` — Your guiding principles
2. `specs/*.md` — What to build
3. `TODO.md` — 10-phase roadmap (3,371 lines)
4. `Requirements.md` — Full specification (392 lines)

---

See **[AGENTS.md](./AGENTS.md)** for complete instructions.
