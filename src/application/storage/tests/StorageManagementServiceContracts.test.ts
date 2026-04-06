import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
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
  type StorageManagementAuditEvent,
  type StorageManagementAuditSink,
} from "../ports/StorageObservabilityPorts";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
  type StoragePolicyDecision,
} from "../ports/StoragePolicyEvaluationPort";
import {
  StorageProvisioningOperationStatuses,
  type IStorageProvisioningPort,
  type StorageProvisioningReceipt,
  type StorageProvisioningRequest,
} from "../ports/StorageProvisioningPort";
import { StorageManagementErrorCodes } from "../use-cases/StorageManagementServiceContracts";
import { StorageManagementService } from "../use-cases/StorageManagementService";

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

class PolicyPort implements IStoragePolicyEvaluationPort {
  public denyActions = new Set<string>();
  public allowedIds = new Set<string>();

  async evaluateStorageAction(
    input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0],
  ): Promise<StoragePolicyDecision> {
    if (this.denyActions.has(input.action)) {
      return {
        allowed: false,
        reasonCode: `denied:${input.action}`,
        message: `Action ${input.action} denied.`,
        occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
      };
    }

    return {
      allowed: true,
      reasonCode: `allowed:${input.action}`,
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    };
  }

  async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    if (this.allowedIds.size < 1) {
      return input.candidateStorageInstanceIds;
    }
    return input.candidateStorageInstanceIds.filter((candidate) => this.allowedIds.has(candidate));
  }
}

class ProvisioningPort implements IStorageProvisioningPort {
  public readonly requests: StorageProvisioningRequest[] = [];
  public nextReceipt: StorageProvisioningReceipt = {
    status: StorageProvisioningOperationStatuses.accepted,
    accepted: true,
    occurredAt: "2026-04-06T12:00:00.000Z",
  };

  async requestStorageProvisioning(input: StorageProvisioningRequest): Promise<StorageProvisioningReceipt> {
    this.requests.push(input);
    return {
      ...this.nextReceipt,
      occurredAt: input.occurredAt ?? this.nextReceipt.occurredAt,
    };
  }
}

