import { randomUUID } from "node:crypto";
import {
  GetIssuedCertificateMetadataErrorCodes,
  type GetIssuedCertificateMetadataUseCase,
} from "@application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import type { GetCertificateAuthorityStatusIntrospectionUseCase } from "@application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import {
  ListIssuedCertificateMetadataErrorCodes,
  type ListIssuedCertificateMetadataUseCase,
} from "@application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import {
  IssuedCertificateAlreadyRevokedError,
  RevokeIssuedCertificateInvalidRequestError,
  type RevokeIssuedCertificateUseCase,
} from "@application/security/use-cases/RevokeIssuedCertificateUseCase";
import {
  CertificateIssuancePolicyViolationError,
} from "@application/security/use-cases/IssueCertificateForSubjectUseCase";
import {
  IssuedCertificateRenewalNotAllowedError,
  RenewIssuedCertificateInvalidRequestError,
  type RenewIssuedCertificateUseCase,
} from "@application/security/use-cases/RenewIssuedCertificateUseCase";
import {
  CertificateOperationsApiErrorCodes,
  type CertificateOperationsApiError,
  type CertificateOperationsApiResponse,
  type GetCertificateAuthorityStatusApiRequest,
  type GetCertificateAuthorityStatusApiResponse,
  type GetIssuedCertificateApiRequest,
  type GetIssuedCertificateApiResponse,
  type ListIssuedCertificatesApiRequest,
  type ListIssuedCertificatesApiResponse,
  type RenewIssuedCertificateApiRequest,
  type RenewIssuedCertificateApiResponse,
  type RevokeIssuedCertificateApiRequest,
  type RevokeIssuedCertificateApiResponse,
} from "./sdk/PublicCertificateOperationsApiContract";

interface CertificateOperationsBackendApiDependencies {
  readonly getCertificateAuthorityStatusIntrospectionUseCase: GetCertificateAuthorityStatusIntrospectionUseCase;
  readonly listIssuedCertificateMetadataUseCase: ListIssuedCertificateMetadataUseCase;
  readonly getIssuedCertificateMetadataUseCase: GetIssuedCertificateMetadataUseCase;
  readonly revokeIssuedCertificateUseCase: RevokeIssuedCertificateUseCase;
  readonly renewIssuedCertificateUseCase: RenewIssuedCertificateUseCase;
  readonly observabilityHook?: (event: CertificateOperationsObservabilityEvent) => Promise<void> | void;
}

type CertificateOperationsObservabilityEvent =
  | {
    readonly event: "certificate-operations.request.succeeded";
    readonly operation:
      | "get-certificate-authority-status"
      | "list-issued-certificates"
      | "get-issued-certificate"
      | "revoke-issued-certificate"
      | "renew-issued-certificate";
    readonly actorUserIdentityId?: string;
  }
  | {
    readonly event: "certificate-operations.request.failed";
    readonly operation:
      | "get-certificate-authority-status"
      | "list-issued-certificates"
      | "get-issued-certificate"
      | "revoke-issued-certificate"
      | "renew-issued-certificate";
    readonly actorUserIdentityId?: string;
    readonly code: CertificateOperationsApiError["code"];
    readonly message: string;
  };

export class CertificateOperationsBackendApi {
  public constructor(private readonly dependencies: CertificateOperationsBackendApiDependencies) {}

