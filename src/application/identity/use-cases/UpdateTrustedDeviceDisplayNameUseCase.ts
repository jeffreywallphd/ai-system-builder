import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
  type TrustedDeviceDisplayNameUpdate,
  type TrustedDeviceRecord,
} from "@application/contracts/IdentityApplicationContracts";
import type { ITrustedDeviceManagementService } from "@application/identity/ports/ITrustedDeviceManagementService";

export type UpdateTrustedDeviceDisplayNameErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.notFound
  | typeof IdentityErrorCodes.invalidState;

interface UpdateTrustedDeviceDisplayNameUseCaseDependencies {
  readonly trustedDeviceManagementService: Pick<ITrustedDeviceManagementService, "updateTrustedDeviceDisplayName">;
}

export interface UpdateTrustedDeviceDisplayNameResult {
  readonly trustedDevice: TrustedDeviceRecord;
}

export class UpdateTrustedDeviceDisplayNameUseCase {
  public constructor(private readonly dependencies: UpdateTrustedDeviceDisplayNameUseCaseDependencies) {}

  public async execute(
    request: TrustedDeviceDisplayNameUpdate,
  ): Promise<IdentityOperationResult<UpdateTrustedDeviceDisplayNameResult, UpdateTrustedDeviceDisplayNameErrorCode>> {
    const trustedDeviceId = normalizeRequired(request.trustedDeviceId);
    if (!trustedDeviceId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "trustedDeviceId is required.");
    }

    const displayName = normalizeRequired(request.displayName);
    if (!displayName) {
      return this.failure(IdentityErrorCodes.invalidRequest, "displayName is required.");
    }

    try {
      const trustedDevice = await this.dependencies.trustedDeviceManagementService.updateTrustedDeviceDisplayName({
        ...request,
        trustedDeviceId,
        displayName,
      });
      return identitySuccess(Object.freeze({ trustedDevice }));
    } catch (error) {
      return this.failure(resolveTrustedDeviceErrorCode(error), normalizeErrorMessage(error));
    }
  }

  private failure<TValue, TCode extends UpdateTrustedDeviceDisplayNameErrorCode>(
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

function resolveTrustedDeviceErrorCode(error: unknown): UpdateTrustedDeviceDisplayNameErrorCode {
  const message = normalizeErrorMessage(error).toLowerCase();
  if (message.includes("not found")) {
    return IdentityErrorCodes.notFound;
  }
  if (message.includes("invalid")) {
    return IdentityErrorCodes.invalidState;
  }
  return IdentityErrorCodes.invalidRequest;
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Trusted device update failed.";
}