class CapabilityPort implements IStorageCapabilityInspectionPort {
  async inspectStorageBackendCapabilities(
    input: Parameters<IStorageCapabilityInspectionPort["inspectStorageBackendCapabilities"]>[0],
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

class HealthAwareCapabilityPort implements IStorageCapabilityInspectionPort {
  public nextSnapshot: StorageBackendCapabilitySnapshot = {
    backendType: StorageBackendTypes.managedFilesystem,
    supportsManagedLifecycle: true,
    supportsAsyncReplication: false,
    supportsSyncReplication: false,
    supportsReadOnlyActive: true,
    supportsCrossWorkspaceReads: false,
    notes: Object.freeze(["binding-health:healthy"]),
    health: {
      status: "healthy",
      reasonCode: "binding-health-healthy",
      checkedAt: "2026-04-06T12:45:00.000Z",
      notes: Object.freeze(["binding-health:healthy"]),
    },
  };

  async inspectStorageBackendCapabilities(
    input: Parameters<IStorageCapabilityInspectionPort["inspectStorageBackendCapabilities"]>[0],
  ): Promise<StorageBackendCapabilitySnapshot> {
    return {
      ...this.nextSnapshot,
      backendType: input.backendType,
    };
  }
}

class AuditSink implements StorageManagementAuditSink {
  public readonly events: StorageManagementAuditEvent[] = [];

  async recordStorageManagementEvent(event: StorageManagementAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function buildStorageInstance(overrides?: Partial<StorageInstance>): StorageInstance {
  return createStorageInstance({
    id: overrides?.id ?? "storage-alpha",
    displayName: overrides?.displayName ?? "Storage Alpha",
    backendType: overrides?.backendType ?? StorageBackendTypes.managedFilesystem,
    ownership: overrides?.ownership ?? {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-admin",
    },
    access: overrides?.access ?? {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    replication: overrides?.replication,
    policy: overrides?.policy ?? {
      policyId: "policy-alpha",
      labels: { tier: "gold" },
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    lifecycleState: overrides?.lifecycleState ?? StorageLifecycleStates.active,
    createdBy: overrides?.createdBy ?? "user-admin",
    createdAt: overrides?.createdAt ?? "2026-04-06T10:00:00.000Z",
    lastModifiedBy: overrides?.lastModifiedBy,
    lastModifiedAt: overrides?.lastModifiedAt,
    lastCorrelationId: overrides?.lastCorrelationId ?? "corr-storage-seed-alpha",
  });
}

describe("StorageManagementService", () => {
  it("executes create, update, list, detail, deactivate, and activate flows with normalized outputs", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    const policyPort = new PolicyPort();
    const provisioningPort = new ProvisioningPort();
    const capabilityPort = new CapabilityPort();
    const auditSink = new AuditSink();

    const service = new StorageManagementService({
      repository,
      policyPort,
      provisioningPort,
      capabilityPort,
      auditSink,
    });

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
        security: {
          encryptionMode: "platform-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
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
    expect(created.value.storageInstance.lifecycleState).toBe(StorageLifecycleStates.active);
    expect(created.value.accessSummary?.allowedActions).toContain("view");
    expect(created.value.capabilities?.supportsManagedLifecycle).toBeTrue();
    expect(Object.isFrozen(created.value.storageInstance)).toBeTrue();

    const updated = await service.updateStorageMetadata({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:update:alpha",
      correlationId: "corr-storage-update-alpha",
      storageInstanceId: "storage-alpha",
      displayName: "Workspace Alpha Primary",
      labels: {
        tier: "platinum",
      },
      policy: {
        security: {
          encryptionMode: "customer-managed",
          keyScope: "workspace",
          allowWorkerDecryption: true,
        },
        encryption: {
          keyReferenceId: "kms://workspace-alpha/storage",
          envelopeRequired: true,
        },
      },
      includeCapabilities: true,
    });

    expect(updated.ok).toBeTrue();
    if (!updated.ok) {
      return;
    }
    expect(updated.value.storageInstance.displayName).toBe("Workspace Alpha Primary");
    expect(updated.value.storageInstance.policy.labels.tier).toBe("platinum");
    expect(updated.value.storageInstance.policy.security.encryptionMode).toBe("customer-managed");
    expect(updated.value.storageInstance.policy.security.allowWorkerDecryption).toBe(true);
    expect(updated.value.storageInstance.policy.encryption.keyReferenceId).toBe("kms://workspace-alpha/storage");
    expect(updated.value.accessSummary?.allowedActions).toContain("update-metadata");

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
    expect(listed.value.items[0]?.accessSummary?.allowedActions).toContain("view");

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
    expect(details.value.accessSummary?.isOwner).toBeTrue();

    const deactivated = await service.deactivateStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:deactivate:alpha",
      correlationId: "corr-storage-deactivate-alpha",
      storageInstanceId: "storage-alpha",
      requestBackendDeactivation: true,
      deactivatedAt: "2026-04-06T12:05:00.000Z",
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
      activatedAt: "2026-04-06T12:10:00.000Z",
    });

    expect(activated.ok).toBeTrue();
    if (!activated.ok) {
      return;
    }
    expect(activated.value.storageInstance.lifecycleState).toBe(StorageLifecycleStates.active);

    expect(auditSink.events.map((event) => event.type)).toEqual([
      StorageManagementAuditEventTypes.storageCreated,
      StorageManagementAuditEventTypes.storageMetadataUpdated,
      StorageManagementAuditEventTypes.storagePolicyUpdated,
      StorageManagementAuditEventTypes.storageAccessListed,
      StorageManagementAuditEventTypes.storageDetailQueried,
      StorageManagementAuditEventTypes.storageDeactivated,
      StorageManagementAuditEventTypes.storageActivated,
    ]);
    const metadataAudit = auditSink.events.find((event) => event.type === StorageManagementAuditEventTypes.storageMetadataUpdated);
    expect(metadataAudit?.details).toEqual(expect.objectContaining({
      changedMetadataFields: ["displayName", "policy.labels"],
      previousDisplayName: "Workspace Alpha Storage",
      currentDisplayName: "Workspace Alpha Primary",
      changedPolicyLabelKeys: ["tier"],
      policyChanged: true,
    }));
    const policyAudit = auditSink.events.find((event) => event.type === StorageManagementAuditEventTypes.storagePolicyUpdated);
    expect(policyAudit?.details).toEqual(expect.objectContaining({
      policyId: "policy-alpha",
      changedPolicyLabelKeys: ["tier"],
      encryptionPolicyChanged: true,
      changedSecurityFields: ["allowWorkerDecryption", "encryptionMode"],
      changedEncryptionFields: ["keyReferenceId"],
    }));
    const deactivatedAudit = auditSink.events.find((event) => event.type === StorageManagementAuditEventTypes.storageDeactivated);
    expect(deactivatedAudit?.details).toEqual(expect.objectContaining({
      previousLifecycleState: StorageLifecycleStates.active,
      nextLifecycleState: StorageLifecycleStates.suspended,
      requestedBackendProvisioning: true,
      provisioningStatus: StorageProvisioningOperationStatuses.accepted,
    }));
  });

  it("rejects invalid encryption policy combinations during metadata updates", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance(), {
      operationKey: "seed:storage-invalid-policy",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-invalid-policy",
    });

    const service = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
    });

    const invalid = await service.updateStorageMetadata({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:update:invalid-policy",
      correlationId: "corr-storage-update-invalid-policy",
      storageInstanceId: "storage-alpha",
      policy: {
        security: {
          encryptionMode: "none",
          contentEncryptionRequired: true,
        },
      },
    });

    expect(invalid).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.invalidRequest,
      }),
    });
  });

  it("returns policy-violation for denied policy actions", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance(), {
      operationKey: "seed:storage-alpha",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-alpha",
    });

    const policyPort = new PolicyPort();
    policyPort.denyActions.add(StoragePolicyActions.getDetails);

    const service = new StorageManagementService({
      repository,
      policyPort,
    });

    const denied = await service.getStorageInstanceDetails({
      actorUserIdentityId: "user-guest",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
    });

    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.policyViolation,
      }),
    });
  });

  it("maps create policy denial to policy-violation", async () => {
    const policyPort = new PolicyPort();
    policyPort.denyActions.add(StoragePolicyActions.create);

    const service = new StorageManagementService({
      repository: new InMemoryStorageInstanceRepository(),
      policyPort,
    });

    const denied = await service.createStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:denied",
      correlationId: "corr-storage-create-denied",
      storageInstanceId: "storage-denied",
      displayName: "Denied Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownerUserIdentityId: "user-admin",
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
        code: StorageManagementErrorCodes.policyViolation,
      }),
    });
  });

  it("returns not-found for cross-workspace instance access", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance(), {
      operationKey: "seed:storage-alpha",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-alpha",
    });

    const service = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
    });

    const notFound = await service.getStorageInstanceDetails({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-beta",
      storageInstanceId: "storage-alpha",
    });

    expect(notFound).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.notFound,
      }),
    });
  });

  it("returns invalid-state for unsupported lifecycle transitions", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance({
      id: "storage-archived",
      lifecycleState: StorageLifecycleStates.archived,
    }), {
      operationKey: "seed:storage-archived",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-archived",
    });

    const service = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
    });

    const invalid = await service.deactivateStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:deactivate:archived",
      correlationId: "corr-storage-deactivate-archived",
      storageInstanceId: "storage-archived",
      targetLifecycleState: StorageLifecycleStates.suspended,
    });

    expect(invalid).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.invalidState,
      }),
    });
  });

  it("returns capability-unsupported when backend operations are requested without a provisioning port", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance({
      id: "storage-suspended",
      lifecycleState: StorageLifecycleStates.suspended,
    }), {
      operationKey: "seed:storage-suspended",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-suspended",
    });

    const service = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
    });

    const unsupported = await service.activateStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:activate:suspended",
      correlationId: "corr-storage-activate-suspended",
      storageInstanceId: "storage-suspended",
      requestBackendActivation: true,
    });

    expect(unsupported).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.capabilityUnsupported,
      }),
    });
  });

  it("returns provisioning-failed when provisioning rejects for non-unsupported reasons", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance({
      id: "storage-suspended-two",
      lifecycleState: StorageLifecycleStates.suspended,
    }), {
      operationKey: "seed:storage-suspended-two",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-suspended-two",
    });

    const provisioningPort = new ProvisioningPort();
    provisioningPort.nextReceipt = {
      status: StorageProvisioningOperationStatuses.rejected,
      accepted: false,
      reasonCode: "backend-temporary-failure",
      message: "Backend busy.",
      occurredAt: "2026-04-06T12:30:00.000Z",
    };

    const service = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
      provisioningPort,
    });

    const failed = await service.activateStorageInstance({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:activate:suspended-two",
      correlationId: "corr-storage-activate-suspended-two",
      storageInstanceId: "storage-suspended-two",
      requestBackendActivation: true,
    });

    expect(failed).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.provisioningFailed,
      }),
    });

    const current = await repository.findStorageInstanceById("storage-suspended-two");
    expect(current?.lifecycleState).toBe(StorageLifecycleStates.suspended);
  });

  it("returns typed storage inspection status and distinguishes unhealthy/inactive/unsupported posture", async () => {
    const repository = new InMemoryStorageInstanceRepository();
    await repository.createStorageInstance(buildStorageInstance({
      id: "storage-inspection",
      lifecycleState: StorageLifecycleStates.active,
    }), {
      operationKey: "seed:storage-inspection",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-inspection",
    });

    const capabilityPort = new HealthAwareCapabilityPort();
    const service = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
      capabilityPort,
    });

    const healthy = await service.inspectStorageInstanceStatus({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-inspection",
    });
    expect(healthy.ok).toBeTrue();
    if (!healthy.ok) {
      return;
    }
    expect(healthy.value.operationalStatus).toBe("healthy");
    expect(healthy.value.reasonCode).toBe("binding-health-healthy");
    expect(healthy.value.lastCheckedAt).toBe("2026-04-06T12:45:00.000Z");
    expect(healthy.value.operationalNotes).toContain("binding-health:healthy");

    capabilityPort.nextSnapshot = {
      ...capabilityPort.nextSnapshot,
      health: {
        status: "unhealthy",
        reasonCode: "binding-health-missing",
        checkedAt: "2026-04-06T12:46:00.000Z",
        notes: Object.freeze(["binding-health:missing"]),
      },
      notes: Object.freeze(["binding-health:missing"]),
    };
    const unhealthy = await service.inspectStorageInstanceStatus({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-inspection",
    });
    expect(unhealthy.ok).toBeTrue();
    if (!unhealthy.ok) {
      return;
    }
    expect(unhealthy.value.operationalStatus).toBe("unhealthy");

    await repository.saveStorageInstance(buildStorageInstance({
      id: "storage-inspection",
      lifecycleState: StorageLifecycleStates.suspended,
    }), {
      operationKey: "seed:storage-inspection:suspended",
      actorUserIdentityId: "user-admin",
      correlationId: "corr-seed-storage-inspection-suspended",
    });
    const inactive = await service.inspectStorageInstanceStatus({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-inspection",
    });
    expect(inactive.ok).toBeTrue();
    if (!inactive.ok) {
      return;
    }
    expect(inactive.value.operationalStatus).toBe("inactive");
    expect(inactive.value.reasonCode).toBe("storage-lifecycle-inactive");

    const unsupportedService = new StorageManagementService({
      repository,
      policyPort: new PolicyPort(),
    });
    const unsupported = await unsupportedService.inspectStorageInstanceStatus({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-inspection",
    });
    expect(unsupported.ok).toBeTrue();
    if (!unsupported.ok) {
      return;
    }
    expect(unsupported.value.operationalStatus).toBe("unsupported");
  });
});
