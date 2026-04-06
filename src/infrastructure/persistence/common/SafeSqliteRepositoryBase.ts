import {
  buildSqlitePagingClause,
  type SqlitePagingClause,
} from "./SqliteQueryHelpers";

export abstract class SafeSqliteRepositoryBase {
  protected constructor(private readonly repositoryDisplayName: string) {}

  protected buildPagingClause(limit?: number, offset?: number): SqlitePagingClause {
    return buildSqlitePagingClause(limit, offset);
  }

  protected executeMutation(
    operation: string,
    mutation: () => { readonly changes: number },
  ): { readonly changes: number } {
    try {
      return mutation();
    } catch (error) {
      throw this.toPersistenceError(operation, error);
    }
  }

  protected resolveMutationTimestamp(candidate?: string): string {
    const normalized = candidate?.trim();
    return normalized && normalized.length > 0 ? normalized : new Date().toISOString();
  }

  private toPersistenceError(operation: string, error: unknown): Error {
    const details = error instanceof Error ? error.message : String(error);
    return new Error(`${this.repositoryDisplayName} persistence failed to ${operation}: ${details}`);
  }
}
