import {
  buildSqlitePagingClause,
  type SqlitePagingClause,
} from "./SqliteQueryHelpers";
import {
  ConsolePersistenceDiagnosticsLogger,
  type IPersistenceDiagnosticsLogger,
} from "../../logging/PersistenceDiagnosticsLogger";
import { sanitizePersistenceDiagnostics } from "../../logging/PersistenceRedaction";
import { translatePersistenceError } from "../PersistenceErrorTranslation";

export interface SafeSqliteRepositoryBaseOptions {
  readonly diagnosticsLogger?: IPersistenceDiagnosticsLogger;
}

export abstract class SafeSqliteRepositoryBase {
  private readonly diagnosticsLogger: IPersistenceDiagnosticsLogger;

  protected constructor(
    private readonly repositoryDisplayName: string,
    options: SafeSqliteRepositoryBaseOptions = {},
  ) {
    this.diagnosticsLogger = options.diagnosticsLogger ?? new ConsolePersistenceDiagnosticsLogger();
  }

  protected buildPagingClause(limit?: number, offset?: number): SqlitePagingClause {
    return buildSqlitePagingClause(limit, offset);
  }

  protected executeMutation(
    operation: string,
    mutation: () => { readonly changes: number },
    diagnostics?: Readonly<Record<string, unknown>>,
  ): { readonly changes: number } {
    try {
      return mutation();
    } catch (error) {
      const translated = translatePersistenceError({
        repository: this.repositoryDisplayName,
        operation,
        error,
        diagnostics,
      });

      const details = translated.diagnostics;
      const logEvent = Object.freeze({
        type: "persistence-diagnostic" as const,
        level: translated.retryable ? "warn" as const : "error" as const,
        repository: this.repositoryDisplayName,
        operation,
        code: translated.code,
        retryable: translated.retryable,
        occurredAt: new Date().toISOString(),
        details: details ? sanitizePersistenceDiagnostics(details) : undefined,
      });

      if (translated.retryable) {
        this.diagnosticsLogger.warn(logEvent);
      } else {
        this.diagnosticsLogger.error(logEvent);
      }

      throw translated;
    }
  }

  protected resolveMutationTimestamp(candidate?: string): string {
    const normalized = candidate?.trim();
    return normalized && normalized.length > 0 ? normalized : new Date().toISOString();
  }
}
