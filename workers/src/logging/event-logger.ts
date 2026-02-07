/**
 * Event Logger
 * 
 * Narrative logging service for simulation events.
 * This factory creates event loggers bound to specific ticks,
 * recording the epic story of life, death, and transformation
 * in our digital ecosystem.
 * 
 * Unlike application logs (which trace system execution),
 * these events tell the story from the entities' perspective—
 * births, deaths, reproductions, mutations, disasters, and more.
 */

import type { 
  SimulationEvent, 
  Entity, 
  SimulationEventType, 
  EventSeverity 
} from '@chaos-garden/shared';
import { logSimulationEventToDatabase } from '../db/queries';
import type { D1Database } from '../types/worker';
import { extractTraits } from '../simulation/environment/helpers';

/**
 * Event logger instance returned by the factory.
 * Bound to a specific tick and garden state for contextual logging.
 */
export interface EventLogger {
  logBirth(entity: Entity, parentId?: string): Promise<void>;
  logDeath(entity: Entity, cause: string): Promise<void>;
  logReproduction(parent: Entity, offspring: Entity): Promise<void>;
  logMutation(entity: Entity, trait: string, oldValue: number, newValue: number): Promise<void>;
  logExtinction(species: string, type: Entity['type']): Promise<void>;
  logPopulationExplosion(type: Entity['type'], count: number): Promise<void>;
  logEcosystemCollapse(remainingEntities: number): Promise<void>;
  logDisaster(type: 'FIRE' | 'FLOOD' | 'PLAGUE', description: string, affected: string[]): Promise<void>;
  logUserIntervention(action: string, description: string, affected: string[]): Promise<void>;
  logEnvironmentChange(description: string): Promise<void>;
  logCustom(eventType: SimulationEventType, description: string, entities: string[], severity: EventSeverity, metadata?: Record<string, unknown>): Promise<void>;
}

/**
 * Create an event logger bound to a specific tick and garden state.
 * This factory ensures all events are properly timestamped and categorized.
 * 
 * @param db - The D1 database instance
 * @param tick - The current simulation tick
 * @param gardenStateId - The garden state ID for this tick
 * @returns Event logger instance
 * 
 * @example
 * const eventLogger = createEventLogger(db, 42, 5);
 * await eventLogger.logBirth(newPlant, parentPlant.id);
 */
export function createEventLogger(
  db: D1Database,
  tick: number,
  gardenStateId: number
): EventLogger {
  
  /**
   * Internal function to create and persist an event.
   */
  async function logEvent(
    eventType: SimulationEventType,
    description: string,
    entitiesAffected: string[],
    severity: EventSeverity,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: SimulationEvent = {
      gardenStateId,
      tick,
      timestamp: new Date().toISOString(),
      eventType,
      description,
      entitiesAffected,
      severity,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    };

    await logSimulationEventToDatabase(db, event);
  }

  return {
    /**
     * Log the birth of a new entity.
     * A new life enters the garden!
     */
    logBirth: async (entity: Entity, parentId?: string): Promise<void> => {
      const description = parentId 
        ? `A new ${entity.species} is born from parent ${parentId.substring(0, 8)}`
        : `A new ${entity.species} springs into existence`;
      
      await logEvent(
        'BIRTH',
        description,
        [entity.id],
        'LOW',
        { 
          type: entity.type,
          species: entity.species,
          parentId: parentId || 'origin',
          traits: extractTraits(entity)
        }
      );
    },

    /**
     * Log the death of an entity.
     * The cycle of life continues.
     */
    logDeath: async (entity: Entity, cause: string): Promise<void> => {
      await logEvent(
        'DEATH',
        `${entity.species} has died: ${cause}`,
        [entity.id],
        'MEDIUM',
        {
          type: entity.type,
          age: entity.age,
          energy: entity.energy,
          health: entity.health,
          cause
        }
      );
    },

    /**
     * Log successful reproduction.
     * Life finds a way to continue.
     */
    logReproduction: async (parent: Entity, offspring: Entity): Promise<void> => {
      await logEvent(
        'REPRODUCTION',
        `${parent.species} has reproduced, creating ${offspring.species}`,
        [parent.id, offspring.id],
        'LOW',
        {
          parentType: parent.type,
          offspringType: offspring.type,
          parentTraits: extractTraits(parent),
          offspringTraits: extractTraits(offspring)
        }
      );
    },

    /**
     * Log a genetic mutation.
     * Evolution in action—traits shift across generations.
     */
    logMutation: async (
      entity: Entity, 
      trait: string, 
      oldValue: number, 
      newValue: number
    ): Promise<void> => {
      const percentChange = ((newValue - oldValue) / oldValue * 100).toFixed(1);
      
      await logEvent(
        'MUTATION',
        `${entity.species} shows a ${percentChange}% change in ${trait}`,
        [entity.id],
        'LOW',
        {
          trait,
          oldValue,
          newValue,
          percentChange: parseFloat(percentChange)
        }
      );
    },

    /**
     * Log the extinction of a species.
     * A somber moment—the last of its kind has perished.
     */
    logExtinction: async (species: string, type: Entity['type']): Promise<void> => {
      await logEvent(
        'EXTINCTION',
        `The ${species} (${type}) have gone extinct from the garden`,
        [],
        'CRITICAL',
        { species, type }
      );
    },

    /**
     * Log a population explosion.
     * When conditions are perfect, life proliferates rapidly.
     */
    logPopulationExplosion: async (type: Entity['type'], count: number): Promise<void> => {
      await logEvent(
        'POPULATION_EXPLOSION',
        `${type} population has exploded to ${count} individuals!`,
        [],
        'HIGH',
        { type, count, threshold: count * 0.8 } // explosion threshold
      );
    },

    /**
     * Log ecosystem collapse.
     * A critical moment—the garden nearly empties.
     */
    logEcosystemCollapse: async (remainingEntities: number): Promise<void> => {
      await logEvent(
        'ECOSYSTEM_COLLAPSE',
        `Ecosystem collapse! Only ${remainingEntities} entities remain alive`,
        [],
        'CRITICAL',
        { remainingEntities }
      );
    },

    /**
     * Log a natural disaster.
     * The chaos that creates new opportunities for life.
     */
    logDisaster: async (
      type: 'FIRE' | 'FLOOD' | 'PLAGUE',
      description: string,
      affected: string[]
    ): Promise<void> => {
      const eventType = `DISASTER_${type}` as SimulationEventType;
      
      await logEvent(
        eventType,
        description,
        affected,
        'HIGH',
        {
          disasterType: type,
          affectedCount: affected.length
        }
      );
    },

    /**
     * Log user intervention.
     * The gardener-god has acted upon the world.
     */
    logUserIntervention: async (
      action: string,
      description: string,
      affected: string[]
    ): Promise<void> => {
      await logEvent(
        'USER_INTERVENTION',
        `${action}: ${description}`,
        affected,
        'MEDIUM',
        {
          action,
          affectedCount: affected.length
        }
      );
    },

    /**
     * Log significant environmental changes.
     * The world itself shifts and transforms.
     */
    logEnvironmentChange: async (description: string): Promise<void> => {
      await logEvent(
        'ENVIRONMENT_CHANGE',
        description,
        [],
        'MEDIUM',
        {}
      );
    },

    /**
     * Log a custom event.
     * For events that don't fit the standard categories.
     */
    logCustom: async (
      eventType: SimulationEventType,
      description: string,
      entities: string[],
      severity: EventSeverity,
      metadata?: Record<string, unknown>
    ): Promise<void> => {
      await logEvent(eventType, description, entities, severity, metadata);
    }
  };
}

