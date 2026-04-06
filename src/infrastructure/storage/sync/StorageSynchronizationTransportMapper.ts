import type { StorageSynchronizationMetadataDto } from "../../../shared/contracts/storage/StorageTransportContracts";
import type { StorageSynchronizationStateSnapshot } from "./ServerManagedStorageSynchronizationAdapter";

export function toStorageSynchronizationMetadataDto(
  state: StorageSynchronizationStateSnapshot,
): StorageSynchronizationMetadataDto {
  return Object.freeze({
    syncCapable: state.syncCapable,
    supportsReplicationSyncOperation: state.supportsReplicationSyncOperation,
    deploymentAvailability: state.deploymentAvailability,
    reasonCode: state.reasonCode,
    evaluatedAt: state.evaluatedAt,
  });
}
