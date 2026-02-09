import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from '../../src/types/worker';

interface PreparedResponse {
  firstResult?: unknown;
  allResult?: unknown[];
  runResult?: D1Result<unknown>;
  rawResult?: unknown[];
}

class FakePreparedStatement implements D1PreparedStatement {
  public boundParams: unknown[] = [];

  constructor(private readonly response: PreparedResponse = {}) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.boundParams = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.response.firstResult as T) ?? null;
  }

  async run<T>(): Promise<D1Result<T>> {
    return (this.response.runResult as D1Result<T>) ?? { success: true, results: [] };
  }

  async all<T>(): Promise<D1Result<T>> {
    return { success: true, results: (this.response.allResult as T[]) ?? [] };
  }

  async raw<T>(): Promise<T[]> {
    return (this.response.rawResult as T[]) ?? [];
  }
}

export class FakeD1Database implements D1Database {
  public lastQuery = '';
  public lastPreparedStatement: FakePreparedStatement | null = null;
  public executedQueries: string[] = [];

  constructor(private readonly response: PreparedResponse = {}) {}

  prepare(query: string): D1PreparedStatement {
    this.lastQuery = query;
    this.lastPreparedStatement = new FakePreparedStatement(this.response);
    return this.lastPreparedStatement;
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<T[]> {
    return statements as T[];
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.executedQueries.push(query);
    return { count: 1, duration: 0 };
  }
}
