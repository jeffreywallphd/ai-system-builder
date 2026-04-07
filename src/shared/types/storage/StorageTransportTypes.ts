export const StorageTransportOperations = Object.freeze({
  create: "create-storage-instance",
  update: "update-storage-instance",
  list: "list-storage-instances",
  detail: "get-storage-instance-detail",
});

export type StorageTransportOperation =
  typeof StorageTransportOperations[keyof typeof StorageTransportOperations];

export interface StorageTransportPagination {
  readonly limit?: number;
  readonly offset?: number;
}

export interface StorageTransportMutationEnvelope {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
}
