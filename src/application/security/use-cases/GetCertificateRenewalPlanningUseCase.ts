import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import {
  CertificateRenewalPlanningService,
  CertificateRenewalStates,
  type CertificateAuthorityRenewalAssessment,
  type IssuedCertificateRenewalAssessment,
} from "./CertificateRenewalPlanningService";

export interface CertificateRenewalPlanningClock {
  now(): Date;
}

export interface GetCertificateRenewalPlanningUseCaseInput {
  readonly certificateAuthorityId?: string;
  readonly asOf?: string;
  readonly issuedCertificateRenewalSoonWindowDays?: number;
  readonly issuedCertificateRenewalRequiredWindowDays?: number;
  readonly certificateAuthorityRenewalSoonLeadDays?: number;
  readonly includeNonRenewableCertificates?: boolean;
}

export interface CertificateRenewalPlanningAttentionItem {
  readonly scope: "certificate-authority" | "issued-certificate";
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
}

export interface CertificateRenewalPlanningSummary {
  readonly totalTracked: number;
  readonly active: number;
  readonly renewalSoon: number;
  readonly renewalRequired: number;
  readonly expired: number;
  readonly stale: number;
  readonly attentionRequired: boolean;
}

export interface CertificateRenewalPlanningView {
  readonly asOf: string;
  readonly policy: {
    readonly issuedCertificateRenewalSoonWindowDays: number;
    readonly issuedCertificateRenewalRequiredWindowDays: number;
    readonly certificateAuthorityRenewalSoonLeadDays: number;
  };
  readonly certificateAuthority?: CertificateAuthorityRenewalAssessment;
  readonly certificates: ReadonlyArray<IssuedCertificateRenewalAssessment>;
  readonly summary: CertificateRenewalPlanningSummary;
  readonly attention: ReadonlyArray<CertificateRenewalPlanningAttentionItem>;
}

interface GetCertificateRenewalPlanningUseCaseDependencies {
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly renewalPlanner?: CertificateRenewalPlanningService;
  readonly clock?: CertificateRenewalPlanningClock;
}

const DEFAULT_ISSUED_CERTIFICATE_RENEWAL_SOON_WINDOW_DAYS = 30;
const DEFAULT_ISSUED_CERTIFICATE_RENEWAL_REQUIRED_WINDOW_DAYS = 7;
const DEFAULT_CA_RENEWAL_SOON_LEAD_DAYS = 30;

export class GetCertificateRenewalPlanningUseCase {
  private readonly renewalPlanner: CertificateRenewalPlanningService;
  private readonly clock: CertificateRenewalPlanningClock;

  public constructor(private readonly dependencies: GetCertificateRenewalPlanningUseCaseDependencies) {
    this.renewalPlanner = dependencies.renewalPlanner ?? new CertificateRenewalPlanningService();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetCertificateRenewalPlanningUseCaseInput = {},
  ): Promise<CertificateRenewalPlanningView> {
    const asOf = normalizeTimestamp(input.asOf, this.clock.now().toISOString());
    const policy = normalizePolicy(input);
    const includeNonRenewableCertificates = input.includeNonRenewableCertificates ?? false;

    const authority = input.certificateAuthorityId
      ? await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(input.certificateAuthorityId)
      : await this.dependencies.certificateAuthorityRepository.findActiveCertificateAuthority(asOf);

    if (!authority) {
      return buildResult({
        asOf,
        policy,
        certificates: Object.freeze([]),
        attention: Object.freeze([{
          scope: "certificate-authority",
          code: "certificate-authority-not-found",
          severity: "warning",
          message: "No certificate authority was found for renewal planning.",
        }]),
      });
    }

    const certificateRecords = await this.dependencies.issuedCertificateRepository.listIssuedCertificates({
      certificateAuthorityId: authority.certificateAuthorityId,
      includeRevoked: true,
    });

    const certificateAssessments = certificateRecords
      .map((certificate) => this.renewalPlanner.evaluateIssuedCertificate({
        certificate,
        asOf,
        policy: {
          renewalSoonWindowDays: policy.issuedCertificateRenewalSoonWindowDays,
          renewalRequiredWindowDays: policy.issuedCertificateRenewalRequiredWindowDays,
        },
      }))
      .filter((assessment) => includeNonRenewableCertificates || assessment.trackedForRenewal);

    const authorityAssessment = this.renewalPlanner.evaluateCertificateAuthority({
      authority,
      asOf,
      policy: {
        renewalSoonLeadDays: policy.certificateAuthorityRenewalSoonLeadDays,
      },
    });

    return buildResult({
      asOf,
      policy,
      certificateAuthority: authorityAssessment,
      certificates: Object.freeze(certificateAssessments),
      attention: Object.freeze([
        ...toCertificateAuthorityAttention(authorityAssessment),
        ...certificateAssessments.flatMap((assessment) => toIssuedCertificateAttention(assessment)),
      ]),
    });
  }
}

