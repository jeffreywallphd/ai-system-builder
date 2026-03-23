import path from "node:path";
import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "../../../application/ports/interfaces/IExecutionRunRepository";
import type { IFileStorage } from "../../../application/ports/interfaces/IFileStorage";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import { freezeExecutionRunRecord } from "../../../application/execution/freezeExecutionRunRecord";

export class LocalExecutionRunRepository implements IExecutionRunRepository {
  constructor(
    private readonly params: {
      readonly fileStorage: IFileStorage;
      readonly rootDirectory: string;
    },
  ) {}

  public async saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord> {
    await this.params.fileStorage.write({
      path: this.resolvePath(run.runId),
      content: JSON.stringify(run, null, 2),
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

    return freezeExecutionRunRecord(JSON.parse(await this.params.fileStorage.readText(filePath, "utf-8")) as IExecutionRunRecord);
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

      const run = freezeExecutionRunRecord(JSON.parse(await this.params.fileStorage.readText(entry.path, "utf-8")) as IExecutionRunRecord);
      if (criteria?.planId && run.planId !== criteria.planId) {
        continue;
      }
      if (criteria?.status && run.status !== criteria.status) {
        continue;
      }
      if (criteria?.executionKind && run.metadata?.executionKind !== criteria.executionKind) {
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
