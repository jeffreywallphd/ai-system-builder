import {
  StorageDomainError,
  StorageLifecycleStates,
  createStorageAttribution,
  createStorageInstance,
  transitionStorageLifecycle,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
import type { IStorageCapabilityInspectionPort } from "../ports/StorageCapabilityInspectionPort";
import type { IStorageInstanceRepository } from "../ports/IStorageInstanceRepository";
import {
  StorageManagementAuditEventTypes,
  publishStorageManagementAuditEventBestEffort,
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
} from "../ports/StorageProvisioningPort";
import {
  StorageManagementErrorCodes,
  type CreateStorageInstanceCommand,
  type CreateStorageInstanceResult,
  type StorageManagementResult,
} from "./StorageManagementServiceContracts";

export interface CreateStorageInstanceWithProvisioningUseCaseDependencies {
  readonly repository: IStorageInstanceRepository;
  readonly policyPort: IStoragePolicyEvaluationPort;
  readonly provisioningPort?: IStorageProvisioningPort;
  readonly capabilityPort?: IStorageCapabilityInspectionPort;
  readonly auditSink?: StorageManagementAuditSink;
}

export class CreateStorageInstanceWithProvisioningUseCase {
  public constructor(
    private readonly dependencies: CreateStorageInstanceWithProvisioningUseCaseDependencies,
  ) {}

  public async execute(
    command: CreateStorageInstanceCommand,
  ): Promise<StorageManagementResult<CreateStorageInstanceResult>> {
    const occurredAt = command.createdAt ?? new Date().toISOString();
    const auditContext = this.buildCreateAuditContext(command);
    const policyDecision = await this.dependencies.policyPort.evaluateStorageAction({
      action: StoragePolicyActions.create,
      actorUserIdentityId: command.actorUserIdentityId,
      workspaceId: command.workspaceId,
      occurredAt,
    });
    if (!policyDecision.allowed) {
      await this.publishAudit(command, undefined, "rejected", {
        ...auditContext,
        reasonCode: policyDecision.reasonCode,
      });
      return this.failure(
        StorageManagementErrorCodes.accessDenied,
        policyDecision.message ?? "Storage create denied.",
      );
    }

    try {
      const requestedProvisioning = command.requestBackendProvisioning ?? false;
      let storageInstance = createStorageInstance({
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
        lifecycleState: requestedProvisioning
          ? StorageLifecycleStates.provisioning
          : command.lifecycleState,
        createdBy: command.actorUserIdentityId,
        createdAt: occurredAt,
        lastCorrelationId: command.correlationId,
      });

      let provisioning: StorageProvisioningReceipt | undefined;
      if (requestedProvisioning) {
        if (!this.dependencies.provisioningPort) {
          return this.failure(
            StorageManagementErrorCodes.invalidRequest,
            "Storage provisioning was requested but no provisioning port is configured.",
          );
        }

        provisioning = await this.dependencies.provisioningPort.requestStorageProvisioning({
          operationKind: StorageProvisioningOperationKinds.create,
          storageInstance,
          actorUserIdentityId: command.actorUserIdentityId,
          correlationId: command.correlationId,
          occurredAt,
        });

        const attribution = createStorageAttribution({
          actorUserIdentityId: command.actorUserIdentityId,
          occurredAt: provisioning.occurredAt,
          correlationId: command.correlationId,
        });

        if (provisioning.accepted) {
          storageInstance = transitionStorageLifecycle(storageInstance, StorageLifecycleStates.active, attribution);
        } else {
          storageInstance = transitionStorageLifecycle(storageInstance, StorageLifecycleStates.failed, attribution);
        }
      }

      try {
        const created = await this.dependencies.repository.createStorageInstance(storageInstance, {
          operationKey: command.operationKey,
          actorUserIdentityId: command.actorUserIdentityId,
          occurredAt: storageInstance.lastModifiedAt,
          correlationId: command.correlationId,
        });

        const capabilities = await this.inspectCapabilitiesIfRequested(
          command.includeCapabilities ?? false,
          created.storageInstance,
        );

        if (provisioning && !provisioning.accepted) {
          await this.publishAudit(command, created.storageInstance.id, "rejected", {
            ...auditContext,
            reasonCode: provisioning.reasonCode,
            provisioningStatus: provisioning.status,
          });
          return this.failure(
            StorageManagementErrorCodes.provisioningFailed,
            provisioning.message ?? "Storage provisioning rejected by backend.",
            {
              reasonCode: provisioning.reasonCode,
              provisioningStatus: provisioning.status,
              storageInstanceId: created.storageInstance.id,
            },
          );
        }

        await this.publishAudit(
          command,
          created.storageInstance.id,
          created.wasReplay ? "already-applied" : "success",
          {
            ...auditContext,
            createdLifecycleState: created.storageInstance.lifecycleState,
            ...(provisioning ? {
              provisioningStatus: provisioning.status,
              provisioningReasonCode: provisioning.reasonCode,
            } : {}),
          },
        );

        return {
          ok: true,
          value: Object.freeze({
            storageInstance: created.storageInstance,
            provisioning,
            capabilities,
          }),
        };
      } catch (error) {
        if (provisioning?.accepted && this.dependencies.provisioningPort) {
          await this.attemptCompensatingDeactivation(
            storageInstance,
            command.actorUserIdentityId,
            command.correlationId,
            provisioning.occurredAt,
          );
        }
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage create failed.";
      const code = this.mapErrorCode(error);
      return this.failure(code, message);
    }
  }

  private async attemptCompensatingDeactivation(
    storageInstance: StorageInstance,
    actorUserIdentityId: string,
    correlationId?: string,
    occurredAt?: string,
  ): Promise<void> {
    try {
      await this.dependencies.provisioningPort?.requestStorageProvisioning({
        operationKind: StorageProvisioningOperationKinds.deactivate,
        storageInstance,
        actorUserIdentityId,
        correlationId,
        occurredAt,
      });
    } catch {
      // Best-effort compensating deactivation.
    }
  }

  private async inspectCapabilitiesIfRequested(
    shouldInspect: boolean,
    storageInstance: StorageInstance,
  ) {
    if (!shouldInspect || !this.dependencies.capabilityPort) {
      return undefined;
    }

    if (this.dependencies.capabilityPort.inspectStorageInstanceCapabilities) {
      return this.dependencies.capabilityPort.inspectStorageInstanceCapabilities({
        storageInstance,
      });
    }

    return this.dependencies.capabilityPort.inspectStorageBackendCapabilities({
      backendType: storageInstance.backendType,
      workspaceId: storageInstance.ownership.workspaceId,
      requestedReplicationMode: storageInstance.replication.mode,
    });
  }

  private async publishAudit(
    command: CreateStorageInstanceCommand,
    storageInstanceId: string | undefined,
    outcome: "success" | "rejected" | "already-applied",
    details?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await publishStorageManagementAuditEventBestEffort(this.dependencies.auditSink, {
      type: StorageManagementAuditEventTypes.storageCreated,
      actorUserIdentityId: command.actorUserIdentityId,
      workspaceId: command.workspaceId,
      storageInstanceId,
      correlationId: command.correlationId,
      occurredAt: command.createdAt ?? new Date().toISOString(),
      outcome,
      details,
    });
  }

  private mapErrorCode(error: unknown): typeof StorageManagementErrorCodes[keyof typeof StorageManagementErrorCodes] {
    if (error instanceof StorageDomainError) {
      return StorageManagementErrorCodes.invalidRequest;
    }

    if (error instanceof Error && /conflict/i.test(error.message)) {
      return StorageManagementErrorCodes.conflict;
    }

    if (error instanceof Error && /provision/i.test(error.message)) {
      return StorageManagementErrorCodes.provisioningFailed;
    }

    return StorageManagementErrorCodes.internal;
  }

  private failure(
    code: typeof StorageManagementErrorCodes[keyof typeof StorageManagementErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): StorageManagementResult<CreateStorageInstanceResult> {
    return {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  private buildCreateAuditContext(command: CreateStorageInstanceCommand): Readonly<Record<string, unknown>> {
    return Object.freeze({
      backendType: command.backendType,
      ownerUserIdentityId: command.ownerUserIdentityId,
      accessMode: command.access.mode,
      accessScope: command.access.scope,
      replicationMode: command.replication?.mode ?? "none",
      policyId: command.policy.policyId,
      policyLabelKeys: Object.freeze(Object.keys(command.policy.labels ?? {}).sort()),
      encryptionProfileId: command.policy.encryption.profileId,
      envelopeRequired: command.policy.encryption.envelopeRequired,
      hasEncryptionKeyReferenceId: Boolean(command.policy.encryption.keyReferenceId),
      security: Object.freeze({
        encryptionMode: command.policy.security?.encryptionMode ?? "platform-managed",
        contentEncryptionRequired: command.policy.security?.contentEncryptionRequired ?? true,
        keyScope: command.policy.security?.keyScope ?? "workspace",
        allowPreviewDecryption: command.policy.security?.allowPreviewDecryption ?? false,
        allowWorkerDecryption: command.policy.security?.allowWorkerDecryption ?? false,
      }),
      lifecycle: Object.freeze({
        retentionExpiryAction: command.policy.lifecycle?.retentionExpiryAction ?? "none",
        purgeGracePeriodDays: command.policy.lifecycle?.purgeGracePeriodDays,
      }),
      requestedLifecycleState: command.requestBackendProvisioning
        ? StorageLifecycleStates.provisioning
        : (command.lifecycleState ?? StorageLifecycleStates.active),
      requestedBackendProvisioning: command.requestBackendProvisioning ?? false,
    });
  }
}

export function isStorageProvisioningAccepted(receipt: StorageProvisioningReceipt | undefined): boolean {
  if (!receipt) {
    return false;
  }
  return receipt.status === StorageProvisioningOperationStatuses.accepted
    || receipt.status === StorageProvisioningOperationStatuses.alreadyApplied;
}
