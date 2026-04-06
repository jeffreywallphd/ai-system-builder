import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageDomainError,
  StorageLifecycleStates,
  createStorageAttribution,
  createStorageInstance,
  createStoragePolicy,
  transitionStorageLifecycle,
  updateStoragePolicy,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
import type {
  IStorageCapabilityInspectionPort,
  StorageBackendCapabilitySnapshot,
} from "../ports/StorageCapabilityInspectionPort";
import type {
  IStorageInstanceRepository,
  StorageInstanceListQuery,
  StorageInstanceMutationContext,
  StorageInstanceMutationResult,
} from "../ports/IStorageInstanceRepository";
import {
  StorageManagementAuditEventTypes,
  publishStorageManagementAuditEventBestEffort,
  type StorageManagementAuditEvent,
  type StorageManagementAuditSink,
} from "../ports/StorageObservabilityPorts";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
} from "../ports/StoragePolicyEvaluationPort";
import {
  StorageProvisioningOperationKinds,
  StorageProvisioningOperationStatuses,
  type IStorageProvisioningPort,
  type StorageProvisioningReceipt,
  type StorageProvisioningRequest,
} from "../ports/StorageProvisioningPort";
import {
  StorageManagementErrorCodes,
  type ActivateStorageInstanceCommand,
  type CreateStorageInstanceCommand,
  type CreateStorageInstanceResult,
  type DeactivateStorageInstanceCommand,
  type GetStorageInstanceDetailsQuery,
  type GetStorageInstanceDetailsResult,
  type IStorageManagementService,
  type ListAccessibleStorageInstancesQuery,
  type ListAccessibleStorageInstancesResult,
  type StorageLifecycleMutationResult,
  type StorageManagementResult,
  type UpdateStorageMetadataCommand,
  type UpdateStorageMetadataResult,
} from "../use-cases/StorageManagementServiceContracts";

class InMemoryStorageInstanceRepository implements IStorageInstanceRepository {
  private readonly records = new Map<string, StorageInstance>();
  private readonly replayByOperation = new Map<string, StorageInstanceMutationResult & { readonly storageInstance?: StorageInstance }>();

  async findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined> {
    return this.records.get(storageInstanceId.trim());
  }

  async listStorageInstances(query: StorageInstanceListQuery): Promise<ReadonlyArray<StorageInstance>> {
    const filtered = [...this.records.values()]
      .filter((storage) => !query.workspaceId || storage.ownership.workspaceId === query.workspaceId)
      .filter((storage) => !query.ownerUserIdentityId || storage.ownership.ownerUserIdentityId === query.ownerUserIdentityId)
      .filter((storage) => !query.storageInstanceIds || query.storageInstanceIds.length === 0 || query.storageInstanceIds.includes(storage.id))
      .filter((storage) => !query.backendTypes || query.backendTypes.length === 0 || query.backendTypes.includes(storage.backendType))
      .filter((storage) => !query.lifecycleStates || query.lifecycleStates.length === 0 || query.lifecycleStates.includes(storage.lifecycleState))
      .filter((storage) => !query.accessModes || query.accessModes.length === 0 || query.accessModes.includes(storage.access.mode))
      .filter((storage) => !query.accessScopes || query.accessScopes.length === 0 || query.accessScopes.includes(storage.access.scope));

    const offset = query.offset && query.offset > 0 ? query.offset : 0;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;
    const paged = offset > 0 ? filtered.slice(offset) : filtered;
    return limit ? paged.slice(0, limit) : paged;
  }

  async createStorageInstance(
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }> {
    const replay = this.replayByOperation.get(mutation.operationKey);
    if (replay?.storageInstance) {
      return {
        changed: false,
        wasReplay: true,
        storageInstance: replay.storageInstance,
      };
    }

    this.records.set(storageInstance.id, storageInstance);
    const result = {
      changed: true,
      wasReplay: false,
      storageInstance,
    } as const;
    this.replayByOperation.set(mutation.operationKey, result);
    return result;
  }

  async saveStorageInstance(
    storageInstance: StorageInstance,
    mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }> {
    const replay = this.replayByOperation.get(mutation.operationKey);
    if (replay?.storageInstance) {
      return {
        changed: false,
        wasReplay: true,
        storageInstance: replay.storageInstance,
      };
    }

    const previous = this.records.get(storageInstance.id);
    this.records.set(storageInstance.id, storageInstance);
    const changed = JSON.stringify(previous) !== JSON.stringify(storageInstance);
    const result = {
      changed,
      wasReplay: false,
      storageInstance,
    } as const;
    this.replayByOperation.set(mutation.operationKey, result);
    return result;
  }
}

