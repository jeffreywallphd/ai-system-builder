import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
  type TrustedDevicePairingValidationRequest,
  type TrustedDevicePairingValidationResponse,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ITrustedDevicePairingService } from "../../../../application/identity/ports/ITrustedDevicePairingService";

export type ValidateTrustedDevicePairingErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.notFound
  | typeof IdentityErrorCodes.invalidState;

interface ValidateTrustedDevicePairingUseCaseDependencies {
  readonly pairingService: Pick<ITrustedDevicePairingService, "validatePairingToken">;
}

export class ValidateTrustedDevicePairingUseCase {
  public constructor(private readonly dependencies: ValidateTrustedDevicePairingUseCaseDependencies) {}

  public async execute(
    request: TrustedDevicePairingValidationRequest,
  ): Promise<IdentityOperationResult<TrustedDevicePairingValidationResponse, ValidateTrustedDevicePairingErrorCode>> {
    try {
      const validation = await this.dependencies.pairingService.validatePairingToken(request);
      return identitySuccess(validation);
    } catch (error) {
      return this.failure(resolveTrustedDeviceErrorCode(error), normalizeErrorMessage(error));
    }
  }

  private failure<TValue, TCode extends ValidateTrustedDevicePairingErrorCode>(
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

function resolveTrustedDeviceErrorCode(error: unknown): ValidateTrustedDevicePairingErrorCode {
  const message = normalizeErrorMessage(error).toLowerCase();
  if (message.includes("not found")) {
    return IdentityErrorCodes.notFound;
  }
  if (message.includes("invalid")) {
    return IdentityErrorCodes.invalidState;
  }
  return IdentityErrorCodes.invalidRequest;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Trusted device pairing validation failed.";
}
