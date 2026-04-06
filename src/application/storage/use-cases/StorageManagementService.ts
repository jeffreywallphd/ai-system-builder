import {
  StorageDomainError,
  StorageLifecycleTransitionError,
  StorageLifecycleStates,
  StorageManagedActions,
  StoragePolicyRestrictedCapabilities,
  createStorageAttribution,
  createStorageInstance,
  transitionStorageLifecycle,
  updateStoragePolicy,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
import type { IStorageCapabilityInspectionPort, StorageBackendCapabilitySnapshot } from "../ports/StorageCapabilityInspectionPort";
import { StorageBackendHealthStatuses } from "../ports/StorageCapabilityInspectionPort";
import type { StorageInstanceAccessSummary } from "../ports/StorageAccessSummaryPort";
import type { IStorageInstanceRepository } from "../ports/IStorageInstanceRepository";
import {
  StorageManagementAuditEventTypes,
  publishStorageManagementAuditEventBestEffort,
  type StorageManagementAuditSink,
} from "../ports/StorageObservabilityPorts";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
  type StoragePolicyAction,
  type StoragePolicyDecision,
} from "../ports/StoragePolicyEvaluationPort";
import {
  StorageProvisioningOperationKinds,
  type StorageProvisioningOperationKind,
  type IStorageProvisioningPort,
  type StorageProvisioningReceipt,
} from "../ports/StorageProvisioningPort";
import {
  CreateStorageInstanceWithProvisioningUseCase,
  type CreateStorageInstanceWithProvisioningUseCaseDependencies,
} from "./CreateStorageInstanceWithProvisioningUseCase";
import {
  StorageManagementErrorCodes,
  type ActivateStorageInstanceCommand,
  type CreateStorageInstanceCommand,
  type CreateStorageInstanceResult,
  type DeactivateStorageInstanceCommand,
  type GetStorageInstanceDetailsQuery,
  type GetStorageInstanceDetailsResult,
  type IStorageManagementService,
  type InspectStorageInstanceStatusQuery,
  type InspectStorageInstanceStatusResult,
  type ListAccessibleStorageInstancesQuery,
  type ListAccessibleStorageInstancesResult,
  type StorageLifecycleMutationResult,
  type StorageManagementResult,
  type UpdateStorageMetadataCommand,
  type UpdateStorageMetadataResult,
} from "./StorageManagementServiceContracts";
import {
  StorageBackendOperationUnsupportedError,
  StorageInstanceNotFoundError,
  StorageInvalidLifecycleTransitionError,
  StorageManagementServiceError,
  StoragePolicyViolationError,
} from "./StorageManagementServiceErrors";

const UnsupportedProvisioningReasonCodeFragments = ["not-configured", "unsupported"];

export interface StorageManagementServiceDependencies {
  readonly repository: IStorageInstanceRepository;
  readonly policyPort: IStoragePolicyEvaluationPort;
  readonly provisioningPort?: IStorageProvisioningPort;
  readonly capabilityPort?: IStorageCapabilityInspectionPort;
  readonly auditSink?: StorageManagementAuditSink;
}

export class StorageManagementService implements IStorageManagementService {
  private readonly createUseCase: CreateStorageInstanceWithProvisioningUseCase;

  public constructor(
    private readonly dependencies: StorageManagementServiceDependencies,
  ) {
    const createDependencies: CreateStorageInstanceWithProvisioningUseCaseDependencies = {
      repository: dependencies.repository,
      policyPort: dependencies.policyPort,
      provisioningPort: dependencies.provisioningPort,
      capabilityPort: dependencies.capabilityPort,
      auditSink: dependencies.auditSink,
    };
    this.createUseCase = new CreateStorageInstanceWithProvisioningUseCase(createDependencies);
  }

