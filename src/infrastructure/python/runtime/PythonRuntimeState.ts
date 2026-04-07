import {
  PythonRuntimeOwnership,
  PythonRuntimeStatuses,
  type PythonRuntimeManagerStatus,
  type PythonRuntimeOwner,
  type PythonRuntimeStatus,
} from "@application/ports/interfaces/IPythonRuntimeManager";

export class PythonRuntimeState implements PythonRuntimeManagerStatus {
  public readonly status: PythonRuntimeStatus;
  public readonly isAvailable: boolean;
  public readonly owner: PythonRuntimeOwner;
  public readonly lastUpdatedAt: string;
  public readonly detail?: string;

  constructor(values: {
    status: PythonRuntimeStatus;
    owner?: PythonRuntimeOwner;
    detail?: string;
    lastUpdatedAt?: string;
  }) {
    this.status = values.status;
    this.owner = values.owner ?? PythonRuntimeOwnership.none;
    this.detail = values.detail?.trim() || undefined;
    this.lastUpdatedAt = values.lastUpdatedAt ?? new Date().toISOString();
    this.isAvailable = this.status === PythonRuntimeStatuses.healthy;
  }

  public with(values: {
    status?: PythonRuntimeStatus;
    owner?: PythonRuntimeOwner;
    detail?: string;
  }): PythonRuntimeState {
    return new PythonRuntimeState({
      status: values.status ?? this.status,
      owner: values.owner ?? this.owner,
      detail: values.detail,
    });
  }
}

