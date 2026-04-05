import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
  type TrustedDeviceListQuery,
  type TrustedDeviceRecord,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ITrustedDeviceManagementService } from "../../../../application/identity/ports/ITrustedDeviceManagementService";

export type ListTrustedDevicesErrorCode =
  | typeof IdentityErrorCodes.invalidRequest;

interface ListTrustedDevicesUseCaseDependencies {
  readonly trustedDeviceManagementService: Pick<ITrustedDeviceManagementService, "listTrustedDevices">;
}

export interface ListTrustedDevicesResult {
  readonly devices: ReadonlyArray<TrustedDeviceRecord>;
}

export class ListTrustedDevicesUseCase {
  public constructor(private readonly dependencies: ListTrustedDevicesUseCaseDependencies) {}

  public async execute(
    input: TrustedDeviceListQuery,
  ): Promise<IdentityOperationResult<ListTrustedDevicesResult, ListTrustedDevicesErrorCode>> {
    const userIdentityId = normalizeRequired(input.userIdentityId);
    if (!userIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "userIdentityId is required.");
    }

    const devices = await this.dependencies.trustedDeviceManagementService.listTrustedDevices({
      ...input,
      userIdentityId,
    });
    return identitySuccess(Object.freeze({ devices }));
  }

  private failure<TValue, TCode extends ListTrustedDevicesErrorCode>(
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
