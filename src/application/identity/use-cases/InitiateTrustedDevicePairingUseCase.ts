import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
  type TrustedDevicePairingInitiationRequest,
  type TrustedDevicePairingInitiationResponse,
} from "@application/contracts/IdentityApplicationContracts";
import type { ITrustedDevicePairingService } from "@application/identity/ports/ITrustedDevicePairingService";

export type InitiateTrustedDevicePairingErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.notFound
  | typeof IdentityErrorCodes.invalidState;

interface InitiateTrustedDevicePairingUseCaseDependencies {
  readonly pairingService: Pick<ITrustedDevicePairingService, "initiatePairing">;
}

export class InitiateTrustedDevicePairingUseCase {
  public constructor(private readonly dependencies: InitiateTrustedDevicePairingUseCaseDependencies) {}

  public async execute(
    request: TrustedDevicePairingInitiationRequest,
  ): Promise<IdentityOperationResult<TrustedDevicePairingInitiationResponse, InitiateTrustedDevicePairingErrorCode>> {
    try {
      const pairing = await this.dependencies.pairingService.initiatePairing(request);
      return identitySuccess(pairing);
    } catch (error) {
      return this.failure(resolveTrustedDeviceErrorCode(error), normalizeErrorMessage(error));
    }
  }

  private failure<TValue, TCode extends InitiateTrustedDevicePairingErrorCode>(
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

function resolveTrustedDeviceErrorCode(error: unknown): InitiateTrustedDevicePairingErrorCode {
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
  return "Trusted device pairing initiation failed.";
}

