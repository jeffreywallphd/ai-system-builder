import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
  type TrustedDeviceRecord,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ITrustedDeviceManagementService } from "../../../../application/identity/ports/ITrustedDeviceManagementService";

export type GetTrustedDeviceErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.notFound;

export interface GetTrustedDeviceInput {
  readonly trustedDeviceId: string;
}

export interface GetTrustedDeviceResult {
  readonly trustedDevice: TrustedDeviceRecord;
}

interface GetTrustedDeviceUseCaseDependencies {
  readonly trustedDeviceManagementService: Pick<ITrustedDeviceManagementService, "getTrustedDeviceById">;
}

export class GetTrustedDeviceUseCase {
  public constructor(private readonly dependencies: GetTrustedDeviceUseCaseDependencies) {}

  public async execute(
    input: GetTrustedDeviceInput,
  ): Promise<IdentityOperationResult<GetTrustedDeviceResult, GetTrustedDeviceErrorCode>> {
    const trustedDeviceId = normalizeRequired(input.trustedDeviceId);
    if (!trustedDeviceId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "trustedDeviceId is required.");
    }

    const trustedDevice = await this.dependencies.trustedDeviceManagementService.getTrustedDeviceById(trustedDeviceId);
    if (!trustedDevice) {
      return this.failure(IdentityErrorCodes.notFound, `Trusted device '${trustedDeviceId}' was not found.`);
    }

    return identitySuccess(Object.freeze({ trustedDevice }));
  }

  private failure<TValue, TCode extends GetTrustedDeviceErrorCode>(
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
