import type { IStorageCapabilityInspectionPort } from "./StorageCapabilityInspectionPort";
import type { IStorageInstanceRepository } from "./IStorageInstanceRepository";
import type { StorageManagementAuditSink } from "./StorageObservabilityPorts";
import type { IStoragePolicyEvaluationPort } from "./StoragePolicyEvaluationPort";
import type { IStorageProvisioningPort } from "./StorageProvisioningPort";

export interface StorageManagementPorts {
  readonly storageInstanceRepository: IStorageInstanceRepository;
  readonly policyEvaluationPort: IStoragePolicyEvaluationPort;
  readonly provisioningPort?: IStorageProvisioningPort;
  readonly capabilityInspectionPort?: IStorageCapabilityInspectionPort;
  readonly auditSink?: StorageManagementAuditSink;
}
