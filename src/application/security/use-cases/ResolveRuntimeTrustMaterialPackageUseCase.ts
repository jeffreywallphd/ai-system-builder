import {
  normalizeCertificateAuthorityMutationOperationKey,
  type CertificateDistributionTargetKind,
} from "@shared/dto/security/CertificateAuthorityDtos";
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
  internal: "resolve-runtime-trust-material-package-internal",
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

export type ResolveRuntimeTrustMaterialPackageObservabilityEvent =
  | {
    readonly event: "runtime-trust-material-package-resolve-succeeded";
    readonly occurredAt: string;
    readonly operationKey: string;
    readonly actorUserIdentityId: string;
    readonly targetKind: CertificateDistributionTargetKind;
    readonly targetReferenceId: string;
    readonly workspaceId?: string;
    readonly certificateAuthorityId?: string;
    readonly serialNumber?: string;
    readonly includeLeafCertificate: boolean;
    readonly includeCertificateChain: boolean;
    readonly includeTrustBundle: boolean;
    readonly includeProtectedReferences: boolean;
    readonly packageId: string;
  }
  | {
    readonly event: "runtime-trust-material-package-resolve-failed";
    readonly occurredAt: string;
    readonly operationKey?: string;
    readonly actorUserIdentityId?: string;
    readonly targetKind?: CertificateDistributionTargetKind;
    readonly targetReferenceId?: string;
    readonly workspaceId?: string;
    readonly certificateAuthorityId?: string;
    readonly serialNumber?: string;
    readonly includeLeafCertificate?: boolean;
    readonly includeCertificateChain?: boolean;
    readonly includeTrustBundle?: boolean;
    readonly includeProtectedReferences?: boolean;
    readonly code: ResolveRuntimeTrustMaterialPackageErrorCode;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };

interface ResolveRuntimeTrustMaterialPackageUseCaseDependencies {
  readonly trustMaterialDistributionPort: ITrustMaterialDistributionPort;
  readonly authorizationHook?: CertificateRuntimeTrustMaterialAuthorizationHook;
  readonly observabilityHook?: (event: ResolveRuntimeTrustMaterialPackageObservabilityEvent) => Promise<void> | void;
}

export class ResolveRuntimeTrustMaterialPackageUseCase {
  public constructor(private readonly dependencies: ResolveRuntimeTrustMaterialPackageUseCaseDependencies) {}

