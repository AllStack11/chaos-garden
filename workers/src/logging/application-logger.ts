/**
 * Application Logger
 * 
 * Structured logging service for debugging and observability.
 * This factory creates logger instances bound to specific components,
 * allowing us to trace the flow of execution through the system.
 * 
 * Like the telemetry of a living organism, these logs reveal
 * the inner workings of our ecosystem without disturbing it.
 * 
 * IMPORTANT: The logging functions in this module do NOT log their own
 * database operations to prevent infinite recursion—a mirror cannot
 * reflect its own reflection.
 */

import type { ApplicationLog, LogLevel, LogComponent } from '@chaos-garden/shared';
import { logApplicationEventToDatabase } from '../db/queries';
import type { D1Database } from '../types/worker';

/**
 * Logger instance returned by the factory.
 * Bound to a specific component for contextual logging.
 */
export interface ApplicationLogger {
  debug(operation: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
  info(operation: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
  warn(operation: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
  error(operation: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
  fatal(operation: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
}

/**
 * Create a logger instance bound to a specific component.
 * This factory pattern ensures all logs are properly categorized
 * and can be filtered by their source component.
 * 
 * @param db - The D1 database instance
 * @param component - The component name (SIMULATION, DATABASE, API, etc.)
 * @param tick - Optional tick number for simulation context
 * @returns Logger instance with bound component
 * 
 * @example
 * const logger = createApplicationLogger(db, 'SIMULATION');
 * await logger.info('tick_start', 'Beginning simulation tick 42', { entityCount: 150 });
 */
export function createApplicationLogger(
  db: D1Database,
  component: LogComponent,
  tick?: number
): ApplicationLogger {
  
  /**
   * Internal function to create and persist a log entry.
   * This function does NOT log itself to prevent recursion.
   */
  async function log(
    level: LogLevel,
    operation: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const logEntry: ApplicationLog = {
      timestamp: new Date().toISOString(),
      level,
      component,
      operation,
      message,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      tick
    };

    // Persist to database—this function fails silently to prevent disruption
    await logApplicationEventToDatabase(db, logEntry);
  }

  return {
    /**
     * Debug-level logging for detailed tracing.
     * Use for: Entry/exit points, variable values, flow tracking.
     */
    debug: (operation: string, message: string, metadata?: Record<string, unknown>) =>
      log('DEBUG', operation, message, metadata),

    /**
     * Info-level logging for normal operations.
     * Use for: Successful operations, state changes, milestones.
     */
    info: (operation: string, message: string, metadata?: Record<string, unknown>) =>
      log('INFO', operation, message, metadata),

    /**
     * Warning-level logging for potential issues.
     * Use for: Recoverable errors, unusual conditions, near-limits.
     */
    warn: (operation: string, message: string, metadata?: Record<string, unknown>) =>
      log('WARN', operation, message, metadata),

    /**
     * Error-level logging for failures.
     * Use for: Operation failures, exceptions, data inconsistencies.
     */
    error: (operation: string, message: string, metadata?: Record<string, unknown>) =>
      log('ERROR', operation, message, metadata),

    /**
     * Fatal-level logging for system-critical failures.
     * Use for: Unrecoverable errors, data corruption, system halt.
     */
    fatal: (operation: string, message: string, metadata?: Record<string, unknown>) =>
      log('FATAL', operation, message, metadata)
  };
}

/**
 * Create a null logger for testing or when logging is disabled.
 * All operations are no-ops.
 */
export function createNullLogger(): ApplicationLogger {
  return {
    debug: async () => {},
    info: async () => {},
    warn: async () => {},
    error: async () => {},
    fatal: async () => {}
  };
}

/**
 * Create a console logger for development when database is unavailable.
 * Logs to console instead of database.
 */
export function createConsoleLogger(component: LogComponent, tick?: number): ApplicationLogger {
  async function log(
    level: LogLevel,
    operation: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? JSON.stringify(metadata) : '';
    
    console.log(`[${timestamp}] [${level}] [${component}] ${operation}: ${message} ${metaStr}`);
  }

  return {
    debug: (operation, message, metadata) => log('DEBUG', operation, message, metadata),
    info: (operation, message, metadata) => log('INFO', operation, message, metadata),
    warn: (operation, message, metadata) => log('WARN', operation, message, metadata),
    error: (operation, message, metadata) => log('ERROR', operation, message, metadata),
    fatal: (operation, message, metadata) => log('FATAL', operation, message, metadata)
  };
}