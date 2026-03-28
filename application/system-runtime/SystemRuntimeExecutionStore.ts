import type { SystemExecution } from "../../domain/system-runtime/SystemRuntimeDomain";

export interface SystemRuntimeExecutionRecord {
  readonly executionId: string;
  readonly execution: SystemExecution;
}

export interface ISystemRuntimeExecutionStore {
  saveExecution(execution: SystemExecution): void;
  getExecution(executionId: string): SystemExecution | undefined;
  listExecutionsByRoot(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): ReadonlyArray<SystemExecution>;
}

export class InMemorySystemRuntimeExecutionStore implements ISystemRuntimeExecutionStore {
  private readonly executionsById = new Map<string, SystemExecution>();

  public saveExecution(execution: SystemExecution): void {
    this.executionsById.set(execution.executionId, execution);
  }

  public getExecution(executionId: string): SystemExecution | undefined {
    return this.executionsById.get(executionId.trim());
  }

  public listExecutionsByRoot(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): ReadonlyArray<SystemExecution> {
    const normalizedAssetId = input.assetId.trim();
    if (!normalizedAssetId) {
      return Object.freeze([]);
    }

    const normalizedVersionId = input.versionId?.trim() || undefined;
    const filtered = [...this.executionsById.values()]
      .filter((execution) => execution.root.assetId === normalizedAssetId)
      .filter((execution) => !normalizedVersionId || execution.root.versionId === normalizedVersionId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

    const limit = typeof input.limit === "number" && input.limit > 0
      ? Math.floor(input.limit)
      : undefined;
    return Object.freeze((limit ? filtered.slice(0, limit) : filtered));
  }
}
