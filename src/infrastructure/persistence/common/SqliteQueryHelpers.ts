import { normalizePersistenceLookup } from "./PersistenceMapperUtilities";

export interface SqlitePagingClause {
  readonly sql: string;
  readonly params: ReadonlyArray<number>;
}

export function buildSqlitePagingClause(limit?: number, offset?: number): SqlitePagingClause {
  const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
  const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : undefined;

  if (normalizedLimit !== undefined && normalizedOffset !== undefined) {
    return Object.freeze({
      sql: "LIMIT ? OFFSET ?",
      params: Object.freeze([normalizedLimit, normalizedOffset]),
    });
  }

  if (normalizedLimit !== undefined) {
    return Object.freeze({
      sql: "LIMIT ?",
      params: Object.freeze([normalizedLimit]),
    });
  }

  if (normalizedOffset !== undefined) {
    return Object.freeze({
      sql: "LIMIT -1 OFFSET ?",
      params: Object.freeze([normalizedOffset]),
    });
  }

  return Object.freeze({
    sql: "",
    params: Object.freeze([]),
  });
}

export interface SqliteWhereClause {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
}

export class SqliteWhereBuilder {
  private readonly clauses: string[] = [];
  private readonly params: unknown[] = [];

  public add(clause: string, ...params: ReadonlyArray<unknown>): this {
    const normalized = clause.trim();
    if (normalized.length === 0) {
      return this;
    }

    this.clauses.push(normalized);
    if (params.length > 0) {
      this.params.push(...params);
    }
    return this;
  }

  public addEquals(column: string, value: string | null | undefined): this {
    const normalized = normalizePersistenceLookup(value);
    if (!normalized) {
      return this;
    }

    return this.add(`${column} = ?`, normalized);
  }

  public addIn<TValue>(column: string, values: ReadonlyArray<TValue> | null | undefined): this {
    if (!values || values.length === 0) {
      return this;
    }

    return this.add(
      `${column} IN (${values.map(() => "?").join(", ")})`,
      ...(values as ReadonlyArray<unknown>),
    );
  }

  public build(): SqliteWhereClause {
    return Object.freeze({
      sql: this.clauses.length > 0 ? `WHERE ${this.clauses.join(" AND ")}` : "",
      params: Object.freeze([...this.params]),
    });
  }
}

export function createSqliteWhereBuilder(): SqliteWhereBuilder {
  return new SqliteWhereBuilder();
}
