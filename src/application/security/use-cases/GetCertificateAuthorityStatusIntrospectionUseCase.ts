import { CertificateAuthorityStatuses, CertificateStatuses } from "@domain/security/CertificateAuthorityDomain";
import { CertificateDistributionEventStatuses, type CertificateAuthorityStatusIntrospectionViewDto } from "@shared/dto/security/CertificateAuthorityDtos";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import {
  CertificateAuthorityStartupStates,
  type ResolveCertificateAuthorityStartupStateUseCase,
} from "./ResolveCertificateAuthorityStartupStateUseCase";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface CertificateAuthorityStatusIntrospectionClock {
  now(): Date;
}

export interface GetCertificateAuthorityStatusIntrospectionUseCaseInput {
  readonly asOf?: string;
  readonly rotationWarningWindowDays?: number;
  readonly certificateExpiryWarningWindowDays?: number;
}

interface GetCertificateAuthorityStatusIntrospectionUseCaseDependencies {
  readonly startupStateResolver: ResolveCertificateAuthorityStartupStateUseCase;
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly certificateLifecycleEventRepository: ICertificateLifecycleEventPersistenceRepository;
  readonly clock?: CertificateAuthorityStatusIntrospectionClock;
}

export class GetCertificateAuthorityStatusIntrospectionUseCase {
  private readonly clock: CertificateAuthorityStatusIntrospectionClock;

  public constructor(
    private readonly dependencies: GetCertificateAuthorityStatusIntrospectionUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetCertificateAuthorityStatusIntrospectionUseCaseInput = {},
  ): Promise<CertificateAuthorityStatusIntrospectionViewDto> {
    const asOfIso = toAsOfIso(input.asOf, this.clock);
    const asOfEpoch = Date.parse(asOfIso);
    const rotationWarningWindowDays = normalizePositiveInt(input.rotationWarningWindowDays, 30);
    const certificateExpiryWarningWindowDays = normalizePositiveInt(input.certificateExpiryWarningWindowDays, 30);

    const startup = await this.dependencies.startupStateResolver.execute();

    const authority = startup.certificateAuthorityId
      ? await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(startup.certificateAuthorityId)
      : await this.dependencies.certificateAuthorityRepository.findActiveCertificateAuthority(asOfIso);

    const certificates = authority
      ? await this.dependencies.issuedCertificateRepository.listIssuedCertificates({
        certificateAuthorityId: authority.certificateAuthorityId,
        includeRevoked: true,
      })
      : Object.freeze([]);

    const distributionFailures = authority
      ? await this.dependencies.certificateLifecycleEventRepository.listCertificateDistributionEvents({
        certificateAuthorityId: authority.certificateAuthorityId,
        statuses: [CertificateDistributionEventStatuses.failed],
        limit: 1,
      })
      : Object.freeze([]);

    const certificateCounts = summarizeCertificateCounts(certificates, asOfEpoch);
    const lastIssuedAt = findLastIssuedAt(certificates);
    const hasRevokedCertificates = certificateCounts.revoked > 0;
    const hasExpiringCertificates = hasExpiringIssuedCertificates(
      certificates,
      asOfEpoch,
      certificateExpiryWarningWindowDays,
    );
    const hasDistributionFailures = distributionFailures.length > 0;

    const rotationCheckpoint = authority
      ? toRotationCheckpoint(authority.validity.notAfter, authority.rotationPolicy, asOfEpoch)
      : undefined;

    const rotationDueSoon = Boolean(
      rotationCheckpoint
      && !rotationCheckpoint.isOverdue
      && rotationCheckpoint.daysUntilRecommendedRotation <= rotationWarningWindowDays,
    );
    const rotationOverdue = Boolean(rotationCheckpoint?.isOverdue);

    const configurationBlocked = (
      startup.state === CertificateAuthorityStartupStates.invalid
      || startup.state === CertificateAuthorityStartupStates.revoked
      || startup.state === CertificateAuthorityStartupStates.migrationRequired
    );

    const authorityActive = Boolean(
      authority
      && authority.status === CertificateAuthorityStatuses.active,
    );
    const initialized = Boolean(authority || startup.state === CertificateAuthorityStartupStates.initialized);
    const blocked = configurationBlocked || (authority ? authority.status !== CertificateAuthorityStatuses.active : false);
    const degraded = (
      initialized
      && !blocked
      && (rotationDueSoon || rotationOverdue || hasExpiringCertificates || hasDistributionFailures)
    );

    const state = blocked
      ? "blocked"
      : !initialized
        ? "uninitialized"
        : degraded
          ? "degraded"
          : "healthy";

    const diagnostics = Object.freeze([
      ...startup.diagnostics.map((diagnostic) => Object.freeze({
        code: diagnostic.code,
        severity: configurationBlocked ? "error" : startup.state === CertificateAuthorityStartupStates.uninitialized ? "info" : "warning",
        message: diagnostic.message,
      } as const)),
      ...(rotationOverdue
        ? [Object.freeze({
          code: "ca-rotation-overdue",
          severity: "warning" as const,
          message: "Certificate authority rotation checkpoint has passed and rotation should be scheduled immediately.",
        })]
        : []),
      ...(rotationDueSoon
        ? [Object.freeze({
          code: "ca-rotation-due-soon",
          severity: "warning" as const,
          message: "Certificate authority is nearing the recommended rotation checkpoint.",
        })]
        : []),
      ...(hasExpiringCertificates
        ? [Object.freeze({
          code: "issued-certificates-expiring-soon",
          severity: "warning" as const,
          message: "At least one issued certificate is approaching expiry and should be rotated.",
        })]
        : []),
      ...(hasDistributionFailures
        ? [Object.freeze({
          code: "trust-distribution-failures-detected",
          severity: "warning" as const,
          message: "Recent trust material distribution failures were detected.",
        })]
        : []),
    ]);

    return Object.freeze({
      asOf: asOfIso,
      initialized,
      active: authorityActive && !blocked,
      blocked,
      state,
      certificateAuthorityId: authority?.certificateAuthorityId ?? startup.certificateAuthorityId,
      authority: authority
        ? Object.freeze({
          certificateAuthorityId: authority.certificateAuthorityId,
          displayName: authority.displayName,
          createdAt: authority.createdAt,
          lastModifiedAt: authority.lastModifiedAt,
          status: authority.status,
          validityNotBefore: authority.validity.notBefore,
          validityNotAfter: authority.validity.notAfter,
          certificateCounts,
          lastIssuedAt,
          rotationCheckpoint: rotationCheckpoint as NonNullable<typeof rotationCheckpoint>,
        })
        : undefined,
      diagnostics,
      healthFlags: Object.freeze({
        startupHealthy: startup.state === CertificateAuthorityStartupStates.initialized,
        configurationBlocked,
        authorityActive,
        rotationDueSoon,
        rotationOverdue,
        hasRevokedCertificates,
        hasExpiringCertificates,
        hasDistributionFailures,
      }),
    });
  }
}

