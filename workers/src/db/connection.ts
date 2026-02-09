/**
 * Database Connection Utilities
 * 
 * These utilities manage the connection to our D1 database,
 * providing type-safe access patterns and connection helpers.
 * Like roots reaching into the soil, these functions connect
 * our simulation to its persistent memory.
 */

import type { D1Database, D1Result } from '../types/worker';

/**
 * Execute a prepared statement with bound parameters.
 * This is the safest way to query—parameters are bound,
 * preventing any corruption of the data.
 * 
 * @param db - The D1 database instance
 * @param query - SQL query with ? placeholders
 * @param params - Parameters to bind to the query
 * @returns Query result with type safety
 */
export async function executeQuery<T>(
  db: D1Database,
  query: string,
  params: unknown[] = []
): Promise<D1Result<T>> {
  const statement = db.prepare(query);
  const boundStatement = statement.bind(...params);
  return boundStatement.run<T>();
}

/**
 * Execute a query and return all results.
 * Like gathering all leaves from a branch.
 * 
 * @param db - The D1 database instance
 * @param query - SQL query with ? placeholders
 * @param params - Parameters to bind to the query
 * @returns Array of results
 */
export async function queryAll<T>(
  db: D1Database,
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const statement = db.prepare(query);
  const boundStatement = statement.bind(...params);
  const result = await boundStatement.all<T>();
  return result.results || [];
}

/**
 * Execute a query and return the first result.
 * Like plucking the first fruit from a tree.
 * 
 * @param db - The D1 database instance
 * @param query - SQL query with ? placeholders
 * @param params - Parameters to bind to the query
 * @returns First result or null if none found
 */
export async function queryFirst<T>(
  db: D1Database,
  query: string,
  params: unknown[] = []
): Promise<T | null> {
  const statement = db.prepare(query);
  const boundStatement = statement.bind(...params);
  return boundStatement.first<T>();
}

/**
 * Execute multiple statements in a batch.
 * Atomic operations ensure data consistency—
 * like a single heartbeat, all or nothing.
 * 
 * @param db - The D1 database instance
 * @param statements - Array of prepared statements
 * @returns Array of results
 */
export async function executeBatch<T>(
  db: D1Database,
  statements: { query: string; params: unknown[] }[]
): Promise<T[]> {
  const preparedStatements = statements.map(({ query, params }) => {
    const stmt = db.prepare(query);
    return stmt.bind(...params);
  });
  
  return db.batch<T>(preparedStatements);
}

/**
 * Execute a callback within a database transaction.
 * All operations succeed or fail as one unit.
 */
export async function runInTransaction<T>(
  db: D1Database,
  operation: () => Promise<T>
): Promise<T> {
  await db.exec('BEGIN IMMEDIATE');
  try {
    const result = await operation();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Execute a raw SQL command (for migrations and schema changes).
 * Use with caution—this bypasses parameter binding.
 * 
 * @param db - The D1 database instance
 * @param query - Raw SQL query
 * @returns Execution result
 */
export async function executeRaw(
  db: D1Database,
  query: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.exec(query);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check database connectivity by running a simple query.
 * Like testing the pulse of a living system.
 * 
 * @param db - The D1 database instance
 * @returns True if connected, false otherwise
 */
export async function isDatabaseConnected(db: D1Database): Promise<boolean> {
  try {
    const result = await queryFirst<{ value: number }>(db, 'SELECT 1 as value');
    return result?.value === 1;
  } catch {
    return false;
  }
}

/**
 * Get the current timestamp from the database.
 * Useful for ensuring consistent time across operations.
 * 
 * @param db - The D1 database instance
 * @returns ISO timestamp string
 */
export async function getDatabaseTimestamp(db: D1Database): Promise<string> {
  const result = await queryFirst<{ timestamp: string }>(
    db,
    "SELECT datetime('now') as timestamp"
  );
  return result?.timestamp || new Date().toISOString();
}
