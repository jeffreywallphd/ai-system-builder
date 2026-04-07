import type { IdentityOperationResult } from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";

export interface IdentityCredentialResetVerificationInput {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly resetAssertion: string;
}

export interface IdentityCredentialResetVerificationResult {
  readonly verificationId: string;
  readonly verifiedAt: string;
}

export interface IIdentityCredentialResetVerifier {
  verifyResetAssertion(
    input: IdentityCredentialResetVerificationInput,
  ): Promise<IdentityOperationResult<
    IdentityCredentialResetVerificationResult,
    | typeof IdentityErrorCodes.invalidCredentials
    | typeof IdentityErrorCodes.invalidRequest
    | typeof IdentityErrorCodes.notFound
    | typeof IdentityErrorCodes.invalidState
  >>;
}
