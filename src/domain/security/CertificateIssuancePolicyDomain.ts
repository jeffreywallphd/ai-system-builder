import type {
  CertificateSubjectDescriptor,
  CertificateSubjectReference,
  CertificateSubjectReferenceKind,
  CertificateUsageKind,
} from "./CertificateAuthorityDomain";
import {
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "./CertificateAuthorityDomain";

export const CertificateSubjectProfileKinds = Object.freeze({
  authoritativeServer: "authoritative-server",
  approvedNode: "approved-node",
  internalService: "internal-service",
  trustedDevice: "trusted-device",
});

export type CertificateSubjectProfileKind =
  typeof CertificateSubjectProfileKinds[keyof typeof CertificateSubjectProfileKinds];

export interface CertificateSubjectProfileDefinition {
  readonly kind: CertificateSubjectProfileKind;
  readonly subjectReferenceKind: CertificateSubjectReferenceKind;
  readonly referenceIdPrefix: string;
  readonly issuanceEnabled: boolean;
  readonly allowedUsages: ReadonlyArray<CertificateUsageKind>;
  readonly requiredUsages: ReadonlyArray<CertificateUsageKind>;
  readonly maxValidityDays: number;
  readonly requireDnsSan: boolean;
  readonly requireUriSan: boolean;
  readonly commonNameMustMatchDnsSan: boolean;
  readonly allowIpSans: boolean;
}

export interface EvaluateCertificateIssuancePolicyInput {
  readonly profileKind: CertificateSubjectProfileKind;
  readonly subject: CertificateSubjectDescriptor;
  readonly subjectReference: CertificateSubjectReference;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly validityDays: number;
}

export interface CertificateIssuancePolicyEvaluationResult {
  readonly profile: CertificateSubjectProfileDefinition;
  readonly allowed: boolean;
  readonly violations: ReadonlyArray<string>;
}

const CertificateSubjectProfilesByKind: Readonly<Record<CertificateSubjectProfileKind, CertificateSubjectProfileDefinition>> =
  Object.freeze({
    [CertificateSubjectProfileKinds.authoritativeServer]: Object.freeze({
      kind: CertificateSubjectProfileKinds.authoritativeServer,
      subjectReferenceKind: CertificateSubjectReferenceKinds.service,
      referenceIdPrefix: "server:",
      issuanceEnabled: true,
      allowedUsages: Object.freeze([
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
        CertificateUsageKinds.mutualTls,
      ]),
      requiredUsages: Object.freeze([
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
      ]),
      maxValidityDays: 825,
      requireDnsSan: true,
      requireUriSan: false,
      commonNameMustMatchDnsSan: true,
      allowIpSans: true,
    }),
    [CertificateSubjectProfileKinds.approvedNode]: Object.freeze({
      kind: CertificateSubjectProfileKinds.approvedNode,
      subjectReferenceKind: CertificateSubjectReferenceKinds.node,
      referenceIdPrefix: "node:",
      issuanceEnabled: true,
      allowedUsages: Object.freeze([
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
        CertificateUsageKinds.mutualTls,
        CertificateUsageKinds.nodeEnrollment,
      ]),
      requiredUsages: Object.freeze([
        CertificateUsageKinds.clientAuth,
        CertificateUsageKinds.nodeEnrollment,
      ]),
      maxValidityDays: 397,
      requireDnsSan: false,
      requireUriSan: true,
      commonNameMustMatchDnsSan: false,
      allowIpSans: true,
    }),
    [CertificateSubjectProfileKinds.internalService]: Object.freeze({
      kind: CertificateSubjectProfileKinds.internalService,
      subjectReferenceKind: CertificateSubjectReferenceKinds.service,
      referenceIdPrefix: "service:",
      issuanceEnabled: true,
      allowedUsages: Object.freeze([
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
        CertificateUsageKinds.mutualTls,
        CertificateUsageKinds.serviceIdentity,
      ]),
      requiredUsages: Object.freeze([
        CertificateUsageKinds.serviceIdentity,
      ]),
      maxValidityDays: 397,
      requireDnsSan: true,
      requireUriSan: false,
      commonNameMustMatchDnsSan: true,
      allowIpSans: true,
    }),
    [CertificateSubjectProfileKinds.trustedDevice]: Object.freeze({
      kind: CertificateSubjectProfileKinds.trustedDevice,
      subjectReferenceKind: CertificateSubjectReferenceKinds.device,
      referenceIdPrefix: "device:",
      issuanceEnabled: false,
      allowedUsages: Object.freeze([
        CertificateUsageKinds.deviceTrust,
        CertificateUsageKinds.clientAuth,
        CertificateUsageKinds.mutualTls,
      ]),
      requiredUsages: Object.freeze([
        CertificateUsageKinds.deviceTrust,
      ]),
      maxValidityDays: 90,
      requireDnsSan: false,
      requireUriSan: true,
      commonNameMustMatchDnsSan: false,
      allowIpSans: false,
    }),
  });

export function getCertificateSubjectProfileDefinition(
  profileKind: CertificateSubjectProfileKind,
): CertificateSubjectProfileDefinition {
  return CertificateSubjectProfilesByKind[profileKind];
}

export function listCertificateSubjectProfileDefinitions(): ReadonlyArray<CertificateSubjectProfileDefinition> {
  return Object.freeze(Object.values(CertificateSubjectProfilesByKind));
}

export function evaluateCertificateIssuancePolicy(
  input: EvaluateCertificateIssuancePolicyInput,
): CertificateIssuancePolicyEvaluationResult {
  const profile = getCertificateSubjectProfileDefinition(input.profileKind);
  const violations: string[] = [];

  if (!profile.issuanceEnabled) {
    violations.push(`Certificate subject profile '${profile.kind}' is not enabled for issuance.`);
  }

  if (!Number.isInteger(input.validityDays) || input.validityDays < 1) {
    violations.push("Certificate validityDays must be an integer >= 1.");
  } else if (input.validityDays > profile.maxValidityDays) {
    violations.push(
      `Certificate validityDays ${input.validityDays} exceeds maximum ${profile.maxValidityDays} for profile '${profile.kind}'.`,
    );
  }

  if (input.subjectReference.kind !== profile.subjectReferenceKind) {
    violations.push(
      `Certificate subject reference kind '${input.subjectReference.kind}' is invalid for profile '${profile.kind}'.`,
    );
  }

  if (!input.subjectReference.referenceId.startsWith(profile.referenceIdPrefix)) {
    violations.push(
      `Certificate subject referenceId '${input.subjectReference.referenceId}' must start with '${profile.referenceIdPrefix}' for profile '${profile.kind}'.`,
    );
  }

  const usages = new Set(input.usages);
  if (usages.size === 0) {
    violations.push("Certificate usages must include at least one usage.");
  }

  for (const usage of usages.values()) {
    if (!profile.allowedUsages.includes(usage)) {
      violations.push(`Certificate usage '${usage}' is not allowed for profile '${profile.kind}'.`);
    }
  }

  for (const requiredUsage of profile.requiredUsages) {
    if (!usages.has(requiredUsage)) {
      violations.push(`Certificate usage '${requiredUsage}' is required for profile '${profile.kind}'.`);
    }
  }

  if (profile.requireDnsSan && input.subject.dnsNames.length === 0) {
    violations.push(`Certificate profile '${profile.kind}' requires at least one DNS SAN entry.`);
  }

  if (profile.requireUriSan && input.subject.uriSanEntries.length === 0) {
    violations.push(`Certificate profile '${profile.kind}' requires at least one URI SAN entry.`);
  }

  if (!profile.allowIpSans && input.subject.ipAddresses.length > 0) {
    violations.push(`Certificate profile '${profile.kind}' does not allow IP SAN entries.`);
  }

  if (profile.commonNameMustMatchDnsSan) {
    const dnsNames = new Set(input.subject.dnsNames.map((entry) => entry.toLowerCase()));
    if (!dnsNames.has(input.subject.commonName.toLowerCase())) {
      violations.push(`Certificate subject commonName must be present in DNS SAN entries for profile '${profile.kind}'.`);
    }
  }

  return Object.freeze({
    profile,
    allowed: violations.length === 0,
    violations: Object.freeze(violations),
  });
}
