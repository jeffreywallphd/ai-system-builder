import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDevicePairingCompletionRequest,
  TrustedDevicePairingCompletionResponse,
  TrustedDevicePairingExpirationRequest,
  TrustedDevicePairingExpirationResult,
  TrustedDevicePairingInitiationRequest,
  TrustedDevicePairingInitiationResponse,
  TrustedDevicePairingInvalidationRequest,
  TrustedDevicePairingValidationRequest,
  TrustedDevicePairingValidationResponse,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";

export interface ITrustedDevicePairingService {
  initiatePairing(request: TrustedDevicePairingInitiationRequest): Promise<TrustedDevicePairingInitiationResponse>;
  validatePairingToken(request: TrustedDevicePairingValidationRequest): Promise<TrustedDevicePairingValidationResponse>;
  completePairing(request: TrustedDevicePairingCompletionRequest): Promise<TrustedDevicePairingCompletionResponse>;
  expirePairingAttempts(request: TrustedDevicePairingExpirationRequest): Promise<TrustedDevicePairingExpirationResult>;
  invalidatePairing(
    request: TrustedDevicePairingInvalidationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  >;
}
