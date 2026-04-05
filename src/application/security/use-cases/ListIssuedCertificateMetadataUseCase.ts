import { CertificateSubjectReferenceKinds } from "../../../domain/security/CertificateAuthorityDomain";
import type {
  CertificateMetadataListViewDto,
  CertificateTrustEvaluationStatus,
  IssuedCertificateMetadataViewDto,
  IssuedCertificatePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { CertificateQueryAuthorizationHook } from "../ports/CertificateQueryAuthorizationPorts";
import { CertificateTrustEvaluationService, type CertificateTrustEvaluationClock } from "./CertificateTrustEvaluationService";

const DefaultLimit = 25;
const MaxLimit = 100;
const ValidStatuses = new Set<CertificateTrustEvaluationStatus>([
  "active",
  "revoked",
  "expired",
  "superseded",
  "not-yet-valid",
  "not-found",
  "subject-inactive",
  "invalid",
]);

export const ListIssuedCertificateMetadataErrorCodes = Object.freeze({
  invalidRequest: "list-issued-certificate-metadata-invalid-request",
  forbidden: "list-issued-certificate-metadata-forbidden",
});

export type ListIssuedCertificateMetadataErrorCode =
  typeof ListIssuedCertificateMetadataErrorCodes[keyof typeof ListIssuedCertificateMetadataErrorCodes];

export type ListIssuedCertificateMetadataOutcome =
  | {
    readonly ok: true;
    readonly value: CertificateMetadataListViewDto;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: ListIssuedCertificateMetadataErrorCode;
      readonly message: string;
    };
  };

export interface ListIssuedCertificateMetadataUseCaseInput {
  readonly actorUserIdentityId: string;
  readonly certificateAuthorityId?: string;
  readonly statuses?: ReadonlyArray<IssuedCertificatePersistenceRecord["status"]>;
  readonly subjectReferenceKinds?: ReadonlyArray<IssuedCertificatePersistenceRecord["subjectReference"]["kind"]>;
  readonly subjectReferenceId?: string;
  readonly linkedNodeId?: string;
  readonly subjectCommonNameContains?: string;
  readonly usageAnyOf?: ReadonlyArray<IssuedCertificatePersistenceRecord["usages"][number]>;
  readonly issuedAfter?: string;
  readonly issuedBefore?: string;
  readonly trustStatuses?: ReadonlyArray<CertificateTrustEvaluationStatus>;
  readonly includeRevoked?: boolean;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

interface ListIssuedCertificateMetadataUseCaseDependencies {
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly authorizationHook?: CertificateQueryAuthorizationHook;
  readonly clock?: CertificateTrustEvaluationClock;
}

interface NormalizedInput {
  readonly actorUserIdentityId: string;
  readonly certificateAuthorityId?: string;
  readonly statuses?: ReadonlyArray<IssuedCertificatePersistenceRecord["status"]>;
  readonly subjectReferenceKinds?: ReadonlyArray<IssuedCertificatePersistenceRecord["subjectReference"]["kind"]>;
  readonly subjectReferenceId?: string;
  readonly linkedNodeId?: string;
  readonly subjectCommonNameContains?: string;
  readonly usageAnyOf?: ReadonlyArray<IssuedCertificatePersistenceRecord["usages"][number]>;
  readonly issuedAfter?: string;
  readonly issuedBefore?: string;
  readonly trustStatuses?: ReadonlySet<CertificateTrustEvaluationStatus>;
  readonly includeRevoked: boolean;
  readonly asOf: string;
  readonly limit: number;
  readonly offset: number;
}

export class ListIssuedCertificateMetadataUseCase {
  private readonly clock: CertificateTrustEvaluationClock;
  private readonly trustEvaluator: CertificateTrustEvaluationService;

  public constructor(private readonly dependencies: ListIssuedCertificateMetadataUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
    this.trustEvaluator = new CertificateTrustEvaluationService({
      clock: this.clock,
    });
  }

