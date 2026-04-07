import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityMutationOutcome,
  type IdentityOperationError,
  type IdentityOperationResult,
  type TrustedDeviceRevocationRequest,
} from "@application/contracts/IdentityApplicationContracts";
import type { ITrustedDeviceManagementService } from "@application/identity/ports/ITrustedDeviceManagementService";

export type RevokeTrustedDeviceErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidState
  | typeof IdentityErrorCodes.notFound;

interface RevokeTrustedDeviceUseCaseDependencies {
  readonly trustedDeviceManagementService: Pick<ITrustedDeviceManagementService, "revokeTrustedDevice">;
}

export class RevokeTrustedDeviceUseCase {
  public constructor(private readonly dependencies: RevokeTrustedDeviceUseCaseDependencies) {}

  public async execute(
    input: TrustedDeviceRevocationRequest,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, RevokeTrustedDeviceErrorCode>> {
    const trustedDeviceId = normalizeRequired(input.trustedDeviceId);
    if (!trustedDeviceId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "trustedDeviceId is required.");
    }

    const result = await this.dependencies.trustedDeviceManagementService.revokeTrustedDevice({
      ...input,
      trustedDeviceId,
    });
    if (!result.ok) {
      return identityFailure(result.error);
    }

    return identitySuccess(result.value);
  }

  private failure<TValue, TCode extends RevokeTrustedDeviceErrorCode>(
    code: TCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): IdentityOperationResult<TValue, TCode> {
    const error: IdentityOperationError<TCode> = Object.freeze({
      code,
      message,
      boundary: IdentityErrorBoundaries.application,
      retryable: false,
      details,
    });
    return identityFailure(error);
  }
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