class AllowAllStoragePolicyEvaluationPort implements IStoragePolicyEvaluationPort {
  async evaluateStorageAction(input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0]) {
    return {
      allowed: true,
      reasonCode: "allowed",
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    } as const;
  }

  async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

class DenyCreateStoragePolicyEvaluationPort extends AllowAllStoragePolicyEvaluationPort {
  override async evaluateStorageAction(input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0]) {
    if (input.action === StoragePolicyActions.create) {
      return {
        allowed: false,
        reasonCode: "denied-by-policy",
        message: "Storage create denied.",
        occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
      } as const;
    }

    return super.evaluateStorageAction(input);
  }
}

class InMemoryStorageProvisioningPort implements IStorageProvisioningPort {
  public readonly requests: StorageProvisioningRequest[] = [];

  async requestStorageProvisioning(input: StorageProvisioningRequest): Promise<StorageProvisioningReceipt> {
    this.requests.push(input);
    return {
      status: StorageProvisioningOperationStatuses.accepted,
      accepted: true,
      backendRequestId: `backend:${input.operationKind}:${input.storageInstance.id}`,
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    };
  }
}

class InMemoryStorageCapabilityInspectionPort {
  async inspectStorageBackendCapabilities(
    input: {
      readonly backendType: StorageInstance["backendType"];
      readonly workspaceId: string;
    },
  ): Promise<StorageBackendCapabilitySnapshot> {
    return {
      backendType: input.backendType,
      supportsManagedLifecycle: true,
      supportsAsyncReplication: true,
      supportsSyncReplication: true,
      supportsReadOnlyActive: true,
      supportsCrossWorkspaceReads: true,
      minReplicationSyncIntervalSeconds: 10,
    };
  }
}

class InMemoryStorageAuditSink implements StorageManagementAuditSink {
  public readonly events: StorageManagementAuditEvent[] = [];

