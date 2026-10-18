# Beanie

## Workflow

- **Finish every task by committing.** When a task is complete and verified, commit the
  changes — don't leave a finished task's work sitting uncommitted in the working tree.
  Use a clear, descriptive message that matches the repo's existing sentence-style commit
  subjects (e.g. "Remember the selected steam/water/flush preset button across reloads").
  Committing is part of "done"; pushing is not — only push when explicitly asked.

- **Commit directly to `main`.** Do not create a feature branch for changes — commit on
  `main`. The only exception is when explicitly told to work in a git worktree, in which
  case commit on that worktree's branch instead of `main`.

## Architecture changes

- Read `docs/architecture.md` and `docs/runtime-ownership-and-consistency.md` before
  changing command ownership, startup, settings, inventory, caching, or async flows.
- Preserve the single gateway scheduler and the typed machine/inventory/deletion owners.
  Inject narrow capabilities; do not add new gateway or cache singleton imports to flows.
- Run `npx tsx src/test/commandArchitectureGuard.test.ts`, `npm test`, and the relevant
  focused tests before committing an architecture change.

## Fork

- This checkout is a fork of giladger/Beanie (`upstream`, read-only). Read `FORK.md`
  before merging upstream or making a fork-only change, keep fork changes small and
  isolated, and record every fork-only change in its list.