/**
 * Create a null event logger for testing.
 * All operations are no-ops but still return promises.
 */
export function createNullEventLogger(): EventLogger {
  return {
    logBirth: async () => {},
    logDeath: async () => {},
    logReproduction: async () => {},
    logMutation: async () => {},
    logExtinction: async () => {},
    logPopulationExplosion: async () => {},
    logEcosystemCollapse: async () => {},
    logDisaster: async () => {},
    logUserIntervention: async () => {},
    logEnvironmentChange: async () => {},
    logCustom: async () => {}
  };
}

/**
 * Create a console event logger for development.
 * Logs events to console instead of database.
 */
export function createConsoleEventLogger(tick: number, gardenStateId: number): EventLogger {
  async function logToConsole(
    eventType: SimulationEventType,
    description: string,
    entities: string[],
    severity: EventSeverity
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Tick ${tick}] [${severity}] ${eventType}: ${description} (${entities.length} entities)`);
  }

  return {
    logBirth: async (entity, parentId) => {
      const desc = parentId 
        ? `A new ${entity.species} is born from parent ${parentId.substring(0, 8)}`
        : `A new ${entity.species} springs into existence`;
      await logToConsole('BIRTH', desc, [entity.id], 'LOW');
    },
    logDeath: async (entity, cause) => {
      await logToConsole('DEATH', `${entity.species} has died: ${cause}`, [entity.id], 'MEDIUM');
    },
    logReproduction: async (parent, offspring) => {
      await logToConsole('REPRODUCTION', `${parent.species} has reproduced`, [parent.id, offspring.id], 'LOW');
    },
    logMutation: async (entity, trait, oldValue, newValue) => {
      const percent = ((newValue - oldValue) / oldValue * 100).toFixed(1);
      await logToConsole('MUTATION', `${entity.species} shows ${percent}% change in ${trait}`, [entity.id], 'LOW');
    },
    logExtinction: async (species, type) => {
      await logToConsole('EXTINCTION', `The ${species} (${type}) have gone extinct`, [], 'CRITICAL');
    },
    logPopulationExplosion: async (type, count) => {
      await logToConsole('POPULATION_EXPLOSION', `${type} population exploded to ${count}`, [], 'HIGH');
    },
    logEcosystemCollapse: async (remaining) => {
      await logToConsole('ECOSYSTEM_COLLAPSE', `Only ${remaining} entities remain`, [], 'CRITICAL');
    },
    logDisaster: async (type, description, affected) => {
      await logToConsole(`DISASTER_${type}` as SimulationEventType, description, affected, 'HIGH');
    },
    logUserIntervention: async (action, description, affected) => {
      await logToConsole('USER_INTERVENTION', `${action}: ${description}`, affected, 'MEDIUM');
    },
    logEnvironmentChange: async (description) => {
      await logToConsole('ENVIRONMENT_CHANGE', description, [], 'MEDIUM');
    },
    logCustom: async (eventType, description, entities, severity) => {
      await logToConsole(eventType, description, entities, severity);
    }
  };
}