  public async getCertificateAuthorityStatus(
    request: GetCertificateAuthorityStatusApiRequest,
  ): Promise<CertificateOperationsApiResponse<GetCertificateAuthorityStatusApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(
        "get-certificate-authority-status",
        CertificateOperationsApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    try {
      const status = await this.dependencies.getCertificateAuthorityStatusIntrospectionUseCase.execute({
        asOf: request.asOf,
        rotationWarningWindowDays: request.rotationWarningWindowDays,
        certificateExpiryWarningWindowDays: request.certificateExpiryWarningWindowDays,
      });
      await this.emitObservability({
        event: "certificate-operations.request.succeeded",
        operation: "get-certificate-authority-status",
        actorUserIdentityId,
      });
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          status,
        }),
      });
    } catch (error) {
      return this.failed(
        "get-certificate-authority-status",
        CertificateOperationsApiErrorCodes.internal,
        toSafeClientErrorMessage(error, "Failed to resolve certificate authority status."),
        actorUserIdentityId,
      );
    }
  }

  public async listIssuedCertificates(
    request: ListIssuedCertificatesApiRequest,
  ): Promise<CertificateOperationsApiResponse<ListIssuedCertificatesApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(
        "list-issued-certificates",
        CertificateOperationsApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.listIssuedCertificateMetadataUseCase.execute({
      actorUserIdentityId,
      certificateAuthorityId: request.certificateAuthorityId,
      statuses: request.statuses,
      subjectReferenceKinds: request.subjectReferenceKinds,
      subjectReferenceId: request.subjectReferenceId,
      linkedNodeId: request.linkedNodeId,
      subjectCommonNameContains: request.subjectCommonNameContains,
      usageAnyOf: request.usageAnyOf,
      issuedAfter: request.issuedAfter,
      issuedBefore: request.issuedBefore,
      trustStatuses: request.trustStatuses,
      includeRevoked: request.includeRevoked,
      asOf: request.asOf,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      if (outcome.error.code === ListIssuedCertificateMetadataErrorCodes.invalidRequest) {
        return this.failed(
          "list-issued-certificates",
          CertificateOperationsApiErrorCodes.invalidRequest,
          toSafeClientErrorMessage(outcome.error.message, "Certificate metadata query is invalid."),
          actorUserIdentityId,
        );
      }
      if (outcome.error.code === ListIssuedCertificateMetadataErrorCodes.forbidden) {
        return this.failed(
          "list-issued-certificates",
          CertificateOperationsApiErrorCodes.forbidden,
          toSafeClientErrorMessage(outcome.error.message, "Actor is not authorized to list issued certificates."),
          actorUserIdentityId,
        );
      }
      return this.failed(
        "list-issued-certificates",
        CertificateOperationsApiErrorCodes.internal,
        toSafeClientErrorMessage(outcome.error.message, "Failed to list issued certificates."),
        actorUserIdentityId,
      );
    }

    await this.emitObservability({
      event: "certificate-operations.request.succeeded",
      operation: "list-issued-certificates",
      actorUserIdentityId,
    });
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        certificates: outcome.value,
      }),
    });
  }

  public async getIssuedCertificate(
    request: GetIssuedCertificateApiRequest,
  ): Promise<CertificateOperationsApiResponse<GetIssuedCertificateApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(
        "get-issued-certificate",
        CertificateOperationsApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.getIssuedCertificateMetadataUseCase.execute({
      actorUserIdentityId,
      serialNumber: request.serialNumber,
      asOf: request.asOf,
    });

    if (!outcome.ok) {
      if (outcome.error.code === GetIssuedCertificateMetadataErrorCodes.invalidRequest) {
        return this.failed(
          "get-issued-certificate",
          CertificateOperationsApiErrorCodes.invalidRequest,
          toSafeClientErrorMessage(outcome.error.message, "Issued certificate request is invalid."),
          actorUserIdentityId,
        );
      }
      if (outcome.error.code === GetIssuedCertificateMetadataErrorCodes.forbidden) {
        return this.failed(
          "get-issued-certificate",
          CertificateOperationsApiErrorCodes.forbidden,
          toSafeClientErrorMessage(outcome.error.message, "Actor is not authorized to view issued certificate metadata."),
          actorUserIdentityId,
        );
      }
      if (outcome.error.code === GetIssuedCertificateMetadataErrorCodes.notFound) {
        return this.failed(
          "get-issued-certificate",
          CertificateOperationsApiErrorCodes.notFound,
          toSafeClientErrorMessage(outcome.error.message, "Issued certificate was not found."),
          actorUserIdentityId,
        );
      }
      return this.failed(
        "get-issued-certificate",
        CertificateOperationsApiErrorCodes.internal,
        toSafeClientErrorMessage(outcome.error.message, "Failed to resolve issued certificate metadata."),
        actorUserIdentityId,
      );
    }

    await this.emitObservability({
      event: "certificate-operations.request.succeeded",
      operation: "get-issued-certificate",
      actorUserIdentityId,
    });
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        certificate: outcome.value,
      }),
    });
  }

  public async revokeIssuedCertificate(
    request: RevokeIssuedCertificateApiRequest,
  ): Promise<CertificateOperationsApiResponse<RevokeIssuedCertificateApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(
        "revoke-issued-certificate",
        CertificateOperationsApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    try {
      const revoked = await this.dependencies.revokeIssuedCertificateUseCase.execute({
        operationKey: request.operationKey?.trim() || `certificate-revoke:${request.serialNumber}:${randomUUID()}`,
        serialNumber: request.serialNumber,
        revocationReason: request.revocationReason,
        actorUserIdentityId,
        revokedAt: request.revokedAt,
        note: request.note,
        reason: request.reason,
        correlationId: request.correlationId,
      });
      await this.emitObservability({
        event: "certificate-operations.request.succeeded",
        operation: "revoke-issued-certificate",
        actorUserIdentityId,
      });
      return Object.freeze({
        ok: true,
        data: revoked,
      });
    } catch (error) {
      if (error instanceof IssuedCertificateAlreadyRevokedError) {
        return this.failed(
          "revoke-issued-certificate",
          CertificateOperationsApiErrorCodes.conflict,
          toSafeClientErrorMessage(error.message, "Issued certificate has already been revoked."),
          actorUserIdentityId,
        );
      }
      if (error instanceof RevokeIssuedCertificateInvalidRequestError) {
        if (error.message.includes("was not found")) {
          return this.failed(
            "revoke-issued-certificate",
            CertificateOperationsApiErrorCodes.notFound,
            toSafeClientErrorMessage(error.message, "Issued certificate was not found."),
            actorUserIdentityId,
          );
        }
        return this.failed(
          "revoke-issued-certificate",
          CertificateOperationsApiErrorCodes.invalidRequest,
          toSafeClientErrorMessage(error.message, "Issued certificate revocation request is invalid."),
          actorUserIdentityId,
        );
      }
      return this.failed(
        "revoke-issued-certificate",
        CertificateOperationsApiErrorCodes.internal,
        toSafeClientErrorMessage(error, "Unexpected certificate revocation error."),
        actorUserIdentityId,
      );
    }
  }

  public async renewIssuedCertificate(
    request: RenewIssuedCertificateApiRequest,
  ): Promise<CertificateOperationsApiResponse<RenewIssuedCertificateApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(
        "renew-issued-certificate",
        CertificateOperationsApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    try {
      const renewed = await this.dependencies.renewIssuedCertificateUseCase.execute({
        operationKey: request.operationKey?.trim() || `certificate-renew:${request.serialNumber}:${randomUUID()}`,
        serialNumber: request.serialNumber,
        actorUserIdentityId,
        validityDays: request.validityDays,
        publicKeyPem: request.publicKeyPem,
        publicKeyAlgorithm: request.publicKeyAlgorithm,
        publicKeyFingerprintSha256: request.publicKeyFingerprintSha256,
        signatureAlgorithm: request.signatureAlgorithm,
        certificateMaterialRef: request.certificateMaterialRef,
        certificateChainMaterialRef: request.certificateChainMaterialRef,
        trustMaterialRef: request.trustMaterialRef,
        certificateMaterialSecretRef: request.certificateMaterialSecretRef,
        certificateMaterialKeyScope: request.certificateMaterialKeyScope,
        certificateChainMaterialSecretRef: request.certificateChainMaterialSecretRef,
        certificateChainMaterialKeyScope: request.certificateChainMaterialKeyScope,
        previousCertificateDisposition: request.previousCertificateDisposition,
        gracePeriodDays: request.gracePeriodDays,
        occurredAt: request.occurredAt,
        reason: request.reason,
        correlationId: request.correlationId,
      });
      await this.emitObservability({
        event: "certificate-operations.request.succeeded",
        operation: "renew-issued-certificate",
        actorUserIdentityId,
      });
      return Object.freeze({
        ok: true,
        data: renewed,
      });
    } catch (error) {
      if (error instanceof IssuedCertificateRenewalNotAllowedError) {
        return this.failed(
          "renew-issued-certificate",
          CertificateOperationsApiErrorCodes.conflict,
          toSafeClientErrorMessage(error.message, "Issued certificate cannot be renewed from its current status."),
          actorUserIdentityId,
        );
      }
      if (error instanceof CertificateIssuancePolicyViolationError) {
        return this.failed(
          "renew-issued-certificate",
          CertificateOperationsApiErrorCodes.invalidRequest,
          toSafeClientErrorMessage(error.message, "Certificate renewal request violates issuance policy."),
          actorUserIdentityId,
        );
      }
      if (error instanceof RenewIssuedCertificateInvalidRequestError) {
        if (error.message.includes("was not found")) {
          return this.failed(
            "renew-issued-certificate",
            CertificateOperationsApiErrorCodes.notFound,
            toSafeClientErrorMessage(error.message, "Issued certificate was not found."),
            actorUserIdentityId,
          );
        }
        return this.failed(
          "renew-issued-certificate",
          CertificateOperationsApiErrorCodes.invalidRequest,
          toSafeClientErrorMessage(error.message, "Issued certificate renewal request is invalid."),
          actorUserIdentityId,
        );
      }
      return this.failed(
        "renew-issued-certificate",
        CertificateOperationsApiErrorCodes.internal,
        toSafeClientErrorMessage(error, "Unexpected certificate renewal error."),
        actorUserIdentityId,
      );
    }
  }

  private failed(
    operation: CertificateOperationsObservabilityEvent["operation"],
    code: CertificateOperationsApiError["code"],
    message: string,
    actorUserIdentityId?: string,
  ): CertificateOperationsApiResponse<never> {
    void this.emitObservability({
      event: "certificate-operations.request.failed",
      operation,
      actorUserIdentityId,
      code,
      message,
    });
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
      }),
    });
  }

  private async emitObservability(event: CertificateOperationsObservabilityEvent): Promise<void> {
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

const SensitiveCertificateErrorMessagePattern =
  /(-----BEGIN [A-Z ]+-----|secret-store:|private[-_]?key|certificate[-_]?material|chain[-_]?material|trust[-_]?material|storage[-_]?locator|access[-_]?ref|public[-_]?key)/i;

function toSafeClientErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    const normalized = error.trim();
    if (!normalized || SensitiveCertificateErrorMessagePattern.test(normalized)) {
      return fallback;
    }
    return normalized;
  }

  if (error instanceof Error) {
    const normalized = error.message.trim();
    if (!normalized || SensitiveCertificateErrorMessagePattern.test(normalized)) {
      return fallback;
    }
    return normalized;
  }

  return fallback;
}

function sanitizeObservabilityEvent(event: CertificateOperationsObservabilityEvent): CertificateOperationsObservabilityEvent {
  if (event.event === "certificate-operations.request.succeeded") {
    return Object.freeze({
      ...event,
      actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
    });
  }

  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
    message: toSafeClientErrorMessage(event.message, "Certificate operation failed."),
  });
}

function normalizeOptional(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

