import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import type { D1Database } from "../../../src/types/worker";
import { migrateToV2_0_0 } from "../../../src/db/migrations";

describe("Database Migration v2.0.0 (Phase 4 Canonical Backend)", () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response(null); } }",
      d1Databases: ["DB"],
    });
    db = (await mf.getD1Database("DB")) as unknown as D1Database;
  });

  afterAll(async () => {
    if (mf) {
      await mf.dispose();
    }
  });

  it("successfully migrates v1.9.0 database to v2.0.0 and seeds canonical anchor from existing checkpoint", async () => {
    // 1. Setup minimal v1.9.0 tables
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS system_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );`,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO system_metadata (key, value) VALUES ('schema_version', '1.9.0');`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS engine_checkpoints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tick INTEGER NOT NULL UNIQUE,
          engine_version INTEGER NOT NULL DEFAULT 1,
          seed INTEGER NOT NULL DEFAULT 42,
          checksum TEXT NOT NULL,
          payload BLOB NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );`,
      )
      .run();

    // Insert an existing checkpoint representing the canonical tip under v1.9.0
    await db
      .prepare(
        `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
         VALUES (150, 2, 42, 'sha256-existing-checkpoint', X'01020304')`,
      )
      .run();

    // 2. Run migration to v2.0.0
    await migrateToV2_0_0(db);

    // 3. Verify schema version bumped to 2.0.0
    const meta = await db
      .prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'")
      .first<{ value: string }>();
    expect(meta?.value).toBe("2.0.0");

    // 4. Verify canonical anchor seeded from tick 150
    const anchor = await db
      .prepare("SELECT * FROM canonical_anchor WHERE id = 1")
      .first<{
        id: number;
        checkpoint_id: number;
        canonical_tick: number;
        checksum: string;
        updated_at_ms: number;
      }>();
    expect(anchor).toBeDefined();
    expect(anchor?.id).toBe(1);
    expect(anchor?.canonical_tick).toBe(150);
    expect(anchor?.checksum).toBe("sha256-existing-checkpoint");
    expect(anchor?.checkpoint_id).toBe(1);

    // 5. Verify chronicle_events table exists and functions
    const chronicleInsert = await db
      .prepare(
        `INSERT INTO chronicle_events (id, canonical_tick, occurred_at, type, severity, description, tags_json, checksum, created_at_ms)
         VALUES ('evt-1', 150, datetime('now'), 'MILESTONE', 'LOW', 'Migration test', '[]', 'chk-1', 12345)`,
      )
      .run();
    expect(chronicleInsert.success).toBe(true);

    // 6. Verify api_metric_buckets table exists and functions
    const bucketInsert = await db
      .prepare(
        `INSERT INTO api_metric_buckets (bucket_start_ms, garden_reads, checkpoint_commits, rejected_writes, server_errors)
         VALUES (1000000, 5, 1, 0, 0)`,
      )
      .run();
    expect(bucketInsert.success).toBe(true);
  });
});
