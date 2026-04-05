import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDeviceDisplayNameUpdate,
  TrustedDeviceLastSeenUpdate,
  TrustedDeviceListQuery,
  TrustedDevicePairingRequest,
  TrustedDeviceRecord,
  TrustedDeviceRegistrationRequest,
  TrustedDeviceRevocationRequest,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";

export interface ITrustedDeviceManagementService {
  registerTrustedDevice(request: TrustedDeviceRegistrationRequest): Promise<TrustedDeviceRecord>;
  getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDeviceRecord | undefined>;
  listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDeviceRecord>>;
  pairTrustedDevice(request: TrustedDevicePairingRequest): Promise<TrustedDeviceRecord>;
  updateTrustedDeviceDisplayName(request: TrustedDeviceDisplayNameUpdate): Promise<TrustedDeviceRecord>;
  recordTrustedDeviceLastSeen(request: TrustedDeviceLastSeenUpdate): Promise<TrustedDeviceRecord>;
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
