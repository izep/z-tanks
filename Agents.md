# AI Agent Entry Point

> **You're an AI coding agent.** Welcome to Tanks-a-Lot TS.

---

## Quick Start

1. **Read the constitution:** `.specify/memory/constitution.md`
2. **Check your mode:**
   - **Ralph Loop:** You were started by `scripts/ralph-loop.sh` — focus on completing ONE spec
   - **Interactive:** Normal conversation — help the user create specs or answer questions

---

## Ralph Loop Mode

If started by ralph-loop.sh, follow this process:

### 1. Orient
```bash
# Read these files (in order):
- .specify/memory/constitution.md     # Project principles
- specs/*.md                          # All specifications (find incomplete ones)
- history/*.md                        # Lessons learned from previous attempts
- TODO.md                             # Implementation plan reference
- Requirements.md                     # Full specification
```

### 2. Pick Task
- Select the highest priority incomplete spec from `specs/`
- Check `NR_OF_TRIES` at bottom of spec — if ≥10, split into simpler specs
- Check `history/` for relevant lessons learned
- If top priority seems blocked or requires preconditions, pick a different achievable spec

### 3. Implement
- Complete ALL acceptance criteria
- Write/update tests as needed
- Verify against Requirements.md
- Follow the constitution's principles

### 4. Document Learning
- Add concise notes to `history/YYYY-MM-DD_brief-topic.md`
- Record what worked, what didn't, lessons for future attempts
- Keep notes brief but actionable

### 5. Verify
- Run tests: `npm test`
- Check acceptance criteria: all must pass
- Build: `npm run build` (must succeed)

### 6. Commit
```bash
git add .
git commit -m "feat: [spec name] - [brief description]"
git push
```

### 7. Output DONE
**ONLY** output this when 100% complete:
```
<promise>DONE</promise>
```

If anything fails or is incomplete, explain what's needed and exit WITHOUT the DONE marker.

---

## Interactive Mode

If in normal conversation:

- Help create specifications (ask about features, acceptance criteria)
- Answer questions about the codebase
- Explain Ralph loop when user is ready
- Guide decisions based on constitution principles

To create a spec, use the pattern in `specs/` folder (examples exist if any).

---

## Key Files

| File | Purpose |
|------|---------|
| `.specify/memory/constitution.md` | Project guiding document |
| `specs/*.md` | Feature specifications (what to build) |
| `history/*.md` | Lessons learned from previous attempts |
| `TODO.md` | 10-phase implementation plan |
| `Requirements.md` | Full Scorched Earth specification |
| `scripts/ralph-loop.sh` | Autonomous build loop |

---

## Quick Commands

```bash
# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start Ralph loop
./scripts/ralph-loop.sh

# Limit iterations
./scripts/ralph-loop.sh 20
```

---

## Project Context

This is a modern TypeScript reimplementation of Scorched Earth, the classic turn-based artillery game. The project aims to preserve the authentic gameplay while providing a smooth mobile and desktop experience.

**Current Status:** Core gameplay complete — full weapon arsenal, AI personalities, economy (market, interest, sell-back), hotseat multiplayer. Remaining: online multiplayer, save/load.

**Architecture:** ECS-inspired with centralized GameState and stateless systems

**Tech Stack:** TypeScript + Vite + Vitest + Canvas API

---

Ready to help build Tanks-a-Lot TS!
