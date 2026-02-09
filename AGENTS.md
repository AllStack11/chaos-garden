# AGENTS.md

Agent instructions for working in this repository. These rules are derived from `.clinerules/` and are intended to be followed directly.

## Project Context

- Project: `Chaos Garden`
- Frontend stack: Astro + TypeScript (`frontend/`)
- Backend stack: Cloudflare Workers + TypeScript (`workers/`)
- Database: Cloudflare D1 (SQLite)
- Shared types: `shared/types.ts`
- Core simulation: ecosystem with plants, herbivores, carnivores, fungi

## Core Working Principles

- Optimize for clarity and maintainability over cleverness.
- Prefer explicit, descriptive names over short names.
- Keep functions small, single-purpose, and composable.
- Keep simulation rules simple; let emergent behavior come from composition.
- Do not use `any` unless absolutely unavoidable.

## Naming Rules (Strict)

- Use `camelCase` for variables/functions.
- Use `PascalCase` for interfaces/types/classes.
- Use `UPPER_SNAKE_CASE` for constants.
- Function names must clearly describe behavior.

Examples:

- Good: `isEntityReadyToReproduce`, `calculateDistanceBetweenEntities`
- Bad: `check`, `calc`, `get`, `find`

## TypeScript Rules

- Keep TypeScript strict.
- Prefer explicit interfaces and discriminated unions where appropriate.
- Avoid hidden implicit behavior; favor obvious contracts.
- Add short JSDoc only for non-obvious or public functions.

## Astro Frontend Rules

- Keep Astro components structured cleanly: frontmatter, template, style, script.
- Use `<script>` only for client-side behavior.
- Prefer focused vanilla JS/TS for interactions.
- For canvas, cache canvas/context references.
- For canvas, clear before redraw.
- For canvas, use `requestAnimationFrame` for animation loops.

## Cloudflare Workers Rules

- Keep API routes explicit and easy to scan.
- Handle CORS and `OPTIONS` correctly.
- Wrap DB operations in error handling.
- Use prepared statements and parameter binding for SQL.
- Use transactions for multi-step dependent writes.
- Return meaningful HTTP status codes and error messages.

## Simulation Rules

- Keep entity behavior functions deterministic except where randomness is intentional.
- Isolate randomness behind named helpers (e.g., probability checks, mutation helpers).
- Use named constants for thresholds/rates; avoid magic numbers.
- Track lifecycle clearly (birth, aging, reproduction, death).
- Preserve historical/state integrity; do not lose lineage/context.

## Performance Expectations

- Target simulation tick performance under ~1 second for ~500 entities.
- Avoid avoidable O(n^2) patterns; optimize hotspots when needed.
- Profile before major optimization.

## Testing and Verification

For every meaningful change:

1. Verify locally where possible.
2. Check runtime logs/errors.
3. Validate edge cases and failure paths.
4. Confirm API behavior and schema assumptions.

Current project style allows manual verification; automated tests should be added where high risk logic changes.

## Git and Change Hygiene

- Use clear, present-tense commit messages.
- Keep changes scoped to the task.
- Do not introduce unrelated refactors.
- Preserve existing architectural patterns unless intentionally improving them.

## Documentation and Comments

- Explain why, not what.
- Keep comments concise and useful.
- Document non-obvious algorithmic or architectural choices.
- Record important milestones in the work log when requested.

## Work Log Protocol

After completing a task, ask whether to record it in the work log.

Suggested prompt:

- `Task complete. Should I update work-log.md with what we built?`

If approved, append a short entry with:

- What was created
- Files changed
- Status
- Key insights
- Next steps

## Repository Orientation

- `frontend/src/components/` for UI components (including `GardenCanvas.astro`, `StatsPanel.astro`)
- `frontend/src/pages/index.astro` for app orchestration
- `workers/src/simulation/` for simulation engine and creature behavior
- `workers/src/db/queries.ts` for persistence and data mapping
- `workers/schema.sql` for schema
- `shared/types.ts` for cross-layer contracts

## Agent Response Style for This Repo

- Be direct, calm, and practical.
- Teach through concise reasoning.
- Use ecosystem metaphors sparingly; clarity comes first.
- When tradeoffs exist, state them explicitly.
