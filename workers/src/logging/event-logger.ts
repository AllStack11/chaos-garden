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
  Environment,
  PopulationSummary,
  SimulationEventType,
  EventSeverity
} from '@chaos-garden/shared';
import { logSimulationEventToDatabase } from '../db/queries';
import type { D1Database } from '../types/worker';
import { extractTraits } from '../simulation/environment/helpers';
import { generateAmbientNarrativeForTick } from './narrative-templates';
import {
  generateNarrativeBirthDescription,
  generateNarrativeDeathDescription,
  generateNarrativeReproductionDescription,
  generateNarrativeMutationDescription,
  generateNarrativeExtinctionDescription,
  generateNarrativePopulationExplosionDescription,
  generateNarrativeEcosystemCollapseDescription,
  generateNarrativePopulationDeltaDescription
} from './event-description-templates';

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
const ANSI_BRIGHT_YELLOW = '\x1b[93m';

function getSeverityColor(severity: EventSeverity): string {
  switch (severity) {
    case 'LOW':
      return ANSI_GREEN;
    case 'MEDIUM':
      return ANSI_CYAN;
    case 'HIGH':
      return ANSI_YELLOW;
    case 'CRITICAL':
      return ANSI_BRIGHT_RED;
  }
}

function getEventTypeColor(eventType: SimulationEventType): string {
  if (eventType.startsWith('DISASTER_')) {
    return ANSI_RED;
  }

  switch (eventType) {
    case 'BIRTH':
    case 'REPRODUCTION':
      return ANSI_GREEN;
    case 'MUTATION':
      return ANSI_MAGENTA;
    case 'DEATH':
    case 'EXTINCTION':
    case 'ECOSYSTEM_COLLAPSE':
      return ANSI_RED;
    case 'POPULATION_EXPLOSION':
      return ANSI_YELLOW;
    case 'USER_INTERVENTION':
      return ANSI_BLUE;
    case 'ENVIRONMENT_CHANGE':
      return ANSI_CYAN;
    case 'POPULATION_DELTA':
      return ANSI_BLUE;
    case 'AMBIENT':
      return ANSI_DIM;
  }

  return ANSI_RESET;
}

/**
 * Event logger instance returned by the factory.
 * Bound to a specific tick and garden state for contextual logging.
 */
export interface EventLogger {
  logBirth(entity: Entity, parentId?: string, parentName?: string): Promise<void>;
  logDeath(entity: Entity, cause: string): Promise<void>;
  logReproduction(parent: Entity, offspring: Entity): Promise<void>;
  logMutation(entity: Entity, trait: string, oldValue: number, newValue: number): Promise<void>;
  logExtinction(species: string, type: Entity['type']): Promise<void>;
  logPopulationExplosion(type: Entity['type'], count: number): Promise<void>;
  logEcosystemCollapse(remainingEntities: number): Promise<void>;
  logDisaster(type: 'FIRE' | 'FLOOD' | 'PLAGUE', description: string, affected: string[]): Promise<void>;
  logUserIntervention(action: string, description: string, affected: string[]): Promise<void>;
  logEnvironmentChange(description: string): Promise<void>;
  logCustom(eventType: SimulationEventType, description: string, entities: string[], severity: EventSeverity, tags?: string[], metadata?: Record<string, unknown>): Promise<void>;
  logAmbientNarrative(environment: Environment, populations: PopulationSummary, entities: Entity[]): Promise<void>;
}