  public async execute(input: ListIssuedCertificateMetadataUseCaseInput): Promise<ListIssuedCertificateMetadataOutcome> {
    const normalized = this.normalize(input);
    if (!normalized.ok) {
      return normalized;
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanListIssuedCertificateMetadata({
          actorUserIdentityId: normalized.value.actorUserIdentityId,
          query: Object.freeze({
            certificateAuthorityId: normalized.value.certificateAuthorityId,
            statuses: normalized.value.statuses,
            subjectReferenceKinds: normalized.value.subjectReferenceKinds,
            subjectReferenceId: normalized.value.subjectReferenceId,
            linkedNodeId: normalized.value.linkedNodeId,
            subjectCommonNameContains: normalized.value.subjectCommonNameContains,
            usageAnyOf: normalized.value.usageAnyOf,
            issuedAfter: normalized.value.issuedAfter,
            issuedBefore: normalized.value.issuedBefore,
            trustStatuses: normalized.value.trustStatuses ? [...normalized.value.trustStatuses] : undefined,
            includeRevoked: normalized.value.includeRevoked,
            asOf: normalized.value.asOf,
            limit: normalized.value.limit,
            offset: normalized.value.offset,
          }),
        });
      }
    } catch (error) {
      return this.failure(
        "forbidden",
        error instanceof Error ? error.message : "Actor is not authorized to list issued certificate metadata.",
      );
    }

    const requiresPostFilter = Boolean(
      normalized.value.subjectCommonNameContains
      || normalized.value.trustStatuses
      || normalized.value.linkedNodeId,
    );

    const records = await this.dependencies.issuedCertificateRepository.listIssuedCertificates({
      certificateAuthorityId: normalized.value.certificateAuthorityId,
      statuses: normalized.value.statuses,
      subjectReferenceKinds: normalized.value.linkedNodeId
        ? [CertificateSubjectReferenceKinds.node]
        : normalized.value.subjectReferenceKinds,
      subjectReferenceId: normalized.value.linkedNodeId ?? normalized.value.subjectReferenceId,
      usageAnyOf: normalized.value.usageAnyOf,
      issuedAfter: normalized.value.issuedAfter,
      issuedBefore: normalized.value.issuedBefore,
      includeRevoked: normalized.value.includeRevoked,
      ...(requiresPostFilter
        ? {}
        : {
          limit: normalized.value.limit + 1,
          offset: normalized.value.offset,
        }),
    });

