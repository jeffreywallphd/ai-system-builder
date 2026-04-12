import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDevicePairingInvalidationRequest,
  TrustedDevicePairingTokenRecord,
  TrustedDevicePairingSessionRecord,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";

export interface ITrustedDevicePairingRepository {
  createPairingSession(session: TrustedDevicePairingSessionRecord): Promise<TrustedDevicePairingSessionRecord>;
  createPairingToken(token: TrustedDevicePairingTokenRecord): Promise<TrustedDevicePairingTokenRecord>;
  getPairingSessionById(pairingSessionId: string): Promise<TrustedDevicePairingSessionRecord | undefined>;
  getPairingTokenById(pairingTokenId: string): Promise<TrustedDevicePairingTokenRecord | undefined>;
  getPairingTokenBySessionId(pairingSessionId: string): Promise<TrustedDevicePairingTokenRecord | undefined>;
  updatePairingSession(session: TrustedDevicePairingSessionRecord): Promise<TrustedDevicePairingSessionRecord>;
  updatePairingToken(token: TrustedDevicePairingTokenRecord): Promise<TrustedDevicePairingTokenRecord>;
  invalidatePairingArtifacts(
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
