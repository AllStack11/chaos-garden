# AGENTS.md - Core Agent Entry Point & Role Dispatcher

This is the primary entry point for all AI agents working in the `Chaos Garden` repository.

---

## 🎯 Role Dispatcher (Read This First)

Before taking action, identify which role you are assigned for your current task, and **read only that specific role context file** (relative to the workspace root):

| Role                                | Responsibility                                                                                                                                                      | Role Context File                                             |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------ |
| **System Architect**                | High-level system design, consensus models, data bus architecture, memory budgets, Cloudflare free-tier auditing, plan reviews, and PR architectural audits (`gh pr review`). | 👉 **[`docs/agents/architect.md`](docs/agents/architect.md)** |
| **Coder / Implementation Engineer** | Writing clean, performant TypeScript code, ECS SoA algorithms, PixiJS v8 shaders, Svelte 5 Runes, Vitest suites, opening feature PRs, and resolving audit feedback.    | 👉 **[`docs/agents/coder.md`](docs/agents/coder.md)**         |

> [!IMPORTANT]
> **Context Optimization Rule**: Load only the specific role file for the task at hand. Do not load both role contexts simultaneously unless explicitly performing a cross-role design review.

---

## Universal Repository Principles

The following principles apply to all agents, regardless of role or host operating system:

- **Machine & OS Agnostic**: Never hardcode user home paths (e.g. `C:\Users\...`, `/home/...`), drive letters, or platform-specific line endings. Always use workspace-relative paths and cross-platform Node.js tools.
- **Clarity over Cleverness**: Prefer explicit, readable code and architectures.
- **Strict Typing**: TypeScript `strict: true`. Never use `any` unless mathematically unavoidable.
- **Naming Conventions**:
  - `camelCase` for functions and variables.
  - `PascalCase` for classes, interfaces, and types.
  - `UPPER_SNAKE_CASE` for constants.
  - Functions must clearly state their action: `isEntityReadyToReproduce`, `calculateDistanceBetweenEntities`.
- **Ecosystem Simplicity**: Keep biological rules simple and let emergent complexity arise from composition.
- **Git Hygiene & Branching**: Follow the repository branching strategy in [`docs/branching_strategy.md`](docs/branching_strategy.md). Never commit directly to `main`. Create feature branches using the taxonomy `<category>/<package>-<slug>` (e.g. `feat/engine-spatial-hash`). Present-tense, clear commit messages.
- **Scoped Push Permission**: Agents are authorized to execute `git push` ONLY to designated feature branches (`feat/*`, `fix/*`, `perf/*`, etc.) to open and update Pull Requests. Pushing directly to `main` is strictly forbidden under all circumstances.
- **Merge Authority**: Merges to `main` are performed via Pull Requests using Squash and Merge (`gh pr merge --squash --delete-branch`). Agents are NEVER allowed to execute merges without explicit user direction.

---

## Monorepo Architecture Overview

The codebase is organized as a 4-package npm workspace under `packages/`:

```
chaos-garden/
├── packages/
│   ├── shared/   # @chaos-garden/shared: Cross-layer types, vector math, PRNG, binary stride protocol
│   ├── engine/   # @chaos-garden/engine: Standalone ECS (SoA + Generational Free-List), boids, soil grid
│   ├── client/   # @chaos-garden/client: Vite + Svelte 5 (Runes) + PixiJS v8 + Web Audio + Web Worker
│   └── server/   # @chaos-garden/server: Cloudflare Workers + D1 SQLite (canonical epochs, curator leases)
```

---

## Cloudflare Deployment Notes

- Deploy the Worker first so the current production API URL is known before deploying the frontend.
- Production Worker deploy command: `npm run deploy:workers`
- Frontend deploys must set `PUBLIC_API_URL` to the live Worker URL used by Pages at build time.
- **Cross-Platform Deploy Commands**:
  - **macOS / Linux / POSIX**:
    ```bash
    PUBLIC_API_URL="https://chaos-garden-api.saadmankabir95.workers.dev" npm run build -w @chaos-garden/client
    npx wrangler pages deploy packages/client/dist --project-name chaos-garden-frontend
    ```
  - **Windows PowerShell**:
    ```powershell
    $env:PUBLIC_API_URL="https://chaos-garden-api.saadmankabir95.workers.dev"; npm run build -w @chaos-garden/client
    npx wrangler pages deploy packages/client/dist --project-name chaos-garden-frontend
    ```
- Verify deploys after release:
  - Worker health: `GET https://<worker-url>/api/health`
  - Frontend: confirm the deployed Pages URL returns HTTP `200`
- Current production Worker URL: `https://chaos-garden-api.saadmankabir95.workers.dev`
- Current Pages project name: `chaos-garden-frontend`

---

## Agent Response Style

- Be direct, calm, and practical.
- Teach through concise reasoning.
- Use ecosystem metaphors when it makes sense; clarity comes first.
- When trade-offs exist, state them explicitly.
