import type { IExecutionRunRepository, IExecutionRunRepositoryListCriteria } from "../../../application/ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import type { DesktopExecutionRunBridge } from "../../../electron/shared/DesktopContracts";
import { freezeExecutionRunRecord } from "../../../application/execution/freezeExecutionRunRecord";

export class DesktopBridgeExecutionRunRepository implements IExecutionRunRepository {
  constructor(private readonly bridge: DesktopExecutionRunBridge) {}

  public async saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord> {
    await this.bridge.saveExecutionRun(JSON.stringify(run));
    return run;
  }

  public async getRunById(runId: string): Promise<IExecutionRunRecord | undefined> {
    const raw = await this.bridge.loadExecutionRun(runId.trim());
    return raw ? freezeExecutionRunRecord(JSON.parse(raw) as IExecutionRunRecord) : undefined;
  }

  public async listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const rawRuns = await this.bridge.listExecutionRuns(criteria ? JSON.stringify(criteria) : undefined);
    return Object.freeze(rawRuns.map((runJson) => freezeExecutionRunRecord(JSON.parse(runJson) as IExecutionRunRecord)));
  }
}
