import type {
  IssuedCertificateMetadataViewDto,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { CertificateQueryAuthorizationHook } from "../ports/CertificateQueryAuthorizationPorts";
import { CertificateTrustEvaluationService, type CertificateTrustEvaluationClock } from "./CertificateTrustEvaluationService";

export const GetIssuedCertificateMetadataErrorCodes = Object.freeze({
  invalidRequest: "get-issued-certificate-metadata-invalid-request",
  forbidden: "get-issued-certificate-metadata-forbidden",
  notFound: "get-issued-certificate-metadata-not-found",
});

export type GetIssuedCertificateMetadataErrorCode =
  typeof GetIssuedCertificateMetadataErrorCodes[keyof typeof GetIssuedCertificateMetadataErrorCodes];

export type GetIssuedCertificateMetadataOutcome =
  | {
    readonly ok: true;
    readonly value: IssuedCertificateMetadataViewDto;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: GetIssuedCertificateMetadataErrorCode;
      readonly message: string;
    };
  };

export interface GetIssuedCertificateMetadataUseCaseInput {
  readonly actorUserIdentityId: string;
  readonly serialNumber: string;
  readonly asOf?: string;
}

interface GetIssuedCertificateMetadataUseCaseDependencies {
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly authorizationHook?: CertificateQueryAuthorizationHook;
  readonly clock?: CertificateTrustEvaluationClock;
}

export class GetIssuedCertificateMetadataUseCase {
  private readonly clock: CertificateTrustEvaluationClock;
  private readonly trustEvaluator: CertificateTrustEvaluationService;

  public constructor(private readonly dependencies: GetIssuedCertificateMetadataUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
    this.trustEvaluator = new CertificateTrustEvaluationService({
      clock: this.clock,
    });
  }

  public async execute(input: GetIssuedCertificateMetadataUseCaseInput): Promise<GetIssuedCertificateMetadataOutcome> {
    const actorUserIdentityId = input.actorUserIdentityId?.trim();
    if (!actorUserIdentityId) {
      return this.failure("invalidRequest", "actorUserIdentityId is required.");
    }

    const serialNumber = normalizeSerial(input.serialNumber);
    if (!serialNumber) {
      return this.failure(
        "invalidRequest",
        "serialNumber must be a hexadecimal string (2-64 chars).",
      );
    }

    const asOf = normalizeOptionalIsoTimestamp(input.asOf) ?? this.clock.now().toISOString();
    if (input.asOf && !normalizeOptionalIsoTimestamp(input.asOf)) {
      return this.failure("invalidRequest", "asOf must be a valid timestamp.");
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanGetIssuedCertificateMetadata({
          actorUserIdentityId,
          serialNumber,
          asOf,
        });
      }
    } catch (error) {
      return this.failure(
        "forbidden",
        error instanceof Error ? error.message : "Actor is not authorized to view issued certificate metadata.",
      );
    }

    const certificate = await this.dependencies.issuedCertificateRepository.findIssuedCertificateBySerialNumber(serialNumber);
    if (!certificate) {
      return this.failure("notFound", `Issued certificate '${serialNumber}' was not found.`);
    }

    const trust = this.trustEvaluator.evaluateIssuedCertificateTrust({
      serialNumber,
      certificate,
      asOf,
    });

    return {
      ok: true,
      value: Object.freeze({
        certificateAuthorityId: certificate.certificateAuthorityId,
        serialNumber: certificate.serialNumber,
        status: certificate.status,
        trust: Object.freeze({
          status: trust.status,
          active: trust.active,
          revoked: trust.revoked,
          expired: trust.expired,
          usable: trust.usable,
          checkedAt: trust.checkedAt,
        }),
        subject: Object.freeze({
          commonName: certificate.subject.commonName,
          organization: certificate.subject.organization,
          organizationalUnit: certificate.subject.organizationalUnit,
          country: certificate.subject.country,
          stateOrProvince: certificate.subject.stateOrProvince,
          locality: certificate.subject.locality,
          dnsNames: certificate.subject.dnsNames,
          ipAddresses: certificate.subject.ipAddresses,
          uriSanEntries: certificate.subject.uriSanEntries,
        }),
        subjectReference: Object.freeze({
          kind: certificate.subjectReference.kind,
          referenceId: certificate.subjectReference.referenceId,
          workspaceId: certificate.subjectReference.workspaceId,
        }),
        usages: certificate.usages,
        validity: Object.freeze({
          notBefore: certificate.validity.notBefore,
          notAfter: certificate.validity.notAfter,
        }),
        issuedAt: certificate.issuedAt,
        publicKeyAlgorithm: certificate.publicKeyAlgorithm,
        publicKeyFingerprintSha256: certificate.publicKeyFingerprintSha256,
        revocation: certificate.revocation
          ? Object.freeze({
            reason: certificate.revocation.reason,
            revokedAt: certificate.revocation.revokedAt,
            revokedByActorId: certificate.revocation.revokedByActorId,
            note: certificate.revocation.note,
          })
          : undefined,
        supersededBySerialNumber: certificate.supersededBySerialNumber,
        createdAt: certificate.createdAt,
        createdBy: certificate.createdBy,
        lastModifiedAt: certificate.lastModifiedAt,
        lastModifiedBy: certificate.lastModifiedBy,
      }),
    };
  }

  private failure(code: "invalidRequest" | "forbidden" | "notFound", message: string): GetIssuedCertificateMetadataOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code: GetIssuedCertificateMetadataErrorCodes[code],
        message,
      }),
    };
  }
}

function normalizeSerial(serialNumber: string): string | undefined {
  const normalized = serialNumber?.trim().toUpperCase();
  if (!normalized || !/^[0-9A-F]{2,64}$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeOptionalIsoTimestamp(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const epoch = Date.parse(normalized);
  if (Number.isNaN(epoch)) {
    return undefined;
  }
  return new Date(epoch).toISOString();
}
