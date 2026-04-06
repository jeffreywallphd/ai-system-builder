import type { IStorageCapabilityInspectionPort } from "../../application/storage/ports/StorageCapabilityInspectionPort";
import type { IStorageProvisioningPort } from "../../application/storage/ports/StorageProvisioningPort";
import type { StorageBackendType } from "../../domain/storage/StorageDomain";

export interface StorageBackendAdapterRegistration {
  readonly backendType: StorageBackendType;
  readonly provisioningPort: IStorageProvisioningPort;
  readonly capabilityInspectionPort?: IStorageCapabilityInspectionPort;
}

export class StorageBackendAdapterRegistry {
  private readonly registrationsByBackendType: ReadonlyMap<StorageBackendType, StorageBackendAdapterRegistration>;

  public constructor(registrations: ReadonlyArray<StorageBackendAdapterRegistration>) {
    const normalized = new Map<StorageBackendType, StorageBackendAdapterRegistration>();
    for (const registration of registrations) {
      if (normalized.has(registration.backendType)) {
        throw new Error(`Storage backend '${registration.backendType}' is registered more than once.`);
      }
      normalized.set(registration.backendType, Object.freeze({
        backendType: registration.backendType,
        provisioningPort: registration.provisioningPort,
        capabilityInspectionPort: registration.capabilityInspectionPort,
      }));
    }

    this.registrationsByBackendType = normalized;
  }

  public getProvisioningPort(backendType: StorageBackendType): IStorageProvisioningPort | undefined {
    return this.registrationsByBackendType.get(backendType)?.provisioningPort;
  }

  public getCapabilityInspectionPort(backendType: StorageBackendType): IStorageCapabilityInspectionPort | undefined {
    return this.registrationsByBackendType.get(backendType)?.capabilityInspectionPort;
  }

  public listBackendTypes(): ReadonlyArray<StorageBackendType> {
    return Object.freeze([...this.registrationsByBackendType.keys()]);
  }
}

export function createStorageBackendAdapterRegistry(
  registrations: ReadonlyArray<StorageBackendAdapterRegistration>,
): StorageBackendAdapterRegistry {
  return new StorageBackendAdapterRegistry(registrations);
}