  async recordStorageManagementEvent(event: StorageManagementAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class ThrowingStorageAuditSink implements StorageManagementAuditSink {
  async recordStorageManagementEvent(): Promise<void> {
    throw new Error("audit unavailable");
  }
}

class InMemoryStorageManagementService implements IStorageManagementService {
  public constructor(
    private readonly repository: IStorageInstanceRepository,
    private readonly policyPort: IStoragePolicyEvaluationPort,
    private readonly provisioningPort?: IStorageProvisioningPort,
    private readonly capabilityPort?: IStorageCapabilityInspectionPort,
    private readonly auditSink?: StorageManagementAuditSink,
  ) {}

  async createStorageInstance(
    command: CreateStorageInstanceCommand,
  ): Promise<StorageManagementResult<CreateStorageInstanceResult>> {
    const policyDecision = await this.policyPort.evaluateStorageAction({
      action: StoragePolicyActions.create,
      actorUserIdentityId: command.actorUserIdentityId,
      workspaceId: command.workspaceId,
      occurredAt: command.createdAt,
    });
    if (!policyDecision.allowed) {
      return this.failure(StorageManagementErrorCodes.accessDenied, policyDecision.message ?? "Storage create denied.");
    }

    try {
      const storageInstance = createStorageInstance({
        id: command.storageInstanceId,
        displayName: command.displayName,
        backendType: command.backendType,
        ownership: {
          workspaceId: command.workspaceId,
          ownerUserIdentityId: command.ownerUserIdentityId,
        },
        access: command.access,
        replication: command.replication,
        policy: command.policy,
        lifecycleState: command.lifecycleState,
        createdBy: command.actorUserIdentityId,
        createdAt: command.createdAt,
        lastCorrelationId: command.correlationId,
      });

      const created = await this.repository.createStorageInstance(storageInstance, {
        operationKey: command.operationKey,
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt: command.createdAt,
        correlationId: command.correlationId,
      });

      const provisioning = await this.requestProvisioningIfNeeded(
        command.requestBackendProvisioning ?? false,
        StorageProvisioningOperationKinds.create,
        created.storageInstance,
        command.actorUserIdentityId,
        command.correlationId,
        command.createdAt,
      );
      const capabilities = await this.inspectCapabilitiesIfRequested(
        command.includeCapabilities ?? false,
        created.storageInstance,
      );

      await publishStorageManagementAuditEventBestEffort(this.auditSink, {
        type: StorageManagementAuditEventTypes.storageCreated,
        actorUserIdentityId: command.actorUserIdentityId,
        workspaceId: command.workspaceId,
        storageInstanceId: created.storageInstance.id,
        correlationId: command.correlationId,
        occurredAt: created.storageInstance.createdAt,
        outcome: created.wasReplay ? "already-applied" : "success",
      });

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: created.storageInstance,
          provisioning,
          capabilities,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage create failed.";
      const code = error instanceof StorageDomainError
        ? StorageManagementErrorCodes.invalidRequest
        : StorageManagementErrorCodes.internal;
      return this.failure(code, message);
    }
  }

  async updateStorageMetadata(
    command: UpdateStorageMetadataCommand,
  ): Promise<StorageManagementResult<UpdateStorageMetadataResult>> {
    const current = await this.repository.findStorageInstanceById(command.storageInstanceId);
    if (!current || current.ownership.workspaceId !== command.workspaceId) {
      return this.failure(StorageManagementErrorCodes.notFound, "Storage instance was not found.");
    }

    const policyDecision = await this.policyPort.evaluateStorageAction({
      action: StoragePolicyActions.updateMetadata,
      actorUserIdentityId: command.actorUserIdentityId,
      workspaceId: command.workspaceId,
      storageInstance: current,
      occurredAt: command.occurredAt,
    });
    if (!policyDecision.allowed) {
      return this.failure(StorageManagementErrorCodes.accessDenied, policyDecision.message ?? "Storage metadata update denied.");
    }

    try {
      const attribution = createStorageAttribution({
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt: command.occurredAt,
        correlationId: command.correlationId,
      });
      const policyUpdated = updateStoragePolicy(current, {
        labels: command.labels ?? current.policy.labels,
      }, attribution);
      const updated = createStorageInstance({
        id: policyUpdated.id,
        displayName: command.displayName ?? policyUpdated.displayName,
        backendType: policyUpdated.backendType,
        ownership: policyUpdated.ownership,
        access: policyUpdated.access,
        replication: policyUpdated.replication,
        policy: policyUpdated.policy,
        lifecycleState: policyUpdated.lifecycleState,
        createdBy: policyUpdated.createdBy,
        createdAt: policyUpdated.createdAt,
        lastModifiedBy: attribution.actorUserIdentityId,
        lastModifiedAt: attribution.occurredAt,
        lastCorrelationId: attribution.correlationId,
      });

      const saved = await this.repository.saveStorageInstance(updated, {
        operationKey: command.operationKey,
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt: attribution.occurredAt,
        correlationId: command.correlationId,
      });
      const capabilities = await this.inspectCapabilitiesIfRequested(
        command.includeCapabilities ?? false,
        saved.storageInstance,
      );

      await publishStorageManagementAuditEventBestEffort(this.auditSink, {
        type: StorageManagementAuditEventTypes.storageMetadataUpdated,
        actorUserIdentityId: command.actorUserIdentityId,
        workspaceId: command.workspaceId,
        storageInstanceId: saved.storageInstance.id,
        correlationId: command.correlationId,
        occurredAt: saved.storageInstance.lastModifiedAt,
        outcome: saved.wasReplay ? "already-applied" : "success",
      });

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: saved.storageInstance,
          capabilities,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage metadata update failed.";
      const code = error instanceof StorageDomainError
        ? StorageManagementErrorCodes.invalidRequest
        : StorageManagementErrorCodes.internal;
      return this.failure(code, message);
    }
  }

  async activateStorageInstance(
    command: ActivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>> {
    return this.transitionStorageLifecycle(command, StorageLifecycleStates.active, StoragePolicyActions.activate);
  }

  async deactivateStorageInstance(
    command: DeactivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>> {
    const targetState = command.targetLifecycleState ?? StorageLifecycleStates.suspended;
    return this.transitionStorageLifecycle(command, targetState, StoragePolicyActions.deactivate);
  }

  async listAccessibleStorageInstances(
    query: ListAccessibleStorageInstancesQuery,
  ): Promise<StorageManagementResult<ListAccessibleStorageInstancesResult>> {
    const policyDecision = await this.policyPort.evaluateStorageAction({
      action: StoragePolicyActions.listAccessible,
      actorUserIdentityId: query.actorUserIdentityId,
      workspaceId: query.workspaceId,
      occurredAt: query.occurredAt,
    });
    if (!policyDecision.allowed) {
      return this.failure(StorageManagementErrorCodes.accessDenied, policyDecision.message ?? "Storage list denied.");
    }

    const listed = await this.repository.listStorageInstances({
      workspaceId: query.workspaceId,
      backendTypes: query.backendTypes,
      lifecycleStates: query.lifecycleStates,
      accessModes: query.accessModes,
      accessScopes: query.accessScopes,
      limit: query.limit,
      offset: query.offset,
    });
    const accessibleIds = await this.policyPort.resolveAccessibleStorageInstanceIds({
      actorUserIdentityId: query.actorUserIdentityId,
      workspaceId: query.workspaceId,
      candidateStorageInstanceIds: listed.map((item) => item.id),
      occurredAt: query.occurredAt,
    });
    const accessibleSet = new Set(accessibleIds);
    const items: ListAccessibleStorageInstancesResult["items"] = [];
    for (const storageInstance of listed) {
      if (!accessibleSet.has(storageInstance.id)) {
        continue;
      }

      items.push(Object.freeze({
        storageInstance,
        capabilities: await this.inspectCapabilitiesIfRequested(query.includeCapabilities ?? false, storageInstance),
      }));
    }

    await publishStorageManagementAuditEventBestEffort(this.auditSink, {
      type: StorageManagementAuditEventTypes.storageAccessListed,
      actorUserIdentityId: query.actorUserIdentityId,
      workspaceId: query.workspaceId,
      occurredAt: query.occurredAt ?? "2026-04-06T12:00:00.000Z",
      outcome: "success",
      details: Object.freeze({
        itemCount: items.length,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        items: Object.freeze(items),
      }),
    };
  }

  async getStorageInstanceDetails(
    query: GetStorageInstanceDetailsQuery,
  ): Promise<StorageManagementResult<GetStorageInstanceDetailsResult>> {
    const storageInstance = await this.repository.findStorageInstanceById(query.storageInstanceId);
    if (!storageInstance || storageInstance.ownership.workspaceId !== query.workspaceId) {
      return this.failure(StorageManagementErrorCodes.notFound, "Storage instance was not found.");
    }

    const policyDecision = await this.policyPort.evaluateStorageAction({
      action: StoragePolicyActions.getDetails,
      actorUserIdentityId: query.actorUserIdentityId,
      workspaceId: query.workspaceId,
      storageInstance,
      occurredAt: query.occurredAt,
    });
    if (!policyDecision.allowed) {
      return this.failure(StorageManagementErrorCodes.accessDenied, policyDecision.message ?? "Storage details denied.");
    }

    await publishStorageManagementAuditEventBestEffort(this.auditSink, {
      type: StorageManagementAuditEventTypes.storageDetailQueried,
      actorUserIdentityId: query.actorUserIdentityId,
      workspaceId: query.workspaceId,
      storageInstanceId: storageInstance.id,
      occurredAt: query.occurredAt ?? "2026-04-06T12:00:00.000Z",
      outcome: "success",
    });

    return {
      ok: true,
      value: Object.freeze({
        storageInstance,
        capabilities: await this.inspectCapabilitiesIfRequested(query.includeCapabilities ?? false, storageInstance),
      }),
    };
  }

  private async transitionStorageLifecycle(
    command: ActivateStorageInstanceCommand | DeactivateStorageInstanceCommand,
    nextState: StorageInstance["lifecycleState"],
    action: typeof StoragePolicyActions.activate | typeof StoragePolicyActions.deactivate,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>> {
    const current = await this.repository.findStorageInstanceById(command.storageInstanceId);
    if (!current || current.ownership.workspaceId !== command.workspaceId) {
      return this.failure(StorageManagementErrorCodes.notFound, "Storage instance was not found.");
    }

    const occurredAt = "activatedAt" in command ? command.activatedAt : command.deactivatedAt;
    const policyDecision = await this.policyPort.evaluateStorageAction({
      action,
      actorUserIdentityId: command.actorUserIdentityId,
      workspaceId: command.workspaceId,
      storageInstance: current,
      occurredAt,
    });
    if (!policyDecision.allowed) {
      return this.failure(StorageManagementErrorCodes.accessDenied, policyDecision.message ?? "Storage lifecycle transition denied.");
    }

    try {
      const transitioned = transitionStorageLifecycle(current, nextState, createStorageAttribution({
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt,
        correlationId: command.correlationId,
      }));

      const saved = await this.repository.saveStorageInstance(transitioned, {
        operationKey: command.operationKey,
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt: transitioned.lastModifiedAt,
        correlationId: command.correlationId,
      });

      const requestProvisioning = "requestBackendActivation" in command
        ? command.requestBackendActivation
        : command.requestBackendDeactivation;
      const provisioningOperation = "requestBackendActivation" in command
        ? StorageProvisioningOperationKinds.activate
        : StorageProvisioningOperationKinds.deactivate;
      const provisioning = await this.requestProvisioningIfNeeded(
        requestProvisioning ?? false,
        provisioningOperation,
        saved.storageInstance,
        command.actorUserIdentityId,
        command.correlationId,
        transitioned.lastModifiedAt,
      );
      const capabilities = await this.inspectCapabilitiesIfRequested(
        command.includeCapabilities ?? false,
        saved.storageInstance,
      );

      await publishStorageManagementAuditEventBestEffort(this.auditSink, {
        type: action === StoragePolicyActions.activate
          ? StorageManagementAuditEventTypes.storageActivated
          : StorageManagementAuditEventTypes.storageDeactivated,
        actorUserIdentityId: command.actorUserIdentityId,
        workspaceId: command.workspaceId,
        storageInstanceId: saved.storageInstance.id,
        correlationId: command.correlationId,
        occurredAt: saved.storageInstance.lastModifiedAt,
        outcome: saved.wasReplay ? "already-applied" : "success",
      });

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: saved.storageInstance,
          provisioning,
          capabilities,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage lifecycle transition failed.";
      const code = error instanceof StorageDomainError
        ? StorageManagementErrorCodes.invalidState
        : StorageManagementErrorCodes.internal;
      return this.failure(code, message);
    }
  }

  private async requestProvisioningIfNeeded(
    shouldRequest: boolean,
    operationKind: StorageProvisioningRequest["operationKind"],
    storageInstance: StorageInstance,
    actorUserIdentityId: string,
    correlationId?: string,
    occurredAt?: string,
  ): Promise<StorageProvisioningReceipt | undefined> {
    if (!shouldRequest || !this.provisioningPort) {
      return undefined;
    }
    return this.provisioningPort.requestStorageProvisioning({
      operationKind,
      storageInstance,
      actorUserIdentityId,
      correlationId,
      occurredAt,
    });
  }

  private async inspectCapabilitiesIfRequested(
    shouldInspect: boolean,
    storageInstance: StorageInstance,
  ): Promise<StorageBackendCapabilitySnapshot | undefined> {
    if (!shouldInspect || !this.capabilityPort) {
      return undefined;
    }
    if (this.capabilityPort.inspectStorageInstanceCapabilities) {
      return this.capabilityPort.inspectStorageInstanceCapabilities({
        storageInstance,
      });
    }
    return this.capabilityPort.inspectStorageBackendCapabilities({
      backendType: storageInstance.backendType,
      workspaceId: storageInstance.ownership.workspaceId,
      requestedReplicationMode: storageInstance.replication.mode,
    });
  }

  private failure(code: typeof StorageManagementErrorCodes[keyof typeof StorageManagementErrorCodes], message: string) {
    return {
      ok: false,
      error: {
        code,
        message,
      },
    } as const;
  }
}

describe("storage management service contracts", () => {
  it("supports create, update metadata, activate/deactivate, list accessible, and detail queries", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    const policyPort = new AllowAllStoragePolicyEvaluationPort();
    const provisioningPort = new InMemoryStorageProvisioningPort();
    const capabilityPort = new InMemoryStorageCapabilityInspectionPort();
    const auditSink = new InMemoryStorageAuditSink();
    const service = new InMemoryStorageManagementService(
      repository,
      policyPort,
      provisioningPort,
      capabilityPort,
      auditSink,
    );

    const created = await service.createStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:alpha",
      correlationId: "corr-storage-create-alpha",
      storageInstanceId: "storage-alpha",
      displayName: "Workspace Alpha Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownerUserIdentityId: "user-admin",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-alpha",
        labels: {
          tier: "gold",
        },
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      requestBackendProvisioning: true,
      includeCapabilities: true,
      createdAt: "2026-04-06T12:00:00.000Z",
    });
    expect(created.ok).toBeTrue();
    if (!created.ok) {
      return;
    }
    expect(created.value.storageInstance.id).toBe("storage-alpha");
    expect(created.value.provisioning?.status).toBe("accepted");
    expect(created.value.capabilities?.supportsManagedLifecycle).toBeTrue();

    const updated = await service.updateStorageMetadata({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:update-meta:alpha",
      correlationId: "corr-storage-update-alpha",
      storageInstanceId: "storage-alpha",
      displayName: "Workspace Alpha Primary Storage",
      labels: {
        tier: "platinum",
      },
      occurredAt: "2026-04-06T12:05:00.000Z",
    });
    expect(updated.ok).toBeTrue();
    if (!updated.ok) {
      return;
    }
    expect(updated.value.storageInstance.displayName).toBe("Workspace Alpha Primary Storage");
    expect(updated.value.storageInstance.policy.labels.tier).toBe("platinum");

    const deactivated = await service.deactivateStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:deactivate:alpha",
      correlationId: "corr-storage-deactivate-alpha",
      storageInstanceId: "storage-alpha",
      requestBackendDeactivation: true,
      deactivatedAt: "2026-04-06T12:10:00.000Z",
    });
    expect(deactivated.ok).toBeTrue();
    if (!deactivated.ok) {
      return;
    }
    expect(deactivated.value.storageInstance.lifecycleState).toBe(StorageLifecycleStates.suspended);

    const activated = await service.activateStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:activate:alpha",
      correlationId: "corr-storage-activate-alpha",
      storageInstanceId: "storage-alpha",
      requestBackendActivation: true,
      activatedAt: "2026-04-06T12:20:00.000Z",
    });
    expect(activated.ok).toBeTrue();
    if (!activated.ok) {
      return;
    }
    expect(activated.value.storageInstance.lifecycleState).toBe(StorageLifecycleStates.active);

    const listed = await service.listAccessibleStorageInstances({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      includeCapabilities: true,
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok) {
      return;
    }
    expect(listed.value.items).toHaveLength(1);
    expect(listed.value.items[0]?.storageInstance.id).toBe("storage-alpha");
    expect(listed.value.items[0]?.capabilities?.supportsSyncReplication).toBeTrue();

    const details = await service.getStorageInstanceDetails({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      includeCapabilities: true,
    });
    expect(details.ok).toBeTrue();
    if (!details.ok) {
      return;
    }
    expect(details.value.storageInstance.id).toBe("storage-alpha");
    expect(details.value.capabilities?.backendType).toBe(StorageBackendTypes.managedFilesystem);

    expect(provisioningPort.requests).toHaveLength(3);
    expect(auditSink.events.map((event) => event.type)).toEqual([
      StorageManagementAuditEventTypes.storageCreated,
      StorageManagementAuditEventTypes.storageMetadataUpdated,
      StorageManagementAuditEventTypes.storageDeactivated,
      StorageManagementAuditEventTypes.storageActivated,
      StorageManagementAuditEventTypes.storageAccessListed,
      StorageManagementAuditEventTypes.storageDetailQueried,
    ]);
  });

  it("returns access denied for create when policy port blocks the request", async () => {
    const service = new InMemoryStorageManagementService(
      new InMemoryStorageInstanceRepository(),
      new DenyCreateStoragePolicyEvaluationPort(),
    );

    const denied = await service.createStorageInstance({
      actorUserIdentityId: "user-blocked",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:denied",
      correlationId: "corr-storage-create-denied",
      storageInstanceId: "storage-denied",
      displayName: "Denied storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownerUserIdentityId: "user-blocked",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-denied",
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
    });

    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.accessDenied,
      }),
    });
  });

  it("swallows audit sink failures for best-effort audit publishing", async () => {
    await expect(publishStorageManagementAuditEventBestEffort(new ThrowingStorageAuditSink(), {
      type: StorageManagementAuditEventTypes.storageCreated,
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      occurredAt: "2026-04-06T12:00:00.000Z",
      outcome: "success",
    })).resolves.toBeUndefined();
  });

  it("exposes stable error-code and provisioning constants", () => {
    expect(StorageManagementErrorCodes.invalidRequest).toBe("storage-invalid-request");
    expect(StorageProvisioningOperationKinds.deactivate).toBe("deactivate");
    expect(StorageProvisioningOperationStatuses.alreadyApplied).toBe("already-applied");
  });

  it("allows policy metadata normalization through shared domain constructor used by contracts", () => {
    const policy = createStoragePolicy({
      policyId: "policy-contract-test",
      labels: {
        Team: "Alpha",
      },
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    });

    expect(policy.policyId).toBe("policy-contract-test");
    expect(policy.labels.Team).toBe("Alpha");
  });
});
