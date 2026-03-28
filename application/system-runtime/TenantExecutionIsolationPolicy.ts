import type { ExecutionAccessContext } from "./RuntimeAccessControlService";
import type { ISystemRuntimeExecutionStore, PersistedExecutionRecord } from "./SystemRuntimeExecutionStore";

export interface ExecutionTenantContext {
  readonly tenantId: string;
  readonly source: "explicit-request" | "caller-context";
}

export interface TenantScopedExecutionAccessContext {
  readonly caller?: ExecutionAccessContext;
  readonly tenant?: ExecutionTenantContext;
}

export interface TenantExecutionIsolationDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export class TenantExecutionIsolationPolicy {
  public evaluate(input: {
    readonly access: TenantScopedExecutionAccessContext;
    readonly resourceTenantId?: string;
  }): TenantExecutionIsolationDecision {
    const callerTenant = input.access.tenant?.tenantId?.trim();
    const resourceTenant = input.resourceTenantId?.trim();
    if (!callerTenant && !resourceTenant) {
      return Object.freeze({ allowed: true });
    }
    if (!callerTenant && resourceTenant) {
      return Object.freeze({
        allowed: false,
        reason: "Runtime execution is tenant-scoped and requires a matching tenant context.",
      });
    }
    if (callerTenant && !resourceTenant) {
      return Object.freeze({ allowed: true });
    }
    if (callerTenant !== resourceTenant) {
      return Object.freeze({
        allowed: false,
        reason: "Runtime execution does not belong to the caller tenant context.",
      });
    }
    return Object.freeze({ allowed: true });
  }
}

export class TenantScopedExecutionRepositoryView {
  public constructor(private readonly executionStore: ISystemRuntimeExecutionStore) {}

  public getById(input: { readonly executionId: string; readonly tenantId?: string }): PersistedExecutionRecord | undefined {
    const record = this.executionStore.getExecutionRecord(input.executionId);
    if (!record) {
      return undefined;
    }
    if (!input.tenantId?.trim()) {
      return record;
    }
    return record.metadata.tenantId === input.tenantId.trim() ? record : undefined;
  }

  public listBySystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
    readonly tenantId?: string;
  }): ReadonlyArray<PersistedExecutionRecord> {
    const records = this.executionStore.listExecutionRecordsForSystem(input);
    if (!input.tenantId?.trim()) {
      return records;
    }
    const tenantId = input.tenantId.trim();
    return Object.freeze(records.filter((record) => record.metadata.tenantId === tenantId));
  }
}