/**
 * Create an event logger bound to a specific tick and garden state.
 * This factory ensures all events are properly timestamped and categorized.
 * 
 * @param db - The D1 database instance
 * @param tick - The current simulation tick
 * @param gardenStateId - The garden state ID for this tick
 * @returns Event logger instance
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
    tags: string[] = [],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: SimulationEvent = {
      gardenStateId,
      tick,
      timestamp: new Date().toISOString(),
      eventType,
      description,
      entitiesAffected,
      tags: [eventType.toLowerCase(), ...tags],
      severity,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    };

    await logSimulationEventToDatabase(db, event);
  }

  return {
    logBirth: async (entity, parentId, parentName) => {
      const description = generateNarrativeBirthDescription(entity, parentName);

      await logEvent(
        'BIRTH',
        description,
        [entity.id],
        'LOW',
        ['biology', entity.type, 'birth'],
        {
          type: entity.type,
          species: entity.species,
          parentId: parentId || 'origin',
          traits: extractTraits(entity)
        }
      );
    },

    logDeath: async (entity, cause) => {
      const description = generateNarrativeDeathDescription(entity, cause);

      await logEvent(
        'DEATH',
        description,
        [entity.id],
        'MEDIUM',
        ['biology', entity.type, 'death'],
        {
          type: entity.type,
          age: entity.age,
          energy: entity.energy,
          health: entity.health,
          cause
        }
      );
    },

    logReproduction: async (parent, offspring) => {
      const description = generateNarrativeReproductionDescription(parent, offspring);

      await logEvent(
        'REPRODUCTION',
        description,
        [parent.id, offspring.id],
        'LOW',
        ['biology', parent.type, 'reproduction'],
        {
          parentType: parent.type,
          offspringType: offspring.type,
          parentTraits: extractTraits(parent),
          offspringTraits: extractTraits(offspring)
        }
      );
    },

    logMutation: async (entity, trait, oldValue, newValue) => {
      const description = generateNarrativeMutationDescription(entity, trait, oldValue, newValue);
      const percentChange = ((newValue - oldValue) / oldValue * 100).toFixed(1);

      await logEvent(
        'MUTATION',
        description,
        [entity.id],
        'LOW',
        ['evolution', entity.type, 'mutation', trait],
        {
          trait,
          oldValue,
          newValue,
          percentChange: parseFloat(percentChange)
        }
      );
    },

    logExtinction: async (species, type) => {
      const description = generateNarrativeExtinctionDescription(species, type);

      await logEvent(
        'EXTINCTION',
        description,
        [],
        'CRITICAL',
        ['ecology', 'extinction', type],
        { species, type }
      );
    },

    logPopulationExplosion: async (type, count) => {
      const description = generateNarrativePopulationExplosionDescription(type, count);

      await logEvent(
        'POPULATION_EXPLOSION',
        description,
        [],
        'HIGH',
        ['ecology', 'population', type],
        { type, count, threshold: count * 0.8 }
      );
    },

    logEcosystemCollapse: async (remainingEntities) => {
      const description = generateNarrativeEcosystemCollapseDescription(remainingEntities);

      await logEvent(
        'ECOSYSTEM_COLLAPSE',
        description,
        [],
        'CRITICAL',
        ['ecology', 'collapse'],
        { remainingEntities }
      );
    },

    logDisaster: async (type, description, affected) => {
      const eventType = `DISASTER_${type}` as SimulationEventType;
      
      await logEvent(
        eventType,
        description,
        affected,
        'HIGH',
        ['chaos', 'disaster', type.toLowerCase()],
        {
          disasterType: type,
          affectedCount: affected.length
        }
      );
    },

    logUserIntervention: async (action, description, affected) => {
      await logEvent(
        'USER_INTERVENTION',
        `${action}: ${description}`,
        affected,
        'MEDIUM',
        ['intervention', action.toLowerCase()],
        {
          action,
          affectedCount: affected.length
        }
      );
    },

    logEnvironmentChange: async (description) => {
      await logEvent(
        'ENVIRONMENT_CHANGE',
        description,
        [],
        'MEDIUM',
        ['environment'],
        {}
      );
    },

    logCustom: async (eventType, description, entities, severity, tags = [], metadata) => {
      await logEvent(eventType, description, entities, severity, tags, metadata);
    },

    logAmbientNarrative: async (environment, populations, entities) => {
      const { description, tags } = generateAmbientNarrativeForTick(environment, populations, entities);
      await logEvent(
        'AMBIENT',
        description,
        [],
        'LOW',
        ['ambient', 'narrative', ...tags]
      );
    }
  };
}

/**
 * Create a console event logger for development.
 * Logs events to console.
 */
