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
 * Application logs are console-only and are not persisted to D1.
 */

import type { LogLevel, LogComponent } from '@chaos-garden/shared';
import type { D1Database } from '../types/worker';

const ANSI_RESET = '\x1b[0m';
const ANSI_DIM = '\x1b[2m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_BLUE = '\x1b[34m';
const ANSI_MAGENTA = '\x1b[35m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_BRIGHT_RED = '\x1b[91m';

function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'DEBUG':
      return ANSI_CYAN;
    case 'INFO':
      return ANSI_GREEN;
    case 'WARN':
      return ANSI_YELLOW;
    case 'ERROR':
      return ANSI_RED;
    case 'FATAL':
      return ANSI_BRIGHT_RED;
  }
}

function getComponentColor(component: LogComponent): string {
  switch (component) {
    case 'SIMULATION':
      return ANSI_MAGENTA;
    case 'DATABASE':
      return ANSI_BLUE;
    case 'API':
      return ANSI_CYAN;
    case 'ENTITY':
      return ANSI_GREEN;
    case 'ENVIRONMENT':
      return ANSI_YELLOW;
    case 'LOGGING':
      return ANSI_BLUE;
    case 'SYSTEM':
      return ANSI_RED;
  }
}

function shouldUseAnsiColors(): boolean {
  if (typeof process === 'undefined') return true;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  if (process.env.TERM === 'dumb') return false;
  return true;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50
};

function shouldEmitLog(level: LogLevel, minimumLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minimumLevel];
}

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
  _db: D1Database,
  component: LogComponent,
  tick?: number,
  _mirrorToConsole: boolean = false
): ApplicationLogger {
  const minimumLogLevel: LogLevel = 'INFO';
  
  /**
   * Internal function to create and emit a log entry.
   */
  async function log(
    level: LogLevel,
    operation: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!shouldEmitLog(level, minimumLogLevel)) {
      return;
    }

    const ts = new Date().toISOString();
    const tickLabel = typeof tick === 'number' ? `[Tick ${tick}]` : '';
    const meta = metadata ? JSON.stringify(metadata) : '';

    if (shouldUseAnsiColors()) {
      const levelColor = getLevelColor(level);
      const componentColor = getComponentColor(component);
      const tsLabel = `${ANSI_DIM}[${ts}]${ANSI_RESET}`;
      const levelLabel = `${ANSI_BOLD}${levelColor}[${level}]${ANSI_RESET}`;
      const componentLabel = `${ANSI_BOLD}${componentColor}[${component}]${ANSI_RESET}`;
      const tickDisplay = tickLabel ? ` ${ANSI_DIM}${tickLabel}${ANSI_RESET}` : '';
      const metaDisplay = meta ? ` ${ANSI_DIM}${meta}${ANSI_RESET}` : '';

      console.log(`${tsLabel} ${levelLabel} ${componentLabel}${tickDisplay} ${operation}: ${message}${metaDisplay}`);
      return;
    }

    const plainTickDisplay = tickLabel ? ` ${tickLabel}` : '';
    const plainMetaDisplay = meta ? ` ${meta}` : '';
    console.log(`[${ts}] [${level}] [${component}]${plainTickDisplay} ${operation}: ${message}${plainMetaDisplay}`);
  }

  return {
    /**
     * Debug-level logging for detailed tracing.
     * Use for: Entry/exit points, variable values, flow tracking.
     */
    debug: async (operation: string, message: string, metadata?: Record<string, unknown>) =>
      await log('DEBUG', operation, message, metadata),

    /**
     * Info-level logging for normal operations.
     * Use for: Successful operations, state changes, milestones.
     */
    info: async (operation: string, message: string, metadata?: Record<string, unknown>) =>
      await log('INFO', operation, message, metadata),

    /**
     * Warning-level logging for potential issues.
     * Use for: Recoverable errors, unusual conditions, near-limits.
     */
    warn: async (operation: string, message: string, metadata?: Record<string, unknown>) =>
      await log('WARN', operation, message, metadata),

    /**
     * Error-level logging for failures.
     * Use for: Operation failures, exceptions, data inconsistencies.
     */
    error: async (operation: string, message: string, metadata?: Record<string, unknown>) =>
      await log('ERROR', operation, message, metadata),

    /**
     * Fatal-level logging for system-critical failures.
     * Use for: Unrecoverable errors, data corruption, system halt.
     */
    fatal: async (operation: string, message: string, metadata?: Record<string, unknown>) =>
      await log('FATAL', operation, message, metadata)
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
  const minimumLogLevel: LogLevel = 'INFO';

  async function log(
    level: LogLevel,
    operation: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!shouldEmitLog(level, minimumLogLevel)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const meta = metadata ? JSON.stringify(metadata) : '';

    if (shouldUseAnsiColors()) {
      const levelColor = getLevelColor(level);
      const componentColor = getComponentColor(component);
      const tsLabel = `${ANSI_DIM}[${timestamp}]${ANSI_RESET}`;
      const levelLabel = `${ANSI_BOLD}${levelColor}[${level}]${ANSI_RESET}`;
      const componentLabel = `${ANSI_BOLD}${componentColor}[${component}]${ANSI_RESET}`;
      const tickLabel = typeof tick === 'number' ? ` ${ANSI_DIM}[Tick ${tick}]${ANSI_RESET}` : '';
      const metaDisplay = meta ? ` ${ANSI_DIM}${meta}${ANSI_RESET}` : '';

      console.log(`${tsLabel} ${levelLabel} ${componentLabel}${tickLabel} ${operation}: ${message}${metaDisplay}`);
      return;
    }

    const tickLabel = typeof tick === 'number' ? ` [Tick ${tick}]` : '';
    const metaDisplay = meta ? ` ${meta}` : '';
    console.log(`[${timestamp}] [${level}] [${component}]${tickLabel} ${operation}: ${message}${metaDisplay}`);
  }

  return {
    debug: (operation, message, metadata) => log('DEBUG', operation, message, metadata),
    info: (operation, message, metadata) => log('INFO', operation, message, metadata),
    warn: (operation, message, metadata) => log('WARN', operation, message, metadata),
    error: (operation, message, metadata) => log('ERROR', operation, message, metadata),
    fatal: (operation, message, metadata) => log('FATAL', operation, message, metadata)
  };
}
