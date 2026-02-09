import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnection = vi.hoisted(() => ({
  executeQuery: vi.fn(),
  queryFirst: vi.fn()
}));

vi.mock('../../../src/db/connection', () => mockConnection);

import {
  getLastCompletedTick,
  releaseSimulationLock,
  setLastCompletedTick,
  tryAcquireSimulationLock
} from '../../../src/db/simulation-control';

describe('db/simulation-control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock when control row can be updated', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, meta: { changes: 1 } });

    const acquired = await tryAcquireSimulationLock({} as any, 'owner-1', 1000, 2000);

    expect(acquired).toBe(true);
    expect(mockConnection.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('does not acquire lock when update changes zero rows', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, meta: { changes: 0 } });

    const acquired = await tryAcquireSimulationLock({} as any, 'owner-1', 1000, 2000);

    expect(acquired).toBe(false);
  });

  it('releases lock with owner guard', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, meta: { changes: 1 } });

    await releaseSimulationLock({} as any, 'owner-1');

    const query = mockConnection.executeQuery.mock.calls[0][1] as string;
    expect(query).toContain('WHERE id = 1 AND lock_owner = ?');
    expect(mockConnection.executeQuery.mock.calls[0][2]).toEqual(['owner-1']);
  });

  it('returns persisted last completed tick', async () => {
    mockConnection.queryFirst.mockResolvedValue({ last_completed_tick: 12 });

    const tick = await getLastCompletedTick({} as any);

    expect(tick).toBe(12);
  });

  it('falls back to zero when control row is missing', async () => {
    mockConnection.queryFirst.mockResolvedValue(null);

    const tick = await getLastCompletedTick({} as any);

    expect(tick).toBe(0);
  });

  it('updates last completed tick', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, meta: { changes: 1 } });

    await setLastCompletedTick({} as any, 5);

    expect(mockConnection.executeQuery).toHaveBeenCalledTimes(1);
    expect(mockConnection.executeQuery.mock.calls[0][2]).toEqual([5]);
  });
});