    const mapped = [...records]
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))
      .map((record) => this.toMetadataView(record, normalized.value.asOf));

    const filtered = mapped.filter((record) => {
      if (
        normalized.value.subjectCommonNameContains
        && !record.subject.commonName.toLowerCase().includes(normalized.value.subjectCommonNameContains)
      ) {
        return false;
      }
      if (normalized.value.trustStatuses && !normalized.value.trustStatuses.has(record.trust.status)) {
        return false;
      }
      if (
        normalized.value.linkedNodeId
        && (record.subjectReference.kind !== CertificateSubjectReferenceKinds.node
          || record.subjectReference.referenceId !== normalized.value.linkedNodeId)
      ) {
        return false;
      }
      return true;
    });

    const { page, hasMore } = requiresPostFilter
      ? this.page(filtered, normalized.value.limit, normalized.value.offset)
      : {
        page: filtered.slice(0, normalized.value.limit),
        hasMore: filtered.length > normalized.value.limit,
      };

    return {
      ok: true,
      value: Object.freeze({
        asOf: normalized.value.asOf,
        items: Object.freeze(page),
        pagination: Object.freeze({
          limit: normalized.value.limit,
          offset: normalized.value.offset,
          returned: page.length,
          hasMore,
        }),
      }),
    };
  }

  private toMetadataView(record: IssuedCertificatePersistenceRecord, asOf: string): IssuedCertificateMetadataViewDto {
    const trust = this.trustEvaluator.evaluateIssuedCertificateTrust({
      serialNumber: record.serialNumber,
      certificate: record,
      asOf,
    });

    return Object.freeze({
      certificateAuthorityId: record.certificateAuthorityId,
      serialNumber: record.serialNumber,
      status: record.status,
      trust: Object.freeze({
        status: trust.status,
        active: trust.active,
        revoked: trust.revoked,
        expired: trust.expired,
        usable: trust.usable,
        checkedAt: trust.checkedAt,
      }),
      subject: Object.freeze({
        commonName: record.subject.commonName,
        organization: record.subject.organization,
        organizationalUnit: record.subject.organizationalUnit,
        country: record.subject.country,
        stateOrProvince: record.subject.stateOrProvince,
        locality: record.subject.locality,
        dnsNames: record.subject.dnsNames,
        ipAddresses: record.subject.ipAddresses,
        uriSanEntries: record.subject.uriSanEntries,
      }),
      subjectReference: Object.freeze({
        kind: record.subjectReference.kind,
        referenceId: record.subjectReference.referenceId,
        workspaceId: record.subjectReference.workspaceId,
      }),
      usages: record.usages,
      validity: Object.freeze({
        notBefore: record.validity.notBefore,
        notAfter: record.validity.notAfter,
      }),
      issuedAt: record.issuedAt,
      publicKeyAlgorithm: record.publicKeyAlgorithm,
      publicKeyFingerprintSha256: record.publicKeyFingerprintSha256,
      revocation: record.revocation
        ? Object.freeze({
          reason: record.revocation.reason,
          revokedAt: record.revocation.revokedAt,
          revokedByActorId: record.revocation.revokedByActorId,
          note: record.revocation.note,
        })
        : undefined,
      supersededBySerialNumber: record.supersededBySerialNumber,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      lastModifiedAt: record.lastModifiedAt,
      lastModifiedBy: record.lastModifiedBy,
    });
  }

  private normalize(
    input: ListIssuedCertificateMetadataUseCaseInput,
  ): ListIssuedCertificateMetadataOutcome | { readonly ok: true; readonly value: NormalizedInput } {
    const actorUserIdentityId = input.actorUserIdentityId?.trim();
    if (!actorUserIdentityId) {
      return this.failure("invalidRequest", "actorUserIdentityId is required.");
    }

    const issuedAfter = normalizeOptionalIsoTimestamp(input.issuedAfter);
    if (input.issuedAfter && !issuedAfter) {
      return this.failure("invalidRequest", "issuedAfter must be a valid timestamp.");
    }

    const issuedBefore = normalizeOptionalIsoTimestamp(input.issuedBefore);
    if (input.issuedBefore && !issuedBefore) {
      return this.failure("invalidRequest", "issuedBefore must be a valid timestamp.");
    }

    if (issuedAfter && issuedBefore && Date.parse(issuedAfter) > Date.parse(issuedBefore)) {
      return this.failure("invalidRequest", "issuedAfter must be earlier than or equal to issuedBefore.");
    }

    const asOf = normalizeOptionalIsoTimestamp(input.asOf) ?? this.clock.now().toISOString();
    if (input.asOf && !normalizeOptionalIsoTimestamp(input.asOf)) {
      return this.failure("invalidRequest", "asOf must be a valid timestamp.");
    }

    const linkedNodeId = normalizeOptionalString(input.linkedNodeId);
    const subjectReferenceId = normalizeOptionalString(input.subjectReferenceId);
    const certificateAuthorityId = normalizeOptionalString(input.certificateAuthorityId);
    const subjectCommonNameContains = normalizeOptionalString(input.subjectCommonNameContains)?.toLowerCase();

    const trustStatuses = input.trustStatuses && input.trustStatuses.length > 0
      ? new Set(input.trustStatuses)
      : undefined;

    if (trustStatuses && [...trustStatuses].some((status) => !ValidStatuses.has(status))) {
      return this.failure("invalidRequest", "trustStatuses includes an unsupported status.");
    }

    const limit = Number.isInteger(input.limit) && (input.limit ?? 0) > 0
      ? Math.min(input.limit as number, MaxLimit)
      : DefaultLimit;
    const offset = Number.isInteger(input.offset) && (input.offset ?? -1) >= 0
      ? input.offset as number
      : 0;

    return {
      ok: true,
      value: Object.freeze({
        actorUserIdentityId,
        certificateAuthorityId,
        statuses: input.statuses,
        subjectReferenceKinds: input.subjectReferenceKinds,
        subjectReferenceId,
        linkedNodeId,
        subjectCommonNameContains,
        usageAnyOf: input.usageAnyOf,
        issuedAfter,
        issuedBefore,
        trustStatuses,
        includeRevoked: input.includeRevoked ?? true,
        asOf,
        limit,
        offset,
      }),
    };
  }

  private page<T>(items: ReadonlyArray<T>, limit: number, offset: number): { page: ReadonlyArray<T>; hasMore: boolean } {
    const page = items.slice(offset, offset + limit);
    return {
      page,
      hasMore: items.length > offset + limit,
    };
  }

  private failure(code: "invalidRequest" | "forbidden", message: string): ListIssuedCertificateMetadataOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code: ListIssuedCertificateMetadataErrorCodes[code],
        message,
      }),
    };
  }
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : undefined;
}

function normalizeOptionalIsoTimestamp(value?: string): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  const epoch = Date.parse(normalized);
  if (Number.isNaN(epoch)) {
    return undefined;
  }
  return new Date(epoch).toISOString();
}
