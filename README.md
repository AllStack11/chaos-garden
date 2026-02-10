# Chaos Garden

> *"Plant the rules. Water them with time. Step back. Watch what grows."*

A digital ecosystem that lives on Cloudflare's edge — photosynthesizing, hunting, decomposing, evolving — whether you're watching or not.

```
        sunrise                          sunset
          ↓                                ↓
  ┌───────────────────────────────────────────┐
  │  ☀                                        │
  │       🌿 🌿    🦋         🌿              │
  │    🌿    🌿 🌿    🐛  🌿     🍄           │
  │  🌿  🌿       🌿       🌿  🐺    🍄      │
  │    🌿   🌿  🌿   🦋 🌿   🌿    💀  🍄   │
  │       🌿    🌿       🌿  🌿    🍄        │
  └───────────────────────────────────────────┘
         light → leaf → mouth → soil → light
```

---

## The Four Kingdoms

**🌿 Plants** — *The patient ones.* They cannot flee. They convert starlight into staying alive. A fern at noon gains +2.5 energy/tick. The same fern at midnight bleeds -0.2. Survival is a function of dawn.

**🦋 Herbivores** — *The anxious middle.* They eat plants. They flee predators. After 15 ticks of running, exhaustion sets in — speed drops 40%. You cannot run forever. This is math, not cruelty.

**🐺 Carnivores** — *The patient hunters.* They stalk within 35px, then ambush. When full, they rest — metabolism drops, movement slows. A fed predator is a still predator. An apex hunter who doesn't conserve energy becomes compost.

**🍄 Fungi** — *The quiet reckoning.* They drift toward death at 0.4px/tick. They don't kill. They unmake what's already gone. Moisture accelerates them. In wet soil, nothing stays dead for long.

```
🌿 → sunlight → energy → reproduction → 🌿
🦋 → plants → energy → reproduction → 🦋
🐺 → herbivores → energy → reproduction → 🐺
🍄 → corpses → energy → reproduction → 🍄
              ↑                          │
              └──────────────────────────┘
              nothing is wasted
```

---

## What Emerges

We didn't code intelligence. We coded hunger, fear, sunlight, and decay. The rest grew on its own:

- **Lotka-Volterra cycles** — herbivore booms → predator booms → herbivore crashes → predator crashes. Textbook ecology from 200 lines of TypeScript.
- **Evolutionary drift** — 10% mutation rate per offspring. Fast herbivores survive longer, so speed increases across generations. We planted random. Natural selection grew direction.
- **Spatial clustering** — plants near light, herbivores near plants, carnivores near herbivores, fungi near battlefields. Nobody told them to do this.
- **Weather cascades** — a drought starves plants → herbivores starve → carnivores starve → fungi feast. One weather state topples the whole food chain like dominoes through a greenhouse.

---

## The Numbers Under the Soil

```
Day/night cycle       96 ticks = 1 full day
Tick interval         every 15 minutes (cron)
Max population        500 entities across all species

Lifespan (ticks)      Plant: 200  Herbivore: 150  Carnivore: 200  Fungus: 300
Starting energy       Plant: 50   Herbivore: 60   Carnivore: 50   Fungus: 40
Reproduction cost     Plant: 30   Herbivore: 40   Carnivore: 50   Fungus: 25

Sunlight at noon      1.0 (sine wave peak)
Sunlight at midnight  0.0 (sine wave trough)
```

---

## Architecture

Three layers of soil:

```
┌──────────────────────────────────────────────┐
│  frontend/          the window into the garden│
│  Astro 4 + Web Components + Canvas 2D        │
│  polls /api/garden every 30s                 │
├──────────────────────────────────────────────┤
│  workers/           the engine of life        │
│  Cloudflare Workers + D1 SQLite              │
│  cron tick every 15 min                      │
├──────────────────────────────────────────────┤
│  shared/            the book of laws          │
│  TypeScript types only — no runtime code     │
│  Entity, Traits, Environment, GardenState    │
└──────────────────────────────────────────────┘
```

**Tick order** — the seasons within each moment:
1. Environment shifts (weather, light, temperature)
2. Plants photosynthesize
3. Herbivores eat and flee
4. Carnivores hunt and rest
5. Fungi decompose the fallen
6. State persists to D1. History is written.

---

## Getting Started

```bash
git clone https://github.com/saadmankabir/chaos-garden.git
cd chaos-garden
npm install
npm run db:init:local    # till the soil
npm run dev              # plant the first seeds
```

Two windows. Two heartbeats:
- `localhost:4321` — the garden (what you see)
- `localhost:8787` — the engine (what you don't)

For deployment to Cloudflare, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Useful Commands

```bash
npm run type-check:all                             # inspect the roots
npm run test -w @chaos-garden/workers              # test the soil
npm run test:coverage -w @chaos-garden/workers     # how deep do the roots go
npm run deploy:workers                             # transplant to the cloud
npm run deploy:frontend                            # open the greenhouse doors
```

---

## Philosophy

The garden asks five questions:

1. **What is life?** — Anything that maintains order against entropy. These creatures do exactly that.
2. **What is evolution?** — Randomness filtered by consequences. Mutation without selection is noise. Selection without mutation is stagnation.
3. **What is an ecosystem?** — A system where every death is someone else's breakfast.
4. **What is emergence?** — When the gardener can no longer predict what the garden will do.
5. **What is a god?** — Someone who writes the physics, plants the first seed, and then has the wisdom to stop touching things.

---

> *The garden runs on Cloudflare's edge. It ticks every 15 minutes. It evolves while you sleep. It remembers every birth, every death, every meal, every mutation. You are not required. The garden continues.*