function toAsOfIso(input: string | undefined, clock: CertificateAuthorityStatusIntrospectionClock): string {
  const candidate = input?.trim() ?? clock.now().toISOString();
  const epoch = Date.parse(candidate);
  if (Number.isNaN(epoch)) {
    return clock.now().toISOString();
  }
  return new Date(epoch).toISOString();
}

function normalizePositiveInt(input: number | undefined, defaultValue: number): number {
  return Number.isInteger(input) && (input as number) > 0
    ? input as number
    : defaultValue;
}

function summarizeCertificateCounts(
  certificates: ReadonlyArray<{
    readonly status: string;
    readonly validity: {
      readonly notBefore: string;
      readonly notAfter: string;
    };
  }>,
  asOfEpoch: number,
): {
  readonly total: number;
  readonly issued: number;
  readonly revoked: number;
  readonly expired: number;
  readonly superseded: number;
  readonly activeAtAsOf: number;
} {
  let issued = 0;
  let revoked = 0;
  let expired = 0;
  let superseded = 0;
  let activeAtAsOf = 0;

  for (const certificate of certificates) {
    if (certificate.status === CertificateStatuses.issued) {
      issued += 1;
    } else if (certificate.status === CertificateStatuses.revoked) {
      revoked += 1;
    } else if (certificate.status === CertificateStatuses.expired) {
      expired += 1;
    } else if (certificate.status === CertificateStatuses.superseded) {
      superseded += 1;
    }

    if (
      certificate.status === CertificateStatuses.issued
      && Date.parse(certificate.validity.notBefore) <= asOfEpoch
      && Date.parse(certificate.validity.notAfter) > asOfEpoch
    ) {
      activeAtAsOf += 1;
    }
  }

  return Object.freeze({
    total: certificates.length,
    issued,
    revoked,
    expired,
    superseded,
    activeAtAsOf,
  });
}

function findLastIssuedAt(
  certificates: ReadonlyArray<{
    readonly issuedAt: string;
  }>,
): string | undefined {
  let latest: string | undefined;
  for (const certificate of certificates) {
    if (!latest || certificate.issuedAt > latest) {
      latest = certificate.issuedAt;
    }
  }
  return latest;
}

function toRotationCheckpoint(
  validityNotAfter: string,
  rotationPolicy: {
    readonly rotateBeforeExpiryDays: number;
    readonly nextRotationDueAt?: string;
  },
  asOfEpoch: number,
): {
  readonly recommendedRotationAt: string;
  readonly configuredNextRotationDueAt?: string;
  readonly daysUntilRecommendedRotation: number;
  readonly isDue: boolean;
  readonly isOverdue: boolean;
} {
  const validityNotAfterEpoch = Date.parse(validityNotAfter);
  const recommendedEpoch = validityNotAfterEpoch - (rotationPolicy.rotateBeforeExpiryDays * DAY_IN_MILLISECONDS);
  const daysUntilRecommendedRotation = Math.floor((recommendedEpoch - asOfEpoch) / DAY_IN_MILLISECONDS);

  return Object.freeze({
    recommendedRotationAt: new Date(recommendedEpoch).toISOString(),
    configuredNextRotationDueAt: rotationPolicy.nextRotationDueAt,
    daysUntilRecommendedRotation,
    isDue: asOfEpoch >= recommendedEpoch,
    isOverdue: asOfEpoch > recommendedEpoch,
  });
}

function hasExpiringIssuedCertificates(
  certificates: ReadonlyArray<{
    readonly status: string;
    readonly validity: {
      readonly notAfter: string;
    };
  }>,
  asOfEpoch: number,
  warningWindowDays: number,
): boolean {
  const latestSafeEpoch = asOfEpoch + (warningWindowDays * DAY_IN_MILLISECONDS);
  for (const certificate of certificates) {
    if (certificate.status !== CertificateStatuses.issued) {
      continue;
    }

    const notAfterEpoch = Date.parse(certificate.validity.notAfter);
    if (notAfterEpoch >= asOfEpoch && notAfterEpoch <= latestSafeEpoch) {
      return true;
    }
  }

  return false;
}

