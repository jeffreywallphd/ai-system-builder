import { randomUUID } from "node:crypto";
import {
  GetIssuedCertificateMetadataErrorCodes,
  type GetIssuedCertificateMetadataUseCase,
} from "../../../src/application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import type { GetCertificateAuthorityStatusIntrospectionUseCase } from "../../../src/application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import {
  ListIssuedCertificateMetadataErrorCodes,
  type ListIssuedCertificateMetadataUseCase,
} from "../../../src/application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import {
  IssuedCertificateAlreadyRevokedError,
  RevokeIssuedCertificateInvalidRequestError,
  type RevokeIssuedCertificateUseCase,
} from "../../../src/application/security/use-cases/RevokeIssuedCertificateUseCase";
import {
  CertificateIssuancePolicyViolationError,
} from "../../../src/application/security/use-cases/IssueCertificateForSubjectUseCase";
import {
  IssuedCertificateRenewalNotAllowedError,
  RenewIssuedCertificateInvalidRequestError,
  type RenewIssuedCertificateUseCase,
} from "../../../src/application/security/use-cases/RenewIssuedCertificateUseCase";
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
}

export class CertificateOperationsBackendApi {
  public constructor(private readonly dependencies: CertificateOperationsBackendApiDependencies) {}

  public async getCertificateAuthorityStatus(
    request: GetCertificateAuthorityStatusApiRequest,
  ): Promise<CertificateOperationsApiResponse<GetCertificateAuthorityStatusApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    try {
      const status = await this.dependencies.getCertificateAuthorityStatusIntrospectionUseCase.execute({
        asOf: request.asOf,
        rotationWarningWindowDays: request.rotationWarningWindowDays,
        certificateExpiryWarningWindowDays: request.certificateExpiryWarningWindowDays,
      });
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          status,
        }),
      });
    } catch (error) {
      return this.failed(
        CertificateOperationsApiErrorCodes.internal,
        error instanceof Error ? error.message : "Failed to resolve certificate authority status.",
      );
    }
  }

  public async listIssuedCertificates(
    request: ListIssuedCertificatesApiRequest,
  ): Promise<CertificateOperationsApiResponse<ListIssuedCertificatesApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
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
        return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, outcome.error.message);
      }
      if (outcome.error.code === ListIssuedCertificateMetadataErrorCodes.forbidden) {
        return this.failed(CertificateOperationsApiErrorCodes.forbidden, outcome.error.message);
      }
      return this.failed(CertificateOperationsApiErrorCodes.internal, outcome.error.message);
    }

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
      return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const outcome = await this.dependencies.getIssuedCertificateMetadataUseCase.execute({
      actorUserIdentityId,
      serialNumber: request.serialNumber,
      asOf: request.asOf,
    });

    if (!outcome.ok) {
      if (outcome.error.code === GetIssuedCertificateMetadataErrorCodes.invalidRequest) {
        return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, outcome.error.message);
      }
      if (outcome.error.code === GetIssuedCertificateMetadataErrorCodes.forbidden) {
        return this.failed(CertificateOperationsApiErrorCodes.forbidden, outcome.error.message);
      }
      if (outcome.error.code === GetIssuedCertificateMetadataErrorCodes.notFound) {
        return this.failed(CertificateOperationsApiErrorCodes.notFound, outcome.error.message);
      }
      return this.failed(CertificateOperationsApiErrorCodes.internal, outcome.error.message);
    }

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
      return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
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
      return Object.freeze({
        ok: true,
        data: revoked,
      });
    } catch (error) {
      if (error instanceof IssuedCertificateAlreadyRevokedError) {
        return this.failed(CertificateOperationsApiErrorCodes.conflict, error.message);
      }
      if (error instanceof RevokeIssuedCertificateInvalidRequestError) {
        if (error.message.includes("was not found")) {
          return this.failed(CertificateOperationsApiErrorCodes.notFound, error.message);
        }
        return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, error.message);
      }
      return this.failed(
        CertificateOperationsApiErrorCodes.internal,
        error instanceof Error ? error.message : "Unexpected certificate revocation error.",
      );
    }
  }

  public async renewIssuedCertificate(
    request: RenewIssuedCertificateApiRequest,
  ): Promise<CertificateOperationsApiResponse<RenewIssuedCertificateApiResponse>> {
    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
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
      return Object.freeze({
        ok: true,
        data: renewed,
      });
    } catch (error) {
      if (error instanceof IssuedCertificateRenewalNotAllowedError) {
        return this.failed(CertificateOperationsApiErrorCodes.conflict, error.message);
      }
      if (error instanceof CertificateIssuancePolicyViolationError) {
        return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, error.message);
      }
      if (error instanceof RenewIssuedCertificateInvalidRequestError) {
        if (error.message.includes("was not found")) {
          return this.failed(CertificateOperationsApiErrorCodes.notFound, error.message);
        }
        return this.failed(CertificateOperationsApiErrorCodes.invalidRequest, error.message);
      }
      return this.failed(
        CertificateOperationsApiErrorCodes.internal,
        error instanceof Error ? error.message : "Unexpected certificate renewal error.",
      );
    }
  }

  private failed(
    code: CertificateOperationsApiError["code"],
    message: string,
  ): CertificateOperationsApiResponse<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
      }),
    });
  }
}
