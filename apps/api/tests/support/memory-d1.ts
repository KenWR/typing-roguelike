import { Database } from "bun:sqlite";
import type { D1Database } from "@cloudflare/workers-types";

type D1Result<T = unknown> = {
  success: true;
  meta: {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
    last_row_id: number;
    changed_db: boolean;
    changes: number;
  };
  results: T[];
};

const result = <T>(rows: T[], changes = 0): D1Result<T> => ({
  success: true,
  meta: {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: changes > 0,
    changes,
  },
  results: rows,
});

class MemoryD1PreparedStatement {
  private values: unknown[] = [];

  public constructor(
    private readonly database: Database,
    private readonly query: string,
  ) {}

  public bind(...values: unknown[]): MemoryD1PreparedStatement {
    this.values = values;
    return this;
  }

  public first<T>(): T | null {
    return this.database.prepare(this.query).get(...(this.values as never[])) as T | null;
  }

  public all<T>(): D1Result<T> {
    const rows = this.database.prepare(this.query).all(...(this.values as never[])) as T[];
    return result(rows);
  }

  public runSync(): D1Result {
    const write = this.database.prepare(this.query).run(...(this.values as never[]));
    return result([], write.changes);
  }

  public async run(): Promise<D1Result> {
    return this.runSync();
  }
}

export class MemoryD1Database {
  private readonly database = new Database(":memory:", { strict: true });

  public constructor(schema: string) {
    this.database.exec(schema);
  }

  public prepare(query: string): MemoryD1PreparedStatement {
    return new MemoryD1PreparedStatement(this.database, query);
  }

  public async batch(statements: MemoryD1PreparedStatement[]): Promise<D1Result[]> {
    const transaction = this.database.transaction(() =>
      statements.map((statement) => statement.runSync()),
    );
    return transaction();
  }

  public query<T>(query: string): T[] {
    return this.database.prepare(query).all() as T[];
  }
}

export const asD1Database = (database: MemoryD1Database): D1Database =>
  database as unknown as D1Database;