  public async execute(
    input: ResolveRuntimeTrustMaterialPackageUseCaseInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageOutcome> {
    const normalized = normalizeInput(input);
    if (!normalized.ok) {
      await this.emitObservability({
        event: "runtime-trust-material-package-resolve-failed",
        occurredAt: new Date().toISOString(),
        operationKey: normalizeOptional(input.operationKey),
        actorUserIdentityId: normalizeOptional(input.actorUserIdentityId),
        targetKind: input.targetKind,
        targetReferenceId: normalizeOptional(input.targetReferenceId),
        workspaceId: normalizeOptional(input.workspaceId),
        certificateAuthorityId: normalizeOptional(input.certificateAuthorityId),
        serialNumber: normalizeSerial(input.serialNumber),
        includeLeafCertificate: input.includeLeafCertificate,
        includeCertificateChain: input.includeCertificateChain,
        includeTrustBundle: input.includeTrustBundle,
        includeProtectedReferences: input.includeProtectedReferences,
        code: normalized.error.code,
        message: normalized.error.message,
      });
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
      const outcome = failure(
        "forbidden",
        "Actor is not authorized to resolve runtime trust material package.",
      );
      await this.emitObservability({
        event: "runtime-trust-material-package-resolve-failed",
        occurredAt: normalized.value.occurredAt,
        operationKey: normalized.value.operationKey,
        actorUserIdentityId: normalized.value.actorUserIdentityId,
        targetKind: normalized.value.targetKind,
        targetReferenceId: normalized.value.targetReferenceId,
        workspaceId: normalized.value.workspaceId,
        certificateAuthorityId: normalized.value.certificateAuthorityId,
        serialNumber: normalized.value.serialNumber,
        includeLeafCertificate: normalized.value.includeLeafCertificate,
        includeCertificateChain: normalized.value.includeCertificateChain,
        includeTrustBundle: normalized.value.includeTrustBundle,
        includeProtectedReferences: normalized.value.includeProtectedReferences,
        code: outcome.error.code,
        message: outcome.error.message,
        details: Object.freeze({
          reason: toErrorSummary(error),
        }),
      });
      return outcome;
    }

    let value: ResolveRuntimeTrustMaterialPackageResult | undefined;
    try {
      value = await this.dependencies.trustMaterialDistributionPort.resolveRuntimeTrustMaterialPackage(normalized.value);
    } catch (error) {
      const outcome = failure(
        "internal",
        "Runtime trust material package resolution failed due to an internal error.",
      );
      await this.emitObservability({
        event: "runtime-trust-material-package-resolve-failed",
        occurredAt: normalized.value.occurredAt,
        operationKey: normalized.value.operationKey,
        actorUserIdentityId: normalized.value.actorUserIdentityId,
        targetKind: normalized.value.targetKind,
        targetReferenceId: normalized.value.targetReferenceId,
        workspaceId: normalized.value.workspaceId,
        certificateAuthorityId: normalized.value.certificateAuthorityId,
        serialNumber: normalized.value.serialNumber,
        includeLeafCertificate: normalized.value.includeLeafCertificate,
        includeCertificateChain: normalized.value.includeCertificateChain,
        includeTrustBundle: normalized.value.includeTrustBundle,
        includeProtectedReferences: normalized.value.includeProtectedReferences,
        code: outcome.error.code,
        message: outcome.error.message,
        details: Object.freeze({
          reason: toErrorSummary(error),
        }),
      });
      return outcome;
    }

    if (!value) {
      const outcome = failure(
        "notFound",
        "No runtime trust material package was found for the requested target scope.",
      );
      await this.emitObservability({
        event: "runtime-trust-material-package-resolve-failed",
        occurredAt: normalized.value.occurredAt,
        operationKey: normalized.value.operationKey,
        actorUserIdentityId: normalized.value.actorUserIdentityId,
        targetKind: normalized.value.targetKind,
        targetReferenceId: normalized.value.targetReferenceId,
        workspaceId: normalized.value.workspaceId,
        certificateAuthorityId: normalized.value.certificateAuthorityId,
        serialNumber: normalized.value.serialNumber,
        includeLeafCertificate: normalized.value.includeLeafCertificate,
        includeCertificateChain: normalized.value.includeCertificateChain,
        includeTrustBundle: normalized.value.includeTrustBundle,
        includeProtectedReferences: normalized.value.includeProtectedReferences,
        code: outcome.error.code,
        message: outcome.error.message,
      });
      return outcome;
    }

    await this.emitObservability({
      event: "runtime-trust-material-package-resolve-succeeded",
      occurredAt: normalized.value.occurredAt,
      operationKey: normalized.value.operationKey,
      actorUserIdentityId: normalized.value.actorUserIdentityId,
      targetKind: normalized.value.targetKind,
      targetReferenceId: normalized.value.targetReferenceId,
      workspaceId: normalized.value.workspaceId,
      certificateAuthorityId: normalized.value.certificateAuthorityId,
      serialNumber: normalized.value.serialNumber,
      includeLeafCertificate: normalized.value.includeLeafCertificate,
      includeCertificateChain: normalized.value.includeCertificateChain,
      includeTrustBundle: normalized.value.includeTrustBundle,
      includeProtectedReferences: normalized.value.includeProtectedReferences,
      packageId: value.packageId,
    });

    return {
      ok: true,
      value,
    };
  }

  private async emitObservability(event: ResolveRuntimeTrustMaterialPackageObservabilityEvent): Promise<void> {
    if (!this.dependencies.observabilityHook) {
      return;
    }

    try {
      await this.dependencies.observabilityHook(sanitizeObservabilityEvent(event));
    } catch {
      // Intentionally non-fatal.
    }
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
  code: "invalidRequest" | "forbidden" | "notFound" | "internal",
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

const SensitiveObservabilityDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|trust[-_]?material|certificate[-_]?material|chain[-_]?material|storage[-_]?locator|pem|csr|public[-_]?key|key[-_]?scope|access[-_]?ref|raw)/i;
const SensitiveObservabilityValuePattern =
  /(-----BEGIN [A-Z ]+-----|secret-store:|private[-_]?key|certificate[-_]?material|chain[-_]?material|trust[-_]?material)/i;
const MaxObservabilityStringLength = 256;

function sanitizeObservabilityEvent(
  event: ResolveRuntimeTrustMaterialPackageObservabilityEvent,
): ResolveRuntimeTrustMaterialPackageObservabilityEvent {
  if (event.event === "runtime-trust-material-package-resolve-succeeded") {
    return Object.freeze({
      ...event,
      actorUserIdentityId: normalizeObservabilityValue(event.actorUserIdentityId),
      operationKey: normalizeObservabilityValue(event.operationKey),
      targetReferenceId: normalizeObservabilityValue(event.targetReferenceId),
      packageId: normalizeObservabilityValue(event.packageId),
      workspaceId: normalizeObservabilityOptional(event.workspaceId),
      certificateAuthorityId: normalizeObservabilityOptional(event.certificateAuthorityId),
      serialNumber: normalizeObservabilityOptional(event.serialNumber),
    });
  }

  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeObservabilityOptional(event.actorUserIdentityId),
    operationKey: normalizeObservabilityOptional(event.operationKey),
    targetReferenceId: normalizeObservabilityOptional(event.targetReferenceId),
    workspaceId: normalizeObservabilityOptional(event.workspaceId),
    certificateAuthorityId: normalizeObservabilityOptional(event.certificateAuthorityId),
    serialNumber: normalizeObservabilityOptional(event.serialNumber),
    details: sanitizeObservabilityDetails(event.details),
  });
}

function sanitizeObservabilityDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveObservabilityDetailKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeObservabilityUnknown(value);
  }
  return Object.freeze(output);
}

function sanitizeObservabilityUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (SensitiveObservabilityValuePattern.test(value)) {
      return "[REDACTED]";
    }
    return value.length > MaxObservabilityStringLength
      ? `${value.slice(0, MaxObservabilityStringLength)}...`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((entry) => sanitizeObservabilityUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveObservabilityDetailKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeObservabilityUnknown(nestedValue);
    }
    return Object.freeze(output);
  }
  return String(value);
}

function normalizeObservabilityValue(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeObservabilityOptional(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown-error";
  }
  const name = normalizeObservabilityValue(error.name || "error");
  const message = normalizeObservabilityOptional(error.message);
  return message ? `${name}: ${message}` : name;
}

