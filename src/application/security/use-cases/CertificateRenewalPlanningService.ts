import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
} from "../../../domain/security/CertificateAuthorityDomain";
import type {
  CertificateAuthorityRootPersistenceRecord,
  IssuedCertificatePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const CertificateRenewalStates = Object.freeze({
  active: "active",
  renewalSoon: "renewal-soon",
  renewalRequired: "renewal-required",
  expired: "expired",
});

export type CertificateRenewalState =
  typeof CertificateRenewalStates[keyof typeof CertificateRenewalStates];

export interface IssuedCertificateRenewalPolicy {
  readonly renewalSoonWindowDays: number;
  readonly renewalRequiredWindowDays: number;
}

export interface CertificateAuthorityRenewalPolicy {
  readonly renewalSoonLeadDays: number;
}

export interface IssuedCertificateRenewalAssessment {
  readonly serialNumber: string;
  readonly certificateAuthorityId: string;
  readonly certificateStatus: IssuedCertificatePersistenceRecord["status"];
  readonly trackedForRenewal: boolean;
  readonly renewalState: CertificateRenewalState;
  readonly renewalEligible: boolean;
  readonly renewalRequired: boolean;
  readonly stale: boolean;
  readonly checkedAt: string;
  readonly validityNotBefore: string;
  readonly validityNotAfter: string;
  readonly renewalSoonAt: string;
  readonly renewalRequiredAt: string;
  readonly daysUntilExpiry: number;
  readonly attentionCodes: ReadonlyArray<string>;
}

export interface CertificateAuthorityRenewalAssessment {
  readonly certificateAuthorityId: string;
  readonly authorityStatus: CertificateAuthorityRootPersistenceRecord["status"];
  readonly renewalState: CertificateRenewalState;
  readonly renewalRequired: boolean;
  readonly checkedAt: string;
  readonly validityNotAfter: string;
  readonly renewalSoonAt: string;
  readonly renewalRequiredAt: string;
  readonly daysUntilExpiry: number;
  readonly attentionCodes: ReadonlyArray<string>;
}

export class CertificateRenewalPlanningService {
  public evaluateIssuedCertificate(
    input: {
      readonly certificate: IssuedCertificatePersistenceRecord;
      readonly asOf: string;
      readonly policy: IssuedCertificateRenewalPolicy;
    },
  ): IssuedCertificateRenewalAssessment {
    const policy = normalizeIssuedPolicy(input.policy);
    const checkedAt = normalizeTimestamp(input.asOf, "asOf");
    const validity = normalizeValidity(input.certificate.validity.notBefore, input.certificate.validity.notAfter);
    const timeline = classifyRenewalTimeline({
      asOfEpoch: Date.parse(checkedAt),
      notAfterEpoch: validity.notAfterEpoch,
      renewalSoonWindowDays: policy.renewalSoonWindowDays,
      renewalRequiredWindowDays: policy.renewalRequiredWindowDays,
    });

    const trackedForRenewal = (
      input.certificate.status === CertificateStatuses.issued
      || input.certificate.status === CertificateStatuses.expired
    );

    const attentionCodes: string[] = [];
    if (!trackedForRenewal) {
      attentionCodes.push("certificate-status-not-renewable");
    }
    if (
      input.certificate.status === CertificateStatuses.issued
      && timeline.renewalState === CertificateRenewalStates.expired
    ) {
      attentionCodes.push("certificate-status-stale-expired");
    }
    if (
      input.certificate.status === CertificateStatuses.expired
      && timeline.renewalState !== CertificateRenewalStates.expired
    ) {
      attentionCodes.push("certificate-status-stale-issued");
    }
    if (timeline.renewalState === CertificateRenewalStates.renewalRequired) {
      attentionCodes.push("certificate-renewal-required");
    }
    if (timeline.renewalState === CertificateRenewalStates.expired) {
      attentionCodes.push("certificate-expired");
    }

    const renewalEligible = trackedForRenewal && timeline.renewalState !== CertificateRenewalStates.active;
    const renewalRequired = trackedForRenewal && (
      timeline.renewalState === CertificateRenewalStates.renewalRequired
      || timeline.renewalState === CertificateRenewalStates.expired
    );

    return Object.freeze({
      serialNumber: input.certificate.serialNumber,
      certificateAuthorityId: input.certificate.certificateAuthorityId,
      certificateStatus: input.certificate.status,
      trackedForRenewal,
      renewalState: timeline.renewalState,
      renewalEligible,
      renewalRequired,
      stale: attentionCodes.some((code) => code.startsWith("certificate-status-stale")),
      checkedAt,
      validityNotBefore: validity.notBefore,
      validityNotAfter: validity.notAfter,
      renewalSoonAt: new Date(timeline.renewalSoonEpoch).toISOString(),
      renewalRequiredAt: new Date(timeline.renewalRequiredEpoch).toISOString(),
      daysUntilExpiry: timeline.daysUntilExpiry,
      attentionCodes: Object.freeze(attentionCodes),
    });
  }

  public evaluateCertificateAuthority(
    input: {
      readonly authority: CertificateAuthorityRootPersistenceRecord;
      readonly asOf: string;
      readonly policy: CertificateAuthorityRenewalPolicy;
    },
  ): CertificateAuthorityRenewalAssessment {
    const policy = normalizeAuthorityPolicy(input.policy);
    const checkedAt = normalizeTimestamp(input.asOf, "asOf");
    const validity = normalizeValidity(input.authority.validity.notBefore, input.authority.validity.notAfter);
    const requiredWindowDays = normalizePositiveInt(
      input.authority.rotationPolicy.rotateBeforeExpiryDays,
      "authority.rotationPolicy.rotateBeforeExpiryDays",
    );
    const soonWindowDays = requiredWindowDays + policy.renewalSoonLeadDays;
    const timeline = classifyRenewalTimeline({
      asOfEpoch: Date.parse(checkedAt),
      notAfterEpoch: validity.notAfterEpoch,
      renewalSoonWindowDays: soonWindowDays,
      renewalRequiredWindowDays: requiredWindowDays,
    });

    const attentionCodes: string[] = [];
    if (input.authority.status !== CertificateAuthorityStatuses.active) {
      attentionCodes.push("ca-status-not-active");
    }
    if (timeline.renewalState === CertificateRenewalStates.renewalRequired) {
      attentionCodes.push("ca-rotation-required");
    }
    if (timeline.renewalState === CertificateRenewalStates.expired) {
      attentionCodes.push("ca-expired");
    }
    if (
      !input.authority.rotationPolicy.autoRotateEnabled
      && timeline.renewalState !== CertificateRenewalStates.active
    ) {
      attentionCodes.push("ca-autorotate-disabled-manual-rotation-required");
    }
    const nextRotationDueAt = input.authority.rotationPolicy.nextRotationDueAt;
    if (nextRotationDueAt && Date.parse(nextRotationDueAt) <= Date.parse(checkedAt)) {
      attentionCodes.push("ca-next-rotation-due");
    }

    return Object.freeze({
      certificateAuthorityId: input.authority.certificateAuthorityId,
      authorityStatus: input.authority.status,
      renewalState: timeline.renewalState,
      renewalRequired: (
        timeline.renewalState === CertificateRenewalStates.renewalRequired
        || timeline.renewalState === CertificateRenewalStates.expired
      ),
      checkedAt,
      validityNotAfter: validity.notAfter,
      renewalSoonAt: new Date(timeline.renewalSoonEpoch).toISOString(),
      renewalRequiredAt: new Date(timeline.renewalRequiredEpoch).toISOString(),
      daysUntilExpiry: timeline.daysUntilExpiry,
      attentionCodes: Object.freeze(attentionCodes),
    });
  }
}

function classifyRenewalTimeline(input: {
  readonly asOfEpoch: number;
  readonly notAfterEpoch: number;
  readonly renewalSoonWindowDays: number;
  readonly renewalRequiredWindowDays: number;
}): {
  readonly renewalState: CertificateRenewalState;
  readonly renewalSoonEpoch: number;
  readonly renewalRequiredEpoch: number;
  readonly daysUntilExpiry: number;
} {
  const renewalSoonEpoch = input.notAfterEpoch - (input.renewalSoonWindowDays * DAY_IN_MILLISECONDS);
  const renewalRequiredEpoch = input.notAfterEpoch - (input.renewalRequiredWindowDays * DAY_IN_MILLISECONDS);
  const daysUntilExpiry = Math.floor((input.notAfterEpoch - input.asOfEpoch) / DAY_IN_MILLISECONDS);

  const renewalState = input.asOfEpoch >= input.notAfterEpoch
    ? CertificateRenewalStates.expired
    : input.asOfEpoch >= renewalRequiredEpoch
      ? CertificateRenewalStates.renewalRequired
      : input.asOfEpoch >= renewalSoonEpoch
        ? CertificateRenewalStates.renewalSoon
        : CertificateRenewalStates.active;

  return Object.freeze({
    renewalState,
    renewalSoonEpoch,
    renewalRequiredEpoch,
    daysUntilExpiry,
  });
}

function normalizeIssuedPolicy(policy: IssuedCertificateRenewalPolicy): IssuedCertificateRenewalPolicy {
  const renewalRequiredWindowDays = normalizePositiveInt(policy.renewalRequiredWindowDays, "renewalRequiredWindowDays");
  const renewalSoonWindowDays = normalizePositiveInt(policy.renewalSoonWindowDays, "renewalSoonWindowDays");
  if (renewalSoonWindowDays < renewalRequiredWindowDays) {
    throw new Error("renewalSoonWindowDays must be greater than or equal to renewalRequiredWindowDays.");
  }
  return Object.freeze({
    renewalSoonWindowDays,
    renewalRequiredWindowDays,
  });
}

function normalizeAuthorityPolicy(policy: CertificateAuthorityRenewalPolicy): CertificateAuthorityRenewalPolicy {
  return Object.freeze({
    renewalSoonLeadDays: normalizePositiveInt(policy.renewalSoonLeadDays, "renewalSoonLeadDays"),
  });
}

function normalizePositiveInt(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be an integer greater than or equal to 1.`);
  }
  return value;
}

function normalizeTimestamp(value: string, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  const epoch = Date.parse(normalized);
  if (Number.isNaN(epoch)) {
    throw new Error(`${fieldName} must be a valid timestamp.`);
  }
  return new Date(epoch).toISOString();
}

function normalizeValidity(notBefore: string, notAfter: string): {
  readonly notBefore: string;
  readonly notAfter: string;
  readonly notAfterEpoch: number;
} {
  const normalizedNotBefore = normalizeTimestamp(notBefore, "validity.notBefore");
  const normalizedNotAfter = normalizeTimestamp(notAfter, "validity.notAfter");
  const notBeforeEpoch = Date.parse(normalizedNotBefore);
  const notAfterEpoch = Date.parse(normalizedNotAfter);
  if (notAfterEpoch <= notBeforeEpoch) {
    throw new Error("validity.notAfter must be later than validity.notBefore.");
  }

  return Object.freeze({
    notBefore: normalizedNotBefore,
    notAfter: normalizedNotAfter,
    notAfterEpoch,
  });
}