  public async createStorageInstance(
    command: CreateStorageInstanceCommand,
  ): Promise<StorageManagementResult<CreateStorageInstanceResult>> {
    const result = await this.createUseCase.execute(command);
    if (!result.ok) {
      if (result.error.code === StorageManagementErrorCodes.accessDenied) {
        return {
          ok: false,
          error: {
            code: StorageManagementErrorCodes.policyViolation,
            message: result.error.message,
            details: result.error.details,
          },
        };
      }
      return result;
    }

    try {
      const accessSummary = await this.createAccessSummary(
        result.value.storageInstance,
        command.actorUserIdentityId,
        StorageManagedActions.view,
        {
          allowed: true,
          reasonCode: "storage-created",
        },
      );

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: this.normalizeStorageInstance(result.value.storageInstance),
          accessSummary,
          provisioning: this.normalizeProvisioning(result.value.provisioning),
          capabilities: this.normalizeCapabilities(result.value.capabilities),
        }),
      };
    } catch (error) {
      return this.failureFromError(error, "Storage create failed.");
    }
  }

  public async updateStorageMetadata(
    command: UpdateStorageMetadataCommand,
  ): Promise<StorageManagementResult<UpdateStorageMetadataResult>> {
    try {
      const current = await this.requireStorageInstance(command.storageInstanceId, command.workspaceId);
      const occurredAt = command.occurredAt ?? new Date().toISOString();
      const decision = await this.requireAllowedPolicyAction(
        StoragePolicyActions.updateMetadata,
        command.actorUserIdentityId,
        command.workspaceId,
        current,
        occurredAt,
      );

      const attribution = createStorageAttribution({
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt,
        correlationId: command.correlationId,
      });
      const policyUpdated = updateStoragePolicy(
        current,
        {
          labels: command.labels ?? current.policy.labels,
        },
        attribution,
      );
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

      const saved = await this.dependencies.repository.saveStorageInstance(updated, {
        operationKey: command.operationKey,
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt: updated.lastModifiedAt,
        correlationId: command.correlationId,
      });

      await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
        type: StorageManagementAuditEventTypes.storageMetadataUpdated,
        actorUserIdentityId: command.actorUserIdentityId,
        workspaceId: command.workspaceId,
        storageInstanceId: saved.storageInstance.id,
        correlationId: command.correlationId,
        occurredAt: saved.storageInstance.lastModifiedAt,
        outcome: saved.wasReplay ? "already-applied" : "success",
        details: this.buildStorageMetadataAuditDetails(current, saved.storageInstance),
      });
      if (this.didStoragePolicyChange(current, saved.storageInstance)) {
        await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
          type: StorageManagementAuditEventTypes.storagePolicyUpdated,
          actorUserIdentityId: command.actorUserIdentityId,
          workspaceId: command.workspaceId,
          storageInstanceId: saved.storageInstance.id,
          correlationId: command.correlationId,
          occurredAt: saved.storageInstance.lastModifiedAt,
          outcome: saved.wasReplay ? "already-applied" : "success",
          details: this.buildStoragePolicyAuditDetails(current, saved.storageInstance),
        });
      }

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: this.normalizeStorageInstance(saved.storageInstance),
          accessSummary: await this.createAccessSummary(
            saved.storageInstance,
            command.actorUserIdentityId,
            StorageManagedActions.updateMetadata,
            decision,
          ),
          capabilities: await this.inspectCapabilitiesIfRequested(
            command.includeCapabilities ?? false,
            saved.storageInstance,
          ),
        }),
      };
    } catch (error) {
      return this.failureFromError(error, "Storage metadata update failed.");
    }
  }

  public async activateStorageInstance(
    command: ActivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>> {
    return this.transitionStorageLifecycle(command, "active", StoragePolicyActions.activate);
  }

  public async deactivateStorageInstance(
    command: DeactivateStorageInstanceCommand,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>> {
    const target = command.targetLifecycleState ?? "suspended";
    return this.transitionStorageLifecycle(command, target, StoragePolicyActions.deactivate);
  }

  public async listAccessibleStorageInstances(
    query: ListAccessibleStorageInstancesQuery,
  ): Promise<StorageManagementResult<ListAccessibleStorageInstancesResult>> {
    try {
      await this.requireAllowedPolicyAction(
        StoragePolicyActions.listAccessible,
        query.actorUserIdentityId,
        query.workspaceId,
        undefined,
        query.occurredAt,
      );

      const listed = await this.dependencies.repository.listStorageInstances({
        workspaceId: query.workspaceId,
        backendTypes: query.backendTypes,
        lifecycleStates: query.lifecycleStates,
        accessModes: query.accessModes,
        accessScopes: query.accessScopes,
        limit: query.limit,
        offset: query.offset,
      });
      const accessibleIds = await this.dependencies.policyPort.resolveAccessibleStorageInstanceIds({
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
          storageInstance: this.normalizeStorageInstance(storageInstance),
          accessSummary: this.buildAccessSummary(storageInstance, query.actorUserIdentityId, StorageManagedActions.view, {
            allowed: true,
            reasonCode: "accessible-list-membership",
          }),
          capabilities: await this.inspectCapabilitiesIfRequested(query.includeCapabilities ?? false, storageInstance),
        }));
      }

      await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
        type: StorageManagementAuditEventTypes.storageAccessListed,
        actorUserIdentityId: query.actorUserIdentityId,
        workspaceId: query.workspaceId,
        occurredAt: query.occurredAt ?? new Date().toISOString(),
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
    } catch (error) {
      return this.failureFromError(error, "Storage list failed.");
    }
  }

  public async getStorageInstanceDetails(
    query: GetStorageInstanceDetailsQuery,
  ): Promise<StorageManagementResult<GetStorageInstanceDetailsResult>> {
    try {
      const storageInstance = await this.requireStorageInstance(query.storageInstanceId, query.workspaceId);
      const decision = await this.requireAllowedPolicyAction(
        StoragePolicyActions.getDetails,
        query.actorUserIdentityId,
        query.workspaceId,
        storageInstance,
        query.occurredAt,
      );

      await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
        type: StorageManagementAuditEventTypes.storageDetailQueried,
        actorUserIdentityId: query.actorUserIdentityId,
        workspaceId: query.workspaceId,
        storageInstanceId: storageInstance.id,
        occurredAt: query.occurredAt ?? new Date().toISOString(),
        outcome: "success",
      });

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: this.normalizeStorageInstance(storageInstance),
          accessSummary: await this.createAccessSummary(
            storageInstance,
            query.actorUserIdentityId,
            StorageManagedActions.view,
            decision,
          ),
          capabilities: await this.inspectCapabilitiesIfRequested(
            query.includeCapabilities ?? false,
            storageInstance,
          ),
        }),
      };
    } catch (error) {
      return this.failureFromError(error, "Storage detail query failed.");
    }
  }

  public async inspectStorageInstanceStatus(
    query: InspectStorageInstanceStatusQuery,
  ): Promise<StorageManagementResult<InspectStorageInstanceStatusResult>> {
    try {
      const storageInstance = await this.requireStorageInstance(query.storageInstanceId, query.workspaceId);
      const decision = await this.requireAllowedPolicyAction(
        StoragePolicyActions.getDetails,
        query.actorUserIdentityId,
        query.workspaceId,
        storageInstance,
        query.occurredAt,
      );
      const occurredAt = query.occurredAt ?? new Date().toISOString();
      const capabilities = await this.inspectCapabilitiesIfRequested(true, storageInstance);
      const inspected = this.deriveOperationalInspection(storageInstance, capabilities, occurredAt);

      await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
        type: StorageManagementAuditEventTypes.storageDetailQueried,
        actorUserIdentityId: query.actorUserIdentityId,
        workspaceId: query.workspaceId,
        storageInstanceId: storageInstance.id,
        occurredAt,
        outcome: "success",
      });

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: this.normalizeStorageInstance(storageInstance),
          accessSummary: await this.createAccessSummary(
            storageInstance,
            query.actorUserIdentityId,
            StorageManagedActions.view,
            decision,
          ),
          capabilities,
          lifecycleState: storageInstance.lifecycleState,
          operationalStatus: inspected.status,
          lastCheckedAt: inspected.lastCheckedAt,
          reasonCode: inspected.reasonCode,
          operationalNotes: inspected.notes,
        }),
      };
    } catch (error) {
      return this.failureFromError(error, "Storage inspection failed.");
    }
  }

  private async transitionStorageLifecycle(
    command: ActivateStorageInstanceCommand | DeactivateStorageInstanceCommand,
    nextState: StorageInstance["lifecycleState"],
    action: StoragePolicyAction,
  ): Promise<StorageManagementResult<StorageLifecycleMutationResult>> {
    try {
      const current = await this.requireStorageInstance(command.storageInstanceId, command.workspaceId);
      const occurredAt = "activatedAt" in command ? command.activatedAt : command.deactivatedAt;
      const decision = await this.requireAllowedPolicyAction(
        action,
        command.actorUserIdentityId,
        command.workspaceId,
        current,
        occurredAt,
      );

      let transitioned: StorageInstance;
      try {
        transitioned = transitionStorageLifecycle(current, nextState, createStorageAttribution({
          actorUserIdentityId: command.actorUserIdentityId,
          occurredAt,
          correlationId: command.correlationId,
        }));
      } catch (error) {
        if (error instanceof StorageLifecycleTransitionError) {
          throw new StorageInvalidLifecycleTransitionError(current.id, current.lifecycleState, nextState, {
            cause: error,
          });
        }
        throw error;
      }

      const shouldRequestProvisioning = "requestBackendActivation" in command
        ? (command.requestBackendActivation ?? false)
        : (command.requestBackendDeactivation ?? false);
      const operationKind = "requestBackendActivation" in command
        ? StorageProvisioningOperationKinds.activate
        : StorageProvisioningOperationKinds.deactivate;
      const provisioning = await this.requestProvisioningIfRequested(
        shouldRequestProvisioning,
        operationKind,
        transitioned,
        command.actorUserIdentityId,
        command.correlationId,
        transitioned.lastModifiedAt,
      );

      const saved = await this.dependencies.repository.saveStorageInstance(transitioned, {
        operationKey: command.operationKey,
        actorUserIdentityId: command.actorUserIdentityId,
        occurredAt: transitioned.lastModifiedAt,
        correlationId: command.correlationId,
      });

      await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
        type: action === StoragePolicyActions.activate
          ? StorageManagementAuditEventTypes.storageActivated
          : StorageManagementAuditEventTypes.storageDeactivated,
        actorUserIdentityId: command.actorUserIdentityId,
        workspaceId: command.workspaceId,
        storageInstanceId: saved.storageInstance.id,
        correlationId: command.correlationId,
        occurredAt: saved.storageInstance.lastModifiedAt,
        outcome: saved.wasReplay ? "already-applied" : "success",
        details: Object.freeze({
          previousLifecycleState: current.lifecycleState,
          nextLifecycleState: saved.storageInstance.lifecycleState,
          requestedBackendProvisioning: shouldRequestProvisioning,
          provisioningStatus: provisioning?.status,
          provisioningReasonCode: provisioning?.reasonCode,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          storageInstance: this.normalizeStorageInstance(saved.storageInstance),
          accessSummary: await this.createAccessSummary(
            saved.storageInstance,
            command.actorUserIdentityId,
            action === StoragePolicyActions.activate ? StorageManagedActions.activate : StorageManagedActions.deactivate,
            decision,
          ),
          provisioning: this.normalizeProvisioning(provisioning),
          capabilities: await this.inspectCapabilitiesIfRequested(
            command.includeCapabilities ?? false,
            saved.storageInstance,
          ),
        }),
      };
    } catch (error) {
      return this.failureFromError(error, "Storage lifecycle transition failed.");
    }
  }

  private async requireStorageInstance(storageInstanceId: string, workspaceId: string): Promise<StorageInstance> {
    const current = await this.dependencies.repository.findStorageInstanceById(storageInstanceId);
    if (!current || current.ownership.workspaceId !== workspaceId) {
      throw new StorageInstanceNotFoundError(storageInstanceId, workspaceId);
    }
    return current;
  }

  private async requireAllowedPolicyAction(
    action: StoragePolicyAction,
    actorUserIdentityId: string,
    workspaceId: string,
    storageInstance?: StorageInstance,
    occurredAt?: string,
  ): Promise<StoragePolicyDecision> {
    const decision = await this.dependencies.policyPort.evaluateStorageAction({
      action,
      actorUserIdentityId,
      workspaceId,
      storageInstance,
      occurredAt,
    });

    if (!decision.allowed) {
      throw new StoragePolicyViolationError(
        decision.message ?? `Storage action '${action}' denied by policy.`,
        Object.freeze({
          action,
          actorUserIdentityId,
          workspaceId,
          storageInstanceId: storageInstance?.id,
          reasonCode: decision.reasonCode,
          decisionOccurredAt: decision.occurredAt,
          ...(decision.details ?? {}),
        }),
      );
    }

    return decision;
  }

  private async requestProvisioningIfRequested(
    shouldRequest: boolean,
    operationKind: StorageProvisioningOperationKind,
    storageInstance: StorageInstance,
    actorUserIdentityId: string,
    correlationId?: string,
    occurredAt?: string,
  ): Promise<StorageProvisioningReceipt | undefined> {
    if (!shouldRequest) {
      return undefined;
    }

    if (!this.dependencies.provisioningPort) {
      throw new StorageBackendOperationUnsupportedError(operationKind, storageInstance.backendType, {
        reasonCode: "storage-backend-not-configured",
      });
    }

    const receipt = await this.dependencies.provisioningPort.requestStorageProvisioning({
      operationKind,
      storageInstance,
      actorUserIdentityId,
      correlationId,
      occurredAt,
    });

    if (receipt.accepted) {
      return receipt;
    }

    if (this.isUnsupportedProvisioningReason(receipt.reasonCode)) {
      throw new StorageBackendOperationUnsupportedError(operationKind, storageInstance.backendType, {
        reasonCode: receipt.reasonCode,
      });
    }

    throw new StorageManagementServiceError(
      StorageManagementErrorCodes.provisioningFailed,
      receipt.message ?? `Storage provisioning '${operationKind}' failed for storage '${storageInstance.id}'.`,
      Object.freeze({
        storageInstanceId: storageInstance.id,
        operationKind,
        reasonCode: receipt.reasonCode,
        provisioningStatus: receipt.status,
        backendRequestId: receipt.backendRequestId,
      }),
    );
  }

  private isUnsupportedProvisioningReason(reasonCode: string | undefined): boolean {
    if (!reasonCode) {
      return false;
    }
    const normalized = reasonCode.toLowerCase();
    return UnsupportedProvisioningReasonCodeFragments.some((fragment) => normalized.includes(fragment));
  }

  private async inspectCapabilitiesIfRequested(
    shouldInspect: boolean,
    storageInstance: StorageInstance,
  ): Promise<StorageBackendCapabilitySnapshot | undefined> {
    if (!shouldInspect || !this.dependencies.capabilityPort) {
      return undefined;
    }

    if (this.dependencies.capabilityPort.inspectStorageInstanceCapabilities) {
      const capabilities = await this.dependencies.capabilityPort.inspectStorageInstanceCapabilities({
        storageInstance,
      });
      return this.normalizeCapabilities(capabilities);
    }

    const capabilities = await this.dependencies.capabilityPort.inspectStorageBackendCapabilities({
      backendType: storageInstance.backendType,
      workspaceId: storageInstance.ownership.workspaceId,
      requestedReplicationMode: storageInstance.replication.mode,
    });
    return this.normalizeCapabilities(capabilities);
  }

  private async createAccessSummary(
    storageInstance: StorageInstance,
    actorUserIdentityId: string,
    evaluatedAction: typeof StorageManagedActions[keyof typeof StorageManagedActions],
    evaluatedDecision: Pick<StoragePolicyDecision, "allowed" | "reasonCode" | "message">,
  ): Promise<StorageInstanceAccessSummary> {
    return this.buildAccessSummary(storageInstance, actorUserIdentityId, evaluatedAction, evaluatedDecision);
  }

  private buildAccessSummary(
    storageInstance: StorageInstance,
    actorUserIdentityId: string,
    evaluatedAction: typeof StorageManagedActions[keyof typeof StorageManagedActions],
    evaluatedDecision: Pick<StoragePolicyDecision, "allowed" | "reasonCode" | "message">,
  ): StorageInstanceAccessSummary {
    const permissions = Object.freeze(Object.values(StorageManagedActions).map((action) => Object.freeze({
      action,
      effect: action === evaluatedAction
        ? (evaluatedDecision.allowed ? "allowed" as const : "denied" as const)
        : "unknown" as const,
      reasonCode: action === evaluatedAction ? evaluatedDecision.reasonCode : undefined,
      message: action === evaluatedAction ? evaluatedDecision.message : undefined,
    })));

    const allowedActions = Object.freeze(permissions
      .filter((permission) => permission.effect === "allowed")
      .map((permission) => permission.action));

    const policyRestrictedCapabilities = Object.freeze([
      Object.freeze({
        capability: StoragePolicyRestrictedCapabilities.mutableWrites,
        restricted: storageInstance.policy.immutableWrites,
        reasonCode: storageInstance.policy.immutableWrites ? "immutable-writes-enforced" : undefined,
      }),
      Object.freeze({
        capability: StoragePolicyRestrictedCapabilities.crossWorkspaceReads,
        restricted: !storageInstance.policy.allowCrossWorkspaceReads,
        reasonCode: !storageInstance.policy.allowCrossWorkspaceReads ? "cross-workspace-reads-disabled" : undefined,
      }),
      Object.freeze({
        capability: StoragePolicyRestrictedCapabilities.previewDecryption,
        restricted: !storageInstance.policy.security.allowPreviewDecryption,
        reasonCode: !storageInstance.policy.security.allowPreviewDecryption ? "preview-decryption-disabled" : undefined,
      }),
      Object.freeze({
        capability: StoragePolicyRestrictedCapabilities.workerDecryption,
        restricted: !storageInstance.policy.security.allowWorkerDecryption,
        reasonCode: !storageInstance.policy.security.allowWorkerDecryption ? "worker-decryption-disabled" : undefined,
      }),
    ]);

    return Object.freeze({
      workspaceId: storageInstance.ownership.workspaceId,
      ownerUserIdentityId: storageInstance.ownership.ownerUserIdentityId,
      actorUserIdentityId,
      mode: storageInstance.access.mode,
      scope: storageInstance.access.scope,
      isOwner: storageInstance.ownership.ownerUserIdentityId === actorUserIdentityId,
      source: "authorization-policy",
      effectivePermissions: permissions,
      allowedActions,
      policyRestrictedCapabilities,
    });
  }

  private normalizeStorageInstance(storageInstance: StorageInstance): StorageInstance {
    return Object.freeze({
      ...storageInstance,
      ownership: Object.freeze({ ...storageInstance.ownership }),
      access: Object.freeze({ ...storageInstance.access }),
      replication: Object.freeze({ ...storageInstance.replication }),
      policy: Object.freeze({
        ...storageInstance.policy,
        labels: Object.freeze({ ...storageInstance.policy.labels }),
        encryption: Object.freeze({ ...storageInstance.policy.encryption }),
        security: Object.freeze({ ...storageInstance.policy.security }),
        lifecycle: Object.freeze({ ...storageInstance.policy.lifecycle }),
      }),
    });
  }

  private normalizeCapabilities(
    capabilities: StorageBackendCapabilitySnapshot | undefined,
  ): StorageBackendCapabilitySnapshot | undefined {
    if (!capabilities) {
      return undefined;
    }

    return Object.freeze({
      ...capabilities,
      notes: capabilities.notes ? Object.freeze([...capabilities.notes]) : undefined,
      health: capabilities.health
        ? Object.freeze({
          ...capabilities.health,
          notes: capabilities.health.notes ? Object.freeze([...capabilities.health.notes]) : undefined,
        })
        : undefined,
    });
  }

  private deriveOperationalInspection(
    storageInstance: StorageInstance,
    capabilities: StorageBackendCapabilitySnapshot | undefined,
    occurredAt: string,
  ): {
    readonly status: typeof StorageBackendHealthStatuses[keyof typeof StorageBackendHealthStatuses];
    readonly reasonCode: string;
    readonly lastCheckedAt: string;
    readonly notes: ReadonlyArray<string>;
  } {
    const lifecycleState = storageInstance.lifecycleState;
    const derivedAt = capabilities?.health?.checkedAt ?? occurredAt;
    const capabilityHealth = capabilities?.health;
    const noteSet = new Set<string>([
      ...(capabilities?.notes ?? []),
      ...(capabilityHealth?.notes ?? []),
    ]);
    const notes = Object.freeze([...noteSet]);

    if (!capabilities || !capabilities.supportsManagedLifecycle) {
      return Object.freeze({
        status: StorageBackendHealthStatuses.unsupported,
        reasonCode: capabilityHealth?.reasonCode ?? "storage-capability-inspection-unavailable",
        lastCheckedAt: derivedAt,
        notes,
      });
    }

    if (lifecycleState === StorageLifecycleStates.failed || lifecycleState === StorageLifecycleStates.degraded) {
      return Object.freeze({
        status: StorageBackendHealthStatuses.unhealthy,
        reasonCode: "storage-lifecycle-unhealthy",
        lastCheckedAt: derivedAt,
        notes,
      });
    }

    if (
      lifecycleState === StorageLifecycleStates.suspended
      || lifecycleState === StorageLifecycleStates.archived
      || lifecycleState === StorageLifecycleStates.deleting
      || lifecycleState === StorageLifecycleStates.deleted
      || lifecycleState === StorageLifecycleStates.provisioning
    ) {
      return Object.freeze({
        status: StorageBackendHealthStatuses.inactive,
        reasonCode: "storage-lifecycle-inactive",
        lastCheckedAt: derivedAt,
        notes,
      });
    }

    if (capabilityHealth) {
      return Object.freeze({
        status: capabilityHealth.status,
        reasonCode: capabilityHealth.reasonCode,
        lastCheckedAt: capabilityHealth.checkedAt,
        notes,
      });
    }

    return Object.freeze({
      status: StorageBackendHealthStatuses.healthy,
      reasonCode: "storage-operational",
      lastCheckedAt: derivedAt,
      notes,
    });
  }

  private normalizeProvisioning(
    provisioning: StorageProvisioningReceipt | undefined,
  ): StorageProvisioningReceipt | undefined {
    if (!provisioning) {
      return undefined;
    }

    return Object.freeze({ ...provisioning });
  }

  private failureFromError<TValue>(
    error: unknown,
    fallbackMessage: string,
  ): StorageManagementResult<TValue> {
    if (error instanceof StorageManagementServiceError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    if (error instanceof StorageLifecycleTransitionError) {
      return {
        ok: false,
        error: {
          code: StorageManagementErrorCodes.invalidState,
          message: error.message,
        },
      };
    }

    if (error instanceof StorageDomainError) {
      return {
        ok: false,
        error: {
          code: StorageManagementErrorCodes.invalidRequest,
          message: error.message,
        },
      };
    }

    const message = error instanceof Error ? error.message : fallbackMessage;
    return {
      ok: false,
      error: {
        code: StorageManagementErrorCodes.internal,
        message,
      },
    };
  }

  private didStoragePolicyChange(previous: StorageInstance, current: StorageInstance): boolean {
    return JSON.stringify(previous.policy) !== JSON.stringify(current.policy);
  }

  private buildStorageMetadataAuditDetails(
    previous: StorageInstance,
    current: StorageInstance,
  ): Readonly<Record<string, unknown>> {
    const changedMetadataFields: string[] = [];
    if (previous.displayName !== current.displayName) {
      changedMetadataFields.push("displayName");
    }
    if (JSON.stringify(previous.policy.labels) !== JSON.stringify(current.policy.labels)) {
      changedMetadataFields.push("policy.labels");
    }

    return Object.freeze({
      changedMetadataFields: Object.freeze(changedMetadataFields),
      previousDisplayName: previous.displayName,
      currentDisplayName: current.displayName,
      changedPolicyLabelKeys: this.computeChangedLabelKeys(previous.policy.labels, current.policy.labels),
      policyChanged: this.didStoragePolicyChange(previous, current),
    });
  }

  private buildStoragePolicyAuditDetails(
    previous: StorageInstance,
    current: StorageInstance,
  ): Readonly<Record<string, unknown>> {
    return Object.freeze({
      policyId: current.policy.policyId,
      changedPolicyLabelKeys: this.computeChangedLabelKeys(previous.policy.labels, current.policy.labels),
      previousPolicySummary: this.toPolicyAuditSummary(previous),
      currentPolicySummary: this.toPolicyAuditSummary(current),
    });
  }

  private computeChangedLabelKeys(
    previous: Readonly<Record<string, string>>,
    current: Readonly<Record<string, string>>,
  ): ReadonlyArray<string> {
    const keys = new Set<string>([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    return Object.freeze([...keys]
      .filter((key) => previous[key] !== current[key])
      .sort((a, b) => a.localeCompare(b)));
  }

  private toPolicyAuditSummary(storageInstance: StorageInstance): Readonly<Record<string, unknown>> {
    const policy = storageInstance.policy;
    return Object.freeze({
      policyId: policy.policyId,
      labelKeys: Object.freeze(Object.keys(policy.labels).sort()),
      maxObjectBytes: policy.maxObjectBytes,
      retentionDays: policy.retentionDays,
      immutableWrites: policy.immutableWrites,
      allowCrossWorkspaceReads: policy.allowCrossWorkspaceReads,
      encryptionProfileId: policy.encryption.profileId,
      envelopeRequired: policy.encryption.envelopeRequired,
      hasEncryptionKeyReferenceId: Boolean(policy.encryption.keyReferenceId),
      security: Object.freeze({
        encryptionMode: policy.security.encryptionMode,
        contentEncryptionRequired: policy.security.contentEncryptionRequired,
        keyScope: policy.security.keyScope,
        allowPreviewDecryption: policy.security.allowPreviewDecryption,
        allowWorkerDecryption: policy.security.allowWorkerDecryption,
      }),
      lifecycle: Object.freeze({
        retentionExpiryAction: policy.lifecycle.retentionExpiryAction,
        purgeGracePeriodDays: policy.lifecycle.purgeGracePeriodDays,
      }),
    });
  }
}
