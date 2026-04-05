import {
  normalizeCertificateAuthorityMutationOperationKey,
  type CertificateDistributionTargetKind,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import type {
  CertificateRuntimeTrustMaterialAuthorizationHook,
} from "../ports/CertificateRuntimeTrustMaterialAuthorizationPort";
import type {
  ITrustMaterialDistributionPort,
  ResolveRuntimeTrustMaterialPackageResult,
} from "../ports/ITrustMaterialDistributionPort";

export const ResolveRuntimeTrustMaterialPackageErrorCodes = Object.freeze({
  invalidRequest: "resolve-runtime-trust-material-package-invalid-request",
  forbidden: "resolve-runtime-trust-material-package-forbidden",
  notFound: "resolve-runtime-trust-material-package-not-found",
});

export type ResolveRuntimeTrustMaterialPackageErrorCode =
  typeof ResolveRuntimeTrustMaterialPackageErrorCodes[keyof typeof ResolveRuntimeTrustMaterialPackageErrorCodes];

export type ResolveRuntimeTrustMaterialPackageOutcome =
  | {
    readonly ok: true;
    readonly value: ResolveRuntimeTrustMaterialPackageResult;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: ResolveRuntimeTrustMaterialPackageErrorCode;
      readonly message: string;
    };
  };

export interface ResolveRuntimeTrustMaterialPackageUseCaseInput {
  readonly operationKey: string;
  readonly actorUserIdentityId: string;
  readonly targetKind: CertificateDistributionTargetKind;
  readonly targetReferenceId: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly includeLeafCertificate?: boolean;
  readonly includeCertificateChain?: boolean;
  readonly includeTrustBundle?: boolean;
  readonly includeProtectedReferences?: boolean;
  readonly occurredAt?: string;
}

interface ResolveRuntimeTrustMaterialPackageUseCaseDependencies {
  readonly trustMaterialDistributionPort: ITrustMaterialDistributionPort;
  readonly authorizationHook?: CertificateRuntimeTrustMaterialAuthorizationHook;
}

export class ResolveRuntimeTrustMaterialPackageUseCase {
  public constructor(private readonly dependencies: ResolveRuntimeTrustMaterialPackageUseCaseDependencies) {}

  public async execute(
    input: ResolveRuntimeTrustMaterialPackageUseCaseInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageOutcome> {
    const normalized = normalizeInput(input);
    if (!normalized.ok) {
      return normalized;
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanResolveRuntimeTrustMaterialPackage({
          actorUserIdentityId: normalized.value.actorUserIdentityId,
          request: Object.freeze({
            targetKind: normalized.value.targetKind,
            targetReferenceId: normalized.value.targetReferenceId,
            workspaceId: normalized.value.workspaceId,
            certificateAuthorityId: normalized.value.certificateAuthorityId,
            serialNumber: normalized.value.serialNumber,
            includeLeafCertificate: normalized.value.includeLeafCertificate,
            includeCertificateChain: normalized.value.includeCertificateChain,
            includeTrustBundle: normalized.value.includeTrustBundle,
            includeProtectedReferences: normalized.value.includeProtectedReferences,
            occurredAt: normalized.value.occurredAt,
          }),
        });
      }
    } catch (error) {
      return failure(
        "forbidden",
        error instanceof Error ? error.message : "Actor is not authorized to resolve runtime trust material.",
      );
    }

    const value = await this.dependencies.trustMaterialDistributionPort.resolveRuntimeTrustMaterialPackage(normalized.value);
    if (!value) {
      return failure(
        "notFound",
        "No runtime trust material package was found for the requested target scope.",
      );
    }

    return {
      ok: true,
      value,
    };
  }
}

function normalizeInput(
  input: ResolveRuntimeTrustMaterialPackageUseCaseInput,
): ResolveRuntimeTrustMaterialPackageOutcome | {
  readonly ok: true;
  readonly value: {
    readonly operationKey: string;
    readonly actorUserIdentityId: string;
    readonly targetKind: ResolveRuntimeTrustMaterialPackageUseCaseInput["targetKind"];
    readonly targetReferenceId: string;
    readonly workspaceId?: string;
    readonly certificateAuthorityId?: string;
    readonly serialNumber?: string;
    readonly includeLeafCertificate: boolean;
    readonly includeCertificateChain: boolean;
    readonly includeTrustBundle: boolean;
    readonly includeProtectedReferences: boolean;
    readonly occurredAt: string;
  };
} {
  const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
  if (!actorUserIdentityId) {
    return failure("invalidRequest", "actorUserIdentityId is required.");
  }

  const targetReferenceId = normalizeRequired(input.targetReferenceId);
  if (!targetReferenceId) {
    return failure("invalidRequest", "targetReferenceId is required.");
  }

  const includeLeafCertificate = input.includeLeafCertificate ?? true;
  const includeCertificateChain = input.includeCertificateChain ?? true;
  const includeTrustBundle = input.includeTrustBundle ?? true;
  const includeProtectedReferences = input.includeProtectedReferences ?? false;

  if (!includeLeafCertificate && !includeCertificateChain && !includeTrustBundle && !includeProtectedReferences) {
    return failure(
      "invalidRequest",
      "At least one runtime trust material output must be requested.",
    );
  }

  const occurredAt = normalizeTimestamp(input.occurredAt);
  if (input.occurredAt && !occurredAt) {
    return failure("invalidRequest", "occurredAt must be a valid timestamp.");
  }

  const serialNumber = normalizeSerial(input.serialNumber);
  if (input.serialNumber && !serialNumber) {
    return failure(
      "invalidRequest",
      "serialNumber must be a hexadecimal string (2-64 chars).",
    );
  }

  let operationKey: string;
  try {
    operationKey = normalizeCertificateAuthorityMutationOperationKey(input.operationKey);
  } catch {
    return failure("invalidRequest", "operationKey is required.");
  }

  return {
    ok: true,
    value: Object.freeze({
      operationKey,
      actorUserIdentityId,
      targetKind: input.targetKind,
      targetReferenceId,
      workspaceId: normalizeOptional(input.workspaceId),
      certificateAuthorityId: normalizeOptional(input.certificateAuthorityId),
      serialNumber,
      includeLeafCertificate,
      includeCertificateChain,
      includeTrustBundle,
      includeProtectedReferences,
      occurredAt: occurredAt ?? new Date().toISOString(),
    }),
  };
}

function normalizeRequired(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeTimestamp(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const epoch = Date.parse(normalized);
  if (Number.isNaN(epoch)) {
    return undefined;
  }
  return new Date(epoch).toISOString();
}

function normalizeSerial(value?: string): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return /^[0-9A-F]{2,64}$/.test(normalized) ? normalized : undefined;
}

function failure(
  code: "invalidRequest" | "forbidden" | "notFound",
  message: string,
): ResolveRuntimeTrustMaterialPackageOutcome {
  return {
    ok: false,
    error: Object.freeze({
      code: ResolveRuntimeTrustMaterialPackageErrorCodes[code],
      message,
    }),
  };
}
