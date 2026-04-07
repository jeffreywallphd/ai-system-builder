import path from "node:path";
import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "@application/ports/interfaces/IExecutionRunRepository";
import type { IFileStorage } from "@application/ports/interfaces/IFileStorage";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";
import { freezeExecutionRunRecord } from "@application/execution/freezeExecutionRunRecord";
import { deriveExecutionRunQueryIndex, type IExecutionRunQueryIndex } from "@application/execution/ExecutionRunQueryIndex";

interface PersistedExecutionRunFile {
  readonly run: IExecutionRunRecord;
  readonly query: IExecutionRunQueryIndex;
}

export class LocalExecutionRunRepository implements IExecutionRunRepository {
  constructor(
    private readonly params: {
      readonly fileStorage: IFileStorage;
      readonly rootDirectory: string;
    },
  ) {}

  public async saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord> {
    const persisted: PersistedExecutionRunFile = Object.freeze({
      run,
      query: deriveExecutionRunQueryIndex(run),
    });
    await this.params.fileStorage.write({
      path: this.resolvePath(run.runId),
      content: JSON.stringify(persisted, null, 2),
      createDirectories: true,
      overwrite: true,
    });
    return run;
  }

  public async getRunById(runId: string): Promise<IExecutionRunRecord | undefined> {
    const filePath = this.resolvePath(runId);
    if (!(await this.params.fileStorage.exists(filePath))) {
      return undefined;
    }

    const parsed = JSON.parse(await this.params.fileStorage.readText(filePath, "utf-8")) as PersistedExecutionRunFile | IExecutionRunRecord;
    return freezeExecutionRunRecord(isPersistedExecutionRunFile(parsed) ? parsed.run : parsed);
  }

  public async listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const info = await this.params.fileStorage.stat(this.params.rootDirectory);
    if (info.kind === "missing") {
      return Object.freeze([]);
    }

    const entries = await this.params.fileStorage.list(this.params.rootDirectory, {
      recursive: false,
      includeHidden: false,
    });
    const runs: IExecutionRunRecord[] = [];
    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.path.endsWith(".json")) {
        continue;
      }

      const parsed = JSON.parse(await this.params.fileStorage.readText(entry.path, "utf-8")) as PersistedExecutionRunFile | IExecutionRunRecord;
      const run = freezeExecutionRunRecord(isPersistedExecutionRunFile(parsed) ? parsed.run : parsed);
      const query = isPersistedExecutionRunFile(parsed)
        ? parsed.query
        : deriveExecutionRunQueryIndex(run);
      if (criteria?.planId && run.planId !== criteria.planId) {
        continue;
      }
      if (criteria?.status && run.status !== criteria.status) {
        continue;
      }
      if (criteria?.executionKind && query.executionKind !== criteria.executionKind) {
        continue;
      }
      if (criteria?.unitKind && query.primaryUnitKind !== criteria.unitKind && !run.unitIds.some((unitId) => run.units[unitId]?.kind === criteria.unitKind)) {
        continue;
      }
      if (
        criteria?.provenanceClassification
        && query.primaryProvenanceClassification !== criteria.provenanceClassification
        && !run.unitIds.some((unitId) => run.units[unitId]?.provenance?.classification === criteria.provenanceClassification)
      ) {
        continue;
      }
      if (criteria?.flowId && query.executionFlowId !== criteria.flowId) {
        continue;
      }
      if (criteria?.startedAfter && run.startedAt < criteria.startedAfter) {
        continue;
      }
      if (criteria?.startedBefore && run.startedAt > criteria.startedBefore) {
        continue;
      }
      if (criteria?.updatedAfter && run.updatedAt < criteria.updatedAfter) {
        continue;
      }
      if (criteria?.updatedBefore && run.updatedAt > criteria.updatedBefore) {
        continue;
      }
      if (!matchesMetadata(run, criteria?.metadata)) {
        continue;
      }
      runs.push(run);
    }

    runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    return Object.freeze(criteria?.limit ? runs.slice(0, criteria.limit) : runs);
  }

  private resolvePath(runId: string): string {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      throw new Error("Execution run id cannot be empty.");
    }

    return path.join(this.params.rootDirectory, `${normalizedRunId}.json`);
  }
}

function matchesMetadata(
  run: IExecutionRunRecord,
  metadata?: Readonly<Record<string, string | number | boolean>>,
): boolean {
  if (!metadata) {
    return true;
  }

  return Object.entries(metadata).every(([key, value]) => run.metadata?.[key] === value);
}

function isPersistedExecutionRunFile(
  value: PersistedExecutionRunFile | IExecutionRunRecord,
): value is PersistedExecutionRunFile {
  return "run" in value && typeof value.run === "object" && value.run !== null;
}

