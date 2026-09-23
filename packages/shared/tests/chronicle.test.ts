import { describe, it, expect } from "vitest";
import {
  validateChronicleEvent,
  computeChronicleEventChecksum,
  MAX_CHRONICLE_DESCRIPTION_BYTES,
  MAX_CHRONICLE_TYPE_LENGTH,
  MAX_CHRONICLE_TAGS_COUNT,
  MAX_CHRONICLE_TAG_LENGTH,
} from "../src/index.js";

describe("Chronicle Event Hashing & Validation (Phase 4 Shared)", () => {
  it("validates a correct chronicle event", () => {
    const valid = validateChronicleEvent({
      tick: 150,
      occurredAt: "2026-09-22T20:00:00.000Z",
      type: "EXTINCTION",
      severity: "HIGH",
      description: "The last apex predator in sector 4 expired.",
      tags: ["carnivore", "extinction"],
    });

    expect(valid.valid).toBe(true);
    expect(valid.error).toBeUndefined();
  });

  it("rejects an event with negative or non-integer tick", () => {
    expect(
      validateChronicleEvent({
        tick: -1,
        type: "BIRTH",
        severity: "LOW",
        description: "A new organism was born.",
      }).valid,
    ).toBe(false);

    expect(
      validateChronicleEvent({
        tick: 12.5,
        type: "BIRTH",
        severity: "LOW",
        description: "A new organism was born.",
      }).valid,
    ).toBe(false);
  });

  it("rejects an invalid severity level", () => {
    const res = validateChronicleEvent({
      tick: 10,
      type: "DISASTER",
      severity: "CATASTROPHIC" as any,
      description: "Disaster event",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("severity");
  });

  it("enforces string length and byte bounds", () => {
    // Type too long
    const longType = "A".repeat(MAX_CHRONICLE_TYPE_LENGTH + 1);
    expect(
      validateChronicleEvent({
        tick: 10,
        type: longType,
        severity: "LOW",
        description: "Valid description",
      }).valid,
    ).toBe(false);

    // Description exceeding 512 UTF-8 bytes
    const longDesc = "€".repeat(180); // 180 * 3 bytes = 540 bytes > 512
    expect(
      validateChronicleEvent({
        tick: 10,
        type: "DISASTER",
        severity: "CRITICAL",
        description: longDesc,
      }).valid,
    ).toBe(false);

    // Tag too long
    expect(
      validateChronicleEvent({
        tick: 10,
        type: "AMBIENT",
        severity: "LOW",
        description: "Valid description",
        tags: ["A".repeat(MAX_CHRONICLE_TAG_LENGTH + 1)],
      }).valid,
    ).toBe(false);

    // Too many tags
    const excessTags = Array.from(
      { length: MAX_CHRONICLE_TAGS_COUNT + 1 },
      (_, i) => `tag${i}`,
    );
    expect(
      validateChronicleEvent({
        tick: 10,
        type: "AMBIENT",
        severity: "LOW",
        description: "Valid description",
        tags: excessTags,
      }).valid,
    ).toBe(false);
  });

  it("computes deterministic SHA-256 checksum invariant under tag ordering", async () => {
    const event1 = {
      canonicalTick: 500,
      occurredAt: "2026-09-22T20:00:00.000Z",
      type: "MUTATION",
      severity: "MEDIUM",
      description: "Herbivore adapted increased camouflage.",
      tags: ["herbivore", "adaptation", "genetics"],
    };

    const event2 = {
      canonicalTick: 500,
      occurredAt: "2026-09-22T20:00:00.000Z",
      type: "MUTATION",
      severity: "MEDIUM",
      description: "Herbivore adapted increased camouflage.",
      tags: ["genetics", "adaptation", "herbivore"], // Reversed tag order
    };

    const hash1 = await computeChronicleEventChecksum(event1);
    const hash2 = await computeChronicleEventChecksum(event2);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});
