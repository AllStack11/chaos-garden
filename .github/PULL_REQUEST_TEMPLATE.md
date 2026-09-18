## 🌿 Pull Request Summary

### Monorepo Package Scope
- [ ] `@chaos-garden/shared`
- [ ] `@chaos-garden/engine`
- [ ] `@chaos-garden/workers` (Server / D1)
- [ ] `@chaos-garden/frontend` (Client / PixiJS / Svelte 5)
- [ ] Repository / Tooling / Docs

---

### Description of Changes
<!-- Provide a concise summary of the changes made and the motivation behind them. -->

---

### 🧪 Coder Verification Gate
Before opening this PR, the following verification commands were executed locally:
- [ ] `npm run type-check:all` passes with zero TypeScript errors.
- [ ] `npm run test:all` passes across all affected packages.
- [ ] `npm run sim:run -- --seed=42 --ticks=500 --headless` (mandatory if `@chaos-garden/engine` was modified).

---

### 🏛️ Architectural Audit Checklist (Architect Review)
The System Architect audits this PR against the 7 core repository rubrics:

- [ ] **1. Zero-Allocation Rule**: Zero object/array/closure allocations inside per-tick simulation and render loops.
- [ ] **2. Main-Thread Decoupling**: Simulation and heavy calculations stay off the main UI thread.
- [ ] **3. Consensus Safety**: D1 writes strictly gated by Curator Lease verification or scheduled heartbeat.
- [ ] **4. Trophic Order Invariance**: Reproduction thresholds strictly maintain `plant < herbivore < carnivore`.
- [ ] **5. PRNG Determinism**: Seeded Mulberry32 PRNG used for all stochastic logic; zero unseeded `Math.random()`.
- [ ] **6. Battery & Thermal Throttling**: Page Visibility API correctly steps down simulation ticks on tab blur.
- [ ] **7. Offline Resilience & Free-Tier Budget**: Graceful offline fallback; Cloudflare free-tier cost envelope ($0.00/mo) preserved.

---

### 🏁 Sign-Off & Merge Status
- **Architectural Clearance**: ⏳ `PENDING AUDIT` <!-- Updated to "APPROVED" by Architect Agent -->
- **User Final Approval**: ⏳ `PENDING USER REVIEW`
