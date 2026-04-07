import type { TrustedDevice } from "@domain/identity/TrustedDeviceDomain";
import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDeviceListQuery,
  TrustedDeviceLookupByFingerprintQuery,
  TrustedDeviceRevocationRequest,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";

export interface ITrustedDeviceRepository {
  createTrustedDevice(device: TrustedDevice): Promise<TrustedDevice>;
  getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDevice | undefined>;
  findTrustedDeviceByFingerprint(query: TrustedDeviceLookupByFingerprintQuery): Promise<TrustedDevice | undefined>;
  listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDevice>>;
  updateTrustedDevice(device: TrustedDevice): Promise<TrustedDevice>;
  revokeTrustedDevice(
    request: TrustedDeviceRevocationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  >;
}

