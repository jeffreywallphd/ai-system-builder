import type { StorageInstance } from "@domain/storage/StorageDomain";

export const StoragePolicyActions = Object.freeze({
  create: "create",
  view: "view",
  updateMetadata: "update-metadata",
  provision: "provision",
  activate: "activate",
  deactivate: "deactivate",
  useForAssets: "use-for-assets",
  getDetails: "get-details",
  listAccessible: "list-accessible",
});

export type StoragePolicyAction = typeof StoragePolicyActions[keyof typeof StoragePolicyActions];

export interface StoragePolicyDecision {
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

export interface StoragePolicyEvaluationRequest {
  readonly action: StoragePolicyAction;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly storageInstance?: Pick<StorageInstance, "id" | "ownership" | "lifecycleState" | "access">;
  readonly occurredAt?: string;
}

export interface StorageAccessibleInstanceResolutionRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly candidateStorageInstanceIds: ReadonlyArray<string>;
  readonly occurredAt?: string;
}

export interface IStoragePolicyEvaluationPort {
  evaluateStorageAction(input: StoragePolicyEvaluationRequest): Promise<StoragePolicyDecision>;
  resolveAccessibleStorageInstanceIds(
    input: StorageAccessibleInstanceResolutionRequest,
  ): Promise<ReadonlyArray<string>>;
}