function normalizePolicy(input: GetCertificateRenewalPlanningUseCaseInput): {
  readonly issuedCertificateRenewalSoonWindowDays: number;
  readonly issuedCertificateRenewalRequiredWindowDays: number;
  readonly certificateAuthorityRenewalSoonLeadDays: number;
} {
  const issuedCertificateRenewalRequiredWindowDays = normalizePositiveInt(
    input.issuedCertificateRenewalRequiredWindowDays,
    DEFAULT_ISSUED_CERTIFICATE_RENEWAL_REQUIRED_WINDOW_DAYS,
    "issuedCertificateRenewalRequiredWindowDays",
  );
  const issuedCertificateRenewalSoonWindowDays = normalizePositiveInt(
    input.issuedCertificateRenewalSoonWindowDays,
    DEFAULT_ISSUED_CERTIFICATE_RENEWAL_SOON_WINDOW_DAYS,
    "issuedCertificateRenewalSoonWindowDays",
  );
  if (issuedCertificateRenewalSoonWindowDays < issuedCertificateRenewalRequiredWindowDays) {
    throw new Error("issuedCertificateRenewalSoonWindowDays must be greater than or equal to issuedCertificateRenewalRequiredWindowDays.");
  }

  return Object.freeze({
    issuedCertificateRenewalSoonWindowDays,
    issuedCertificateRenewalRequiredWindowDays,
    certificateAuthorityRenewalSoonLeadDays: normalizePositiveInt(
      input.certificateAuthorityRenewalSoonLeadDays,
      DEFAULT_CA_RENEWAL_SOON_LEAD_DAYS,
      "certificateAuthorityRenewalSoonLeadDays",
    ),
  });
}

function normalizePositiveInt(value: number | undefined, fallback: number, fieldName: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`${fieldName} must be an integer greater than or equal to 1.`);
  }
  return resolved;
}

function normalizeTimestamp(candidate: string | undefined, fallback: string): string {
  const resolved = candidate?.trim() || fallback;
  const epoch = Date.parse(resolved);
  if (Number.isNaN(epoch)) {
    throw new Error("asOf must be a valid timestamp when provided.");
  }
  return new Date(epoch).toISOString();
}

function buildResult(input: {
  readonly asOf: string;
  readonly policy: {
    readonly issuedCertificateRenewalSoonWindowDays: number;
    readonly issuedCertificateRenewalRequiredWindowDays: number;
    readonly certificateAuthorityRenewalSoonLeadDays: number;
  };
  readonly certificateAuthority?: CertificateAuthorityRenewalAssessment;
  readonly certificates: ReadonlyArray<IssuedCertificateRenewalAssessment>;
  readonly attention: ReadonlyArray<CertificateRenewalPlanningAttentionItem>;
}): CertificateRenewalPlanningView {
  const summary = summarizeCertificates(input.certificates, input.attention);
  return Object.freeze({
    asOf: input.asOf,
    policy: input.policy,
    certificateAuthority: input.certificateAuthority,
    certificates: input.certificates,
    summary,
    attention: input.attention,
  });
}

function summarizeCertificates(
  certificates: ReadonlyArray<IssuedCertificateRenewalAssessment>,
  attention: ReadonlyArray<CertificateRenewalPlanningAttentionItem>,
): CertificateRenewalPlanningSummary {
  let active = 0;
  let renewalSoon = 0;
  let renewalRequired = 0;
  let expired = 0;
  let stale = 0;

  for (const certificate of certificates) {
    if (certificate.renewalState === CertificateRenewalStates.active) {
      active += 1;
    } else if (certificate.renewalState === CertificateRenewalStates.renewalSoon) {
      renewalSoon += 1;
    } else if (certificate.renewalState === CertificateRenewalStates.renewalRequired) {
      renewalRequired += 1;
    } else if (certificate.renewalState === CertificateRenewalStates.expired) {
      expired += 1;
    }

    if (certificate.stale) {
      stale += 1;
    }
  }

  return Object.freeze({
    totalTracked: certificates.length,
    active,
    renewalSoon,
    renewalRequired,
    expired,
    stale,
    attentionRequired: attention.length > 0,
  });
}

function toCertificateAuthorityAttention(
  assessment: CertificateAuthorityRenewalAssessment,
): ReadonlyArray<CertificateRenewalPlanningAttentionItem> {
  return assessment.attentionCodes.map((code) => Object.freeze({
    scope: "certificate-authority",
    code,
    severity: code === "ca-expired" || code === "ca-status-not-active" ? "error" : "warning",
    message: toCertificateAuthorityAttentionMessage(code),
    certificateAuthorityId: assessment.certificateAuthorityId,
  }));
}

function toIssuedCertificateAttention(
  assessment: IssuedCertificateRenewalAssessment,
): ReadonlyArray<CertificateRenewalPlanningAttentionItem> {
  return assessment.attentionCodes.map((code) => Object.freeze({
    scope: "issued-certificate",
    code,
    severity: code === "certificate-expired" ? "error" : "warning",
    message: toIssuedCertificateAttentionMessage(code),
    certificateAuthorityId: assessment.certificateAuthorityId,
    serialNumber: assessment.serialNumber,
  }));
}

function toCertificateAuthorityAttentionMessage(code: string): string {
  if (code === "ca-status-not-active") {
    return "Certificate authority is not in active status.";
  }
  if (code === "ca-rotation-required") {
    return "Certificate authority rotation is required.";
  }
  if (code === "ca-expired") {
    return "Certificate authority has expired.";
  }
  if (code === "ca-autorotate-disabled-manual-rotation-required") {
    return "Automatic CA rotation is disabled and manual intervention is required.";
  }
  if (code === "ca-next-rotation-due") {
    return "Configured next CA rotation due date has passed.";
  }
  return "Certificate authority requires operator attention.";
}

function toIssuedCertificateAttentionMessage(code: string): string {
  if (code === "certificate-status-not-renewable") {
    return "Certificate status is not tracked for renewal planning.";
  }
  if (code === "certificate-status-stale-expired") {
    return "Certificate status is stale: issued certificate is already expired.";
  }
  if (code === "certificate-status-stale-issued") {
    return "Certificate status is stale: certificate is marked expired but validity is still active.";
  }
  if (code === "certificate-renewal-required") {
    return "Certificate renewal is required.";
  }
  if (code === "certificate-expired") {
    return "Certificate has expired.";
  }
  return "Certificate requires operator attention.";
}
