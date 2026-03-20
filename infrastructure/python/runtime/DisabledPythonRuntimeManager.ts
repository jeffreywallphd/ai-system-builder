import {
  PythonRuntimeOwnership,
  PythonRuntimeStatuses,
  type IPythonRuntimeManager,
  type PythonRuntimeManagerStatus,
} from "../../../application/ports/interfaces/IPythonRuntimeManager";

const DISABLED_DETAIL = "Python runtime is disabled in settings.";

export class DisabledPythonRuntimeManager implements IPythonRuntimeManager {
  public async checkAvailability(): Promise<boolean> {
    return false;
  }

  public async ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    return this.getStatus();
  }

  public getStatus(): PythonRuntimeManagerStatus {
    return {
      status: PythonRuntimeStatuses.unavailable,
      isAvailable: false,
      owner: PythonRuntimeOwnership.none,
      lastUpdatedAt: new Date().toISOString(),
      detail: DISABLED_DETAIL,
    };
  }

  public async stopManagedRuntime(): Promise<void> {
    return undefined;
  }
}