export function createConsoleEventLogger(tick: number, gardenStateId: number): EventLogger {
  void gardenStateId;

  async function logToConsole(
    eventType: SimulationEventType,
    description: string,
    entities: string[],
    severity: EventSeverity,
    tags: string[] = []
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const severityColor = getSeverityColor(severity);
    const eventColor = getEventTypeColor(eventType);
    const tickLabel = `${ANSI_BOLD}${ANSI_BRIGHT_YELLOW}[Tick ${tick}]${ANSI_RESET}`;
    const severityLabel = `${ANSI_BOLD}${severityColor}[${severity}]${ANSI_RESET}`;
    const eventLabel = `${ANSI_BOLD}${eventColor}${eventType}${ANSI_RESET}`;
    const entityCount = `${ANSI_DIM}(${entities.length} entities)${ANSI_RESET}`;
    const tagStr = tags.length > 0 ? ` ${ANSI_DIM}[Tags: ${tags.join(', ')}]${ANSI_RESET}` : '';

    console.log(`${ANSI_DIM}[${timestamp}]${ANSI_RESET} ${tickLabel} ${severityLabel} ${eventLabel}: ${description} ${entityCount}${tagStr}`);
  }

  return {
    logBirth: async (entity, parentId, parentName) => {
      const description = generateNarrativeBirthDescription(entity, parentName);
      await logToConsole('BIRTH', description, [entity.id], 'LOW', ['biology', 'birth']);
    },
    logDeath: async (entity, cause) => {
      const description = generateNarrativeDeathDescription(entity, cause);
      await logToConsole('DEATH', description, [entity.id], 'MEDIUM', ['biology', 'death']);
    },
    logReproduction: async (parent, offspring) => {
      const description = generateNarrativeReproductionDescription(parent, offspring);
      await logToConsole('REPRODUCTION', description, [parent.id, offspring.id], 'LOW', ['biology', 'reproduction']);
    },
    logMutation: async (entity, trait, oldValue, newValue) => {
      const description = generateNarrativeMutationDescription(entity, trait, oldValue, newValue);
      await logToConsole('MUTATION', description, [entity.id], 'LOW', ['evolution', 'mutation']);
    },
    logExtinction: async (species, type) => {
      const description = generateNarrativeExtinctionDescription(species, type);
      await logToConsole('EXTINCTION', description, [], 'CRITICAL', ['ecology', 'extinction']);
    },
    logPopulationExplosion: async (type, count) => {
      const description = generateNarrativePopulationExplosionDescription(type, count);
      await logToConsole('POPULATION_EXPLOSION', description, [], 'HIGH', ['ecology', 'population']);
    },
    logEcosystemCollapse: async (remaining) => {
      const description = generateNarrativeEcosystemCollapseDescription(remaining);
      await logToConsole('ECOSYSTEM_COLLAPSE', description, [], 'CRITICAL', ['ecology', 'collapse']);
    },
    logDisaster: async (type, description, affected) => {
      await logToConsole(`DISASTER_${type}` as SimulationEventType, description, affected, 'HIGH', ['chaos', 'disaster']);
    },
    logUserIntervention: async (action, description, affected) => {
      await logToConsole('USER_INTERVENTION', `${action}: ${description}`, affected, 'MEDIUM', ['intervention']);
    },
    logEnvironmentChange: async (description) => {
      await logToConsole('ENVIRONMENT_CHANGE', description, [], 'MEDIUM', ['environment']);
    },
    logCustom: async (eventType, description, entities, severity, tags) => {
      await logToConsole(eventType, description, entities, severity, tags);
    },

    logAmbientNarrative: async (environment, populations, entities) => {
      const { description, tags } = generateAmbientNarrativeForTick(environment, populations, entities);
      await logToConsole('AMBIENT', description, [], 'LOW', ['ambient', 'narrative', ...tags]);
    }
  };
}

/**
 * Create a composite event logger that delegates to multiple loggers.
 * Like a river that branches into multiple streams, nourishing different lands.
 */
export function createCompositeEventLogger(loggers: EventLogger[]): EventLogger {
  return {
    logBirth: async (entity, parentId, parentName) => {
      await Promise.all(loggers.map(l => l.logBirth(entity, parentId, parentName)));
    },
    logDeath: async (entity, cause) => {
      await Promise.all(loggers.map(l => l.logDeath(entity, cause)));
    },
    logReproduction: async (parent, offspring) => {
      await Promise.all(loggers.map(l => l.logReproduction(parent, offspring)));
    },
    logMutation: async (entity, trait, oldValue, newValue) => {
      await Promise.all(loggers.map(l => l.logMutation(entity, trait, oldValue, newValue)));
    },
    logExtinction: async (species, type) => {
      await Promise.all(loggers.map(l => l.logExtinction(species, type)));
    },
    logPopulationExplosion: async (type, count) => {
      await Promise.all(loggers.map(l => l.logPopulationExplosion(type, count)));
    },
    logEcosystemCollapse: async (remainingEntities) => {
      await Promise.all(loggers.map(l => l.logEcosystemCollapse(remainingEntities)));
    },
    logDisaster: async (type, description, affected) => {
      await Promise.all(loggers.map(l => l.logDisaster(type, description, affected)));
    },
    logUserIntervention: async (action, description, affected) => {
      await Promise.all(loggers.map(l => l.logUserIntervention(action, description, affected)));
    },
    logEnvironmentChange: async (description) => {
      await Promise.all(loggers.map(l => l.logEnvironmentChange(description)));
    },
    logCustom: async (eventType, description, entities, severity, tags, metadata) => {
      await Promise.all(loggers.map(l => l.logCustom(eventType, description, entities, severity, tags, metadata)));
    },

    logAmbientNarrative: async (environment, populations, entities) => {
      await Promise.all(loggers.map(l => l.logAmbientNarrative(environment, populations, entities)));
    }
  };
}

/**
 * Create a null event logger for testing.
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
    logCustom: async () => {},
    logAmbientNarrative: async () => {}
  };
}
