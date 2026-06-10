import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maybeSpawnWildCarnivore } from '../../../../src/simulation/tick/tickHelpers/maybeSpawnWildCarnivore';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';
import { createFakeApplicationLogger } from '../../../helpers/fake-application-logger';

describe('simulation/tick/maybeSpawnWildCarnivore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when carnivores are still alive', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await maybeSpawnWildCarnivore(
      1, 2, 10,
      createFakeEventLogger(),
      createFakeApplicationLogger()
    );

    expect(result).toBeNull();
  });

  it('returns null when herbivore population is below minimum', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await maybeSpawnWildCarnivore(
      1, 0, 4,
      createFakeEventLogger(),
      createFakeApplicationLogger()
    );

    expect(result).toBeNull();
  });

  it('returns null when random event does not fire', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = await maybeSpawnWildCarnivore(
      1, 0, 10,
      createFakeEventLogger(),
      createFakeApplicationLogger()
    );

    expect(result).toBeNull();
  });

  it('spawns a carnivore when extinct, enough herbivores, and random fires', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await maybeSpawnWildCarnivore(
      1, 0, 10,
      createFakeEventLogger(),
      createFakeApplicationLogger()
    );

    expect(result).not.toBeNull();
    expect(result?.type).toBe('carnivore');
    expect(result?.isAlive).toBe(true);
    expect(result?.gardenStateId).toBe(1);
  });

  it('logs birth and info when spawning', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const eventLogger = createFakeEventLogger();
    const appLogger = createFakeApplicationLogger();

    await maybeSpawnWildCarnivore(1, 0, 10, eventLogger, appLogger);

    expect(eventLogger.logBirth).toHaveBeenCalledTimes(1);
    expect(appLogger.info).toHaveBeenCalledWith(
      'wild_carnivore_spawn',
      expect.any(String),
      expect.objectContaining({ positionX: expect.any(Number), positionY: expect.any(Number) })
    );
  });

  it('returns null when herbivores exactly at minimum minus one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await maybeSpawnWildCarnivore(
      1, 0, 4,
      createFakeEventLogger(),
      createFakeApplicationLogger()
    );

    expect(result).toBeNull();
  });

  it('allows spawn when herbivores exactly meet the minimum', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await maybeSpawnWildCarnivore(
      1, 0, 5,
      createFakeEventLogger(),
      createFakeApplicationLogger()
    );

    expect(result).not.toBeNull();
  });
});
