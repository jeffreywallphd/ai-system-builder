import { StorageDomainError } from "../../../domain/storage/StorageDomain";
import type { IStorageInstanceRepository } from "../ports/IStorageInstanceRepository";
import type { IStorageObjectAccessResolverPort } from "../ports/StorageObjectAccessResolverPort";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
  type StoragePolicyAction,
} from "../ports/StoragePolicyEvaluationPort";
import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
  type IStorageLogicalAccessResolutionService,
  type ResolveStorageLogicalAccessCommand,
  type StorageLogicalAccessOperationIntent,
  type StorageLogicalAccessResolutionPlan,
  type StorageLogicalAccessResolutionResult,
} from "./StorageLogicalAccessResolutionServiceContracts";

export interface StorageLogicalAccessResolutionServiceDependencies {
  readonly repository: IStorageInstanceRepository;
  readonly policyPort: IStoragePolicyEvaluationPort;
  readonly objectAccessResolver: IStorageObjectAccessResolverPort;
}

export class StorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public constructor(
    private readonly dependencies: StorageLogicalAccessResolutionServiceDependencies,
  ) {}

  public async resolveLogicalAccessPlan(
    command: ResolveStorageLogicalAccessCommand,
  ): Promise<StorageLogicalAccessResolutionResult<StorageLogicalAccessResolutionPlan>> {
    try {
      const occurredAt = command.occurredAt ?? new Date().toISOString();
      const actorUserIdentityId = this.requireField(command.actorUserIdentityId, "actorUserIdentityId");
      const workspaceId = this.requireField(command.workspaceId, "workspaceId");
      const storageInstanceId = this.resolveStorageInstanceId(command);
      const policyAction = this.mapIntentToPolicyAction(command.intent);

      const storageInstance = await this.dependencies.repository.findStorageInstanceById(storageInstanceId);
      if (!storageInstance || storageInstance.ownership.workspaceId !== workspaceId) {
        return {
          ok: false,
          error: {
            code: StorageLogicalAccessResolutionErrorCodes.notFound,
            message: `Storage instance '${storageInstanceId}' was not found in workspace '${workspaceId}'.`,
          },
        };
      }

      const decision = await this.dependencies.policyPort.evaluateStorageAction({
        action: policyAction,
        actorUserIdentityId,
        workspaceId,
        storageInstance,
        occurredAt,
      });
      if (!decision.allowed) {
        return {
          ok: false,
          error: {
            code: StorageLogicalAccessResolutionErrorCodes.policyViolation,
            message: decision.message ?? `Storage access intent '${command.intent}' was denied by policy.`,
            details: Object.freeze({
              intent: command.intent,
              action: policyAction,
              reasonCode: decision.reasonCode,
              decisionOccurredAt: decision.occurredAt,
              storageInstanceId: storageInstance.id,
              ...(decision.details ?? {}),
            }),
          },
        };
      }

      const objectPort = this.dependencies.objectAccessResolver.resolveStorageObjectPort(storageInstance.backendType);
      if (!objectPort) {
        return {
          ok: false,
          error: {
            code: StorageLogicalAccessResolutionErrorCodes.capabilityUnsupported,
            message: `Storage backend '${storageInstance.backendType}' does not expose logical object operations.`,
            details: Object.freeze({
              storageInstanceId: storageInstance.id,
              backendType: storageInstance.backendType,
            }),
          },
        };
      }

      return {
        ok: true,
        value: Object.freeze({
          intent: command.intent,
          storageInstance,
          objectPort,
          occurredAt,
        }),
      };
    } catch (error) {
      if (error instanceof StorageDomainError || error instanceof InputValidationError) {
        return {
          ok: false,
          error: {
            code: StorageLogicalAccessResolutionErrorCodes.invalidRequest,
            message: error.message,
          },
        };
      }

      if (error instanceof Error) {
        return {
          ok: false,
          error: {
            code: StorageLogicalAccessResolutionErrorCodes.internal,
            message: error.message,
          },
        };
      }

      return {
        ok: false,
        error: {
          code: StorageLogicalAccessResolutionErrorCodes.internal,
          message: "Storage logical access resolution failed.",
        },
      };
    }
  }

  private resolveStorageInstanceId(command: ResolveStorageLogicalAccessCommand): string {
    if (command.storageInstanceRef) {
      return parseStorageInstanceRef(command.storageInstanceRef);
    }
    if (command.storageInstanceId) {
      return this.requireField(command.storageInstanceId, "storageInstanceId");
    }
    throw new InputValidationError("Either storageInstanceRef or storageInstanceId is required.");
  }

  private requireField(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new InputValidationError(`'${field}' is required.`);
    }
    return normalized;
  }

  private mapIntentToPolicyAction(intent: StorageLogicalAccessOperationIntent): StoragePolicyAction {
    switch (intent) {
      case StorageLogicalAccessOperationIntents.objectExists:
      case StorageLogicalAccessOperationIntents.readObjectMetadata:
      case StorageLogicalAccessOperationIntents.openObjectReadStream:
        return StoragePolicyActions.view;
      case StorageLogicalAccessOperationIntents.createObjectKey:
      case StorageLogicalAccessOperationIntents.writeObject:
      case StorageLogicalAccessOperationIntents.deleteObject:
        return StoragePolicyActions.useForAssets;
      default: {
        const exhaustiveCheck: never = intent;
        throw new InputValidationError(`Unsupported logical access intent '${String(exhaustiveCheck)}'.`);
      }
    }
  }
}

function parseStorageInstanceRef(reference: string): string {
  const normalized = reference.trim();
  if (!normalized) {
    throw new InputValidationError("'storageInstanceRef' is required.");
  }

  const match = /^storage-instance:\/\/([^/?#]+)$/.exec(normalized);
  if (!match) {
    throw new InputValidationError("Storage instance references must use 'storage-instance://<id>' format.");
  }

  const decoded = decodeURIComponent(match[1] ?? "").trim();
  if (!decoded) {
    throw new InputValidationError("Storage instance references must include a storage instance id.");
  }

  return decoded;
}

class InputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}
