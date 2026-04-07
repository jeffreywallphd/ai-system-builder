export class CertificateAuthorityDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateAuthorityDomainError";
  }
}

export class CertificateAuthorityLifecycleTransitionError extends CertificateAuthorityDomainError {
  constructor(fromStatus: CertificateAuthorityStatus, toStatus: CertificateAuthorityStatus) {
    super(`Certificate authority lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "CertificateAuthorityLifecycleTransitionError";
  }
}

export const CertificateAuthorityStatuses = Object.freeze({
  active: "active",
  retired: "retired",
  compromised: "compromised",
});

export type CertificateAuthorityStatus =
  typeof CertificateAuthorityStatuses[keyof typeof CertificateAuthorityStatuses];

export const CertificateStatuses = Object.freeze({
  issued: "issued",
  revoked: "revoked",
  expired: "expired",
  superseded: "superseded",
});

export type CertificateStatus = typeof CertificateStatuses[keyof typeof CertificateStatuses];

export const CertificateUsageKinds = Object.freeze({
  serverAuth: "server-auth",
  clientAuth: "client-auth",
  mutualTls: "mutual-tls",
  nodeEnrollment: "node-enrollment",
  deviceTrust: "device-trust",
  serviceIdentity: "service-identity",
});

export type CertificateUsageKind = typeof CertificateUsageKinds[keyof typeof CertificateUsageKinds];

export const CertificateSubjectReferenceKinds = Object.freeze({
  node: "node",
  device: "device",
  service: "service",
});

export type CertificateSubjectReferenceKind =
  typeof CertificateSubjectReferenceKinds[keyof typeof CertificateSubjectReferenceKinds];

export const CertificateRevocationReasons = Object.freeze({
  unspecified: "unspecified",
  keyCompromise: "key-compromise",
  caCompromise: "ca-compromise",
  affiliationChanged: "affiliation-changed",
  superseded: "superseded",
  cessationOfOperation: "cessation-of-operation",
  privilegeWithdrawn: "privilege-withdrawn",
  policyViolation: "policy-violation",
});

export type CertificateRevocationReason =
  typeof CertificateRevocationReasons[keyof typeof CertificateRevocationReasons];

export const TrustMaterialKinds = Object.freeze({
  certificatePem: "certificate-pem",
  certificateChainPem: "certificate-chain-pem",
  privateKeyEncryptedPem: "private-key-encrypted-pem",
  crlPem: "crl-pem",
});

export type TrustMaterialKind = typeof TrustMaterialKinds[keyof typeof TrustMaterialKinds];

export interface CertificateSerialNumber {
  readonly value: string;
}

export interface CertificateValidityWindow {
  readonly notBefore: string;
  readonly notAfter: string;
}

export interface CertificateSubjectDescriptor {
  readonly commonName: string;
  readonly organization?: string;
  readonly organizationalUnit?: string;
  readonly country?: string;
  readonly stateOrProvince?: string;
  readonly locality?: string;
  readonly dnsNames: ReadonlyArray<string>;
  readonly ipAddresses: ReadonlyArray<string>;
  readonly uriSanEntries: ReadonlyArray<string>;
}

export interface CertificateSubjectReference {
  readonly kind: CertificateSubjectReferenceKind;
  readonly referenceId: string;
  readonly workspaceId?: string;
}

export interface CertificateRevocationRecord {
  readonly reason: CertificateRevocationReason;
  readonly revokedAt: string;
  readonly revokedByActorId?: string;
  readonly note?: string;
}

export interface RotationPolicyMetadata {
  readonly profileId: string;
  readonly autoRotateEnabled: boolean;
  readonly rotateBeforeExpiryDays: number;
  readonly overlapDays: number;
  readonly maxLifetimeDays: number;
  readonly lastRotatedAt?: string;
  readonly nextRotationDueAt?: string;
}

export interface TrustMaterialReference {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly storageLocator: string;
  readonly fingerprintSha256?: string;
  readonly createdAt: string;
  readonly createdByActorId?: string;
}

export interface CertificateAuthorityRoot {
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly status: CertificateAuthorityStatus;
  readonly subject: CertificateSubjectDescriptor;
  readonly serialNumber: CertificateSerialNumber;
  readonly validity: CertificateValidityWindow;
  readonly signatureAlgorithm: string;
  readonly rootCertificateMaterialRef: string;
  readonly rootPrivateKeyMaterialRef: string;
  readonly rotationPolicy: RotationPolicyMetadata;
  readonly rotatedFromCertificateAuthorityId?: string;
  readonly retiredAt?: string;
  readonly compromisedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IssuedCertificate {
  readonly certificateAuthorityId: string;
  readonly serialNumber: CertificateSerialNumber;
  readonly status: CertificateStatus;
  readonly subject: CertificateSubjectDescriptor;
  readonly subjectReference: CertificateSubjectReference;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly validity: CertificateValidityWindow;
  readonly issuedAt: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly revocation?: CertificateRevocationRecord;
  readonly supersededBySerialNumber?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const CertificateAuthorityLifecycleTransitions: Readonly<
  Record<CertificateAuthorityStatus, ReadonlyArray<CertificateAuthorityStatus>>
> = Object.freeze({
  [CertificateAuthorityStatuses.active]: Object.freeze([
    CertificateAuthorityStatuses.retired,
    CertificateAuthorityStatuses.compromised,
  ]),
  [CertificateAuthorityStatuses.retired]: Object.freeze([]),
  [CertificateAuthorityStatuses.compromised]: Object.freeze([]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CertificateAuthorityDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: Date | string, field: string): string {
  const timestamp = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new CertificateAuthorityDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeUppercaseArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeLowercaseArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeCertificateAuthorityStatus(status?: CertificateAuthorityStatus): CertificateAuthorityStatus {
  const normalized = status ?? CertificateAuthorityStatuses.active;
  if (!Object.values(CertificateAuthorityStatuses).includes(normalized)) {
    throw new CertificateAuthorityDomainError(`Certificate authority status '${String(status)}' is invalid.`);
  }
  return normalized;
}

function normalizeCertificateStatus(status?: CertificateStatus): CertificateStatus {
  const normalized = status ?? CertificateStatuses.issued;
  if (!Object.values(CertificateStatuses).includes(normalized)) {
    throw new CertificateAuthorityDomainError(`Certificate status '${String(status)}' is invalid.`);
  }
  return normalized;
}

function normalizeSerialNumber(value: string): CertificateSerialNumber {
  const normalized = normalizeRequired(value, "Certificate serialNumber").toUpperCase();
  if (!/^[0-9A-F]{2,64}$/.test(normalized)) {
    throw new CertificateAuthorityDomainError("Certificate serialNumber must be a hexadecimal string (2-64 chars).");
  }
  return Object.freeze({ value: normalized });
}

function normalizeValidityWindow(input: {
  readonly notBefore: Date | string;
  readonly notAfter: Date | string;
}): CertificateValidityWindow {
  const notBefore = normalizeTimestamp(input.notBefore, "Certificate validity notBefore");
  const notAfter = normalizeTimestamp(input.notAfter, "Certificate validity notAfter");

  if (Date.parse(notAfter) <= Date.parse(notBefore)) {
    throw new CertificateAuthorityDomainError("Certificate validity notAfter must be later than notBefore.");
  }

  return Object.freeze({
    notBefore,
    notAfter,
  });
}

function normalizeSubjectReference(input: {
  readonly kind: CertificateSubjectReferenceKind;
  readonly referenceId: string;
  readonly workspaceId?: string;
}): CertificateSubjectReference {
  if (!Object.values(CertificateSubjectReferenceKinds).includes(input.kind)) {
    throw new CertificateAuthorityDomainError(`Certificate subject reference kind '${String(input.kind)}' is invalid.`);
  }

  return Object.freeze({
    kind: input.kind,
    referenceId: normalizeRequired(input.referenceId, "Certificate subject referenceId"),
    workspaceId: normalizeOptional(input.workspaceId),
  });
}

function normalizeSubject(input: {
  readonly commonName: string;
  readonly organization?: string;
  readonly organizationalUnit?: string;
  readonly country?: string;
  readonly stateOrProvince?: string;
  readonly locality?: string;
  readonly dnsNames?: ReadonlyArray<string>;
  readonly ipAddresses?: ReadonlyArray<string>;
  readonly uriSanEntries?: ReadonlyArray<string>;
}): CertificateSubjectDescriptor {
  const commonName = normalizeRequired(input.commonName, "Certificate subject commonName");
  if (commonName.length > 255) {
    throw new CertificateAuthorityDomainError("Certificate subject commonName must be 255 characters or fewer.");
  }

  const country = normalizeOptional(input.country)?.toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) {
    throw new CertificateAuthorityDomainError("Certificate subject country must be a 2-letter uppercase code.");
  }

  return Object.freeze({
    commonName,
    organization: normalizeOptional(input.organization),
    organizationalUnit: normalizeOptional(input.organizationalUnit),
    country,
    stateOrProvince: normalizeOptional(input.stateOrProvince),
    locality: normalizeOptional(input.locality),
    dnsNames: normalizeLowercaseArray(input.dnsNames),
    ipAddresses: normalizeUppercaseArray(input.ipAddresses),
    uriSanEntries: normalizeUppercaseArray(input.uriSanEntries),
  });
}

function normalizeRevocationRecord(input?: {
  readonly reason: CertificateRevocationReason;
  readonly revokedAt: Date | string;
  readonly revokedByActorId?: string;
  readonly note?: string;
}): CertificateRevocationRecord | undefined {
  if (!input) {
    return undefined;
  }

  if (!Object.values(CertificateRevocationReasons).includes(input.reason)) {
    throw new CertificateAuthorityDomainError(`Certificate revocation reason '${String(input.reason)}' is invalid.`);
  }

  return Object.freeze({
    reason: input.reason,
    revokedAt: normalizeTimestamp(input.revokedAt, "Certificate revocation revokedAt"),
    revokedByActorId: normalizeOptional(input.revokedByActorId),
    note: normalizeOptional(input.note),
  });
}

function normalizeRotationPolicyMetadata(input: {
  readonly profileId: string;
  readonly autoRotateEnabled?: boolean;
  readonly rotateBeforeExpiryDays?: number;
  readonly overlapDays?: number;
  readonly maxLifetimeDays?: number;
  readonly lastRotatedAt?: Date | string;
  readonly nextRotationDueAt?: Date | string;
}): RotationPolicyMetadata {
  const rotateBeforeExpiryDays = input.rotateBeforeExpiryDays ?? 45;
  const overlapDays = input.overlapDays ?? 30;
  const maxLifetimeDays = input.maxLifetimeDays ?? 3650;

  if (!Number.isInteger(rotateBeforeExpiryDays) || rotateBeforeExpiryDays < 1) {
    throw new CertificateAuthorityDomainError("Certificate rotationPolicy rotateBeforeExpiryDays must be an integer >= 1.");
  }
  if (!Number.isInteger(overlapDays) || overlapDays < 0) {
    throw new CertificateAuthorityDomainError("Certificate rotationPolicy overlapDays must be an integer >= 0.");
  }
  if (!Number.isInteger(maxLifetimeDays) || maxLifetimeDays < 1) {
    throw new CertificateAuthorityDomainError("Certificate rotationPolicy maxLifetimeDays must be an integer >= 1.");
  }

  return Object.freeze({
    profileId: normalizeRequired(input.profileId, "Certificate rotationPolicy profileId"),
    autoRotateEnabled: input.autoRotateEnabled ?? false,
    rotateBeforeExpiryDays,
    overlapDays,
    maxLifetimeDays,
    lastRotatedAt: input.lastRotatedAt
      ? normalizeTimestamp(input.lastRotatedAt, "Certificate rotationPolicy lastRotatedAt")
      : undefined,
    nextRotationDueAt: input.nextRotationDueAt
      ? normalizeTimestamp(input.nextRotationDueAt, "Certificate rotationPolicy nextRotationDueAt")
      : undefined,
  });
}

function assertCertificateAuthorityState(certificateAuthority: CertificateAuthorityRoot): void {
  if (Date.parse(certificateAuthority.updatedAt) < Date.parse(certificateAuthority.createdAt)) {
    throw new CertificateAuthorityDomainError("Certificate authority updatedAt cannot be earlier than createdAt.");
  }

  if (Date.parse(certificateAuthority.validity.notAfter) <= Date.parse(certificateAuthority.validity.notBefore)) {
    throw new CertificateAuthorityDomainError("Certificate authority validity window is invalid.");
  }

  if (
    certificateAuthority.rotationPolicy.nextRotationDueAt
    && Date.parse(certificateAuthority.rotationPolicy.nextRotationDueAt) <= Date.parse(certificateAuthority.createdAt)
  ) {
    throw new CertificateAuthorityDomainError(
      "Certificate authority rotationPolicy nextRotationDueAt must be later than createdAt.",
    );
  }

  if (certificateAuthority.status === CertificateAuthorityStatuses.retired && !certificateAuthority.retiredAt) {
    throw new CertificateAuthorityDomainError("Retired certificate authorities must include retiredAt.");
  }

  if (certificateAuthority.status === CertificateAuthorityStatuses.compromised && !certificateAuthority.compromisedAt) {
    throw new CertificateAuthorityDomainError("Compromised certificate authorities must include compromisedAt.");
  }

  if (certificateAuthority.status === CertificateAuthorityStatuses.active) {
    if (certificateAuthority.retiredAt || certificateAuthority.compromisedAt) {
      throw new CertificateAuthorityDomainError("Active certificate authorities cannot include retiredAt or compromisedAt.");
    }
  }
}

function assertIssuedCertificateState(certificate: IssuedCertificate): void {
  if (certificate.usages.length === 0) {
    throw new CertificateAuthorityDomainError("Issued certificates must include at least one usage.");
  }

  if (Date.parse(certificate.issuedAt) < Date.parse(certificate.validity.notBefore)) {
    throw new CertificateAuthorityDomainError("Issued certificate issuedAt cannot be earlier than validity.notBefore.");
  }

  if (Date.parse(certificate.updatedAt) < Date.parse(certificate.createdAt)) {
    throw new CertificateAuthorityDomainError("Issued certificate updatedAt cannot be earlier than createdAt.");
  }

  if (certificate.status === CertificateStatuses.revoked) {
    if (!certificate.revocation) {
      throw new CertificateAuthorityDomainError("Revoked certificates must include revocation metadata.");
    }
  } else if (certificate.revocation) {
    throw new CertificateAuthorityDomainError("Only revoked certificates can include revocation metadata.");
  }

  if (certificate.status === CertificateStatuses.superseded && !certificate.supersededBySerialNumber) {
    throw new CertificateAuthorityDomainError("Superseded certificates must include supersededBySerialNumber.");
  }

  if (certificate.status !== CertificateStatuses.superseded && certificate.supersededBySerialNumber) {
    throw new CertificateAuthorityDomainError("Only superseded certificates can include supersededBySerialNumber.");
  }
}

export function createCertificateSerialNumber(value: string): CertificateSerialNumber {
  return normalizeSerialNumber(value);
}

export function createCertificateValidityWindow(input: {
  readonly notBefore: Date | string;
  readonly notAfter: Date | string;
}): CertificateValidityWindow {
  return normalizeValidityWindow(input);
}

export function createCertificateSubjectDescriptor(input: {
  readonly commonName: string;
  readonly organization?: string;
  readonly organizationalUnit?: string;
  readonly country?: string;
  readonly stateOrProvince?: string;
  readonly locality?: string;
  readonly dnsNames?: ReadonlyArray<string>;
  readonly ipAddresses?: ReadonlyArray<string>;
  readonly uriSanEntries?: ReadonlyArray<string>;
}): CertificateSubjectDescriptor {
  return normalizeSubject(input);
}

export function createTrustMaterialReference(input: {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly storageLocator: string;
  readonly fingerprintSha256?: string;
  readonly createdAt?: Date | string;
  readonly createdByActorId?: string;
}): TrustMaterialReference {
  if (!Object.values(TrustMaterialKinds).includes(input.kind)) {
    throw new CertificateAuthorityDomainError(`Trust material kind '${String(input.kind)}' is invalid.`);
  }

  return Object.freeze({
    materialRef: normalizeRequired(input.materialRef, "Trust materialRef"),
    kind: input.kind,
    storageLocator: normalizeRequired(input.storageLocator, "Trust storageLocator"),
    fingerprintSha256: normalizeOptional(input.fingerprintSha256),
    createdAt: normalizeTimestamp(input.createdAt ?? new Date(), "Trust createdAt"),
    createdByActorId: normalizeOptional(input.createdByActorId),
  });
}

export function createCertificateAuthorityRoot(input: {
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly status?: CertificateAuthorityStatus;
  readonly subject: CertificateSubjectDescriptor;
  readonly serialNumber: CertificateSerialNumber;
  readonly validity: CertificateValidityWindow;
  readonly signatureAlgorithm: string;
  readonly rootCertificateMaterialRef: string;
  readonly rootPrivateKeyMaterialRef: string;
  readonly rotationPolicy: RotationPolicyMetadata;
  readonly rotatedFromCertificateAuthorityId?: string;
  readonly retiredAt?: Date | string;
  readonly compromisedAt?: Date | string;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}): CertificateAuthorityRoot {
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date(), "Certificate authority createdAt");
  const certificateAuthority: CertificateAuthorityRoot = Object.freeze({
    certificateAuthorityId: normalizeRequired(input.certificateAuthorityId, "Certificate authority id"),
    displayName: normalizeRequired(input.displayName, "Certificate authority displayName"),
    status: normalizeCertificateAuthorityStatus(input.status),
    subject: createCertificateSubjectDescriptor(input.subject),
    serialNumber: createCertificateSerialNumber(input.serialNumber.value),
    validity: createCertificateValidityWindow(input.validity),
    signatureAlgorithm: normalizeRequired(input.signatureAlgorithm, "Certificate authority signatureAlgorithm"),
    rootCertificateMaterialRef: normalizeRequired(
      input.rootCertificateMaterialRef,
      "Certificate authority rootCertificateMaterialRef",
    ),
    rootPrivateKeyMaterialRef: normalizeRequired(
      input.rootPrivateKeyMaterialRef,
      "Certificate authority rootPrivateKeyMaterialRef",
    ),
    rotationPolicy: normalizeRotationPolicyMetadata(input.rotationPolicy),
    rotatedFromCertificateAuthorityId: normalizeOptional(input.rotatedFromCertificateAuthorityId),
    retiredAt: input.retiredAt ? normalizeTimestamp(input.retiredAt, "Certificate authority retiredAt") : undefined,
    compromisedAt: input.compromisedAt
      ? normalizeTimestamp(input.compromisedAt, "Certificate authority compromisedAt")
      : undefined,
    createdAt,
    updatedAt: normalizeTimestamp(input.updatedAt ?? createdAt, "Certificate authority updatedAt"),
  });

  assertCertificateAuthorityState(certificateAuthority);
  return certificateAuthority;
}

export function createIssuedCertificate(input: {
  readonly certificateAuthorityId: string;
  readonly serialNumber: CertificateSerialNumber;
  readonly status?: CertificateStatus;
  readonly subject: CertificateSubjectDescriptor;
  readonly subjectReference: CertificateSubjectReference;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly validity: CertificateValidityWindow;
  readonly issuedAt?: Date | string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly revocation?: {
    readonly reason: CertificateRevocationReason;
    readonly revokedAt: Date | string;
    readonly revokedByActorId?: string;
    readonly note?: string;
  };
  readonly supersededBySerialNumber?: string;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}): IssuedCertificate {
  const issuedAt = normalizeTimestamp(input.issuedAt ?? new Date(), "Issued certificate issuedAt");
  const createdAt = normalizeTimestamp(input.createdAt ?? issuedAt, "Issued certificate createdAt");

  const normalizedUsages = new Set<CertificateUsageKind>();
  for (const usage of input.usages) {
    if (!Object.values(CertificateUsageKinds).includes(usage)) {
      throw new CertificateAuthorityDomainError(`Certificate usage '${String(usage)}' is invalid.`);
    }
    normalizedUsages.add(usage);
  }

  const certificate: IssuedCertificate = Object.freeze({
    certificateAuthorityId: normalizeRequired(input.certificateAuthorityId, "Issued certificate certificateAuthorityId"),
    serialNumber: createCertificateSerialNumber(input.serialNumber.value),
    status: normalizeCertificateStatus(input.status),
    subject: createCertificateSubjectDescriptor(input.subject),
    subjectReference: normalizeSubjectReference(input.subjectReference),
    usages: Object.freeze([...normalizedUsages.values()]),
    validity: createCertificateValidityWindow(input.validity),
    issuedAt,
    certificateMaterialRef: normalizeRequired(input.certificateMaterialRef, "Issued certificate certificateMaterialRef"),
    certificateChainMaterialRef: normalizeOptional(input.certificateChainMaterialRef),
    trustMaterialRef: normalizeOptional(input.trustMaterialRef),
    publicKeyAlgorithm: normalizeRequired(input.publicKeyAlgorithm, "Issued certificate publicKeyAlgorithm"),
    publicKeyFingerprintSha256: normalizeOptional(input.publicKeyFingerprintSha256),
    revocation: normalizeRevocationRecord(input.revocation),
    supersededBySerialNumber: normalizeOptional(input.supersededBySerialNumber),
    createdAt,
    updatedAt: normalizeTimestamp(input.updatedAt ?? createdAt, "Issued certificate updatedAt"),
  });

  assertIssuedCertificateState(certificate);
  return certificate;
}

export function isCertificateAuthorityTransitionAllowed(
  from: CertificateAuthorityStatus,
  to: CertificateAuthorityStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return CertificateAuthorityLifecycleTransitions[from].includes(to);
}

function assertCertificateAuthorityTransitionAllowed(
  from: CertificateAuthorityStatus,
  to: CertificateAuthorityStatus,
): void {
  if (!isCertificateAuthorityTransitionAllowed(from, to)) {
    throw new CertificateAuthorityLifecycleTransitionError(from, to);
  }
}

export function transitionCertificateAuthorityStatus(
  certificateAuthority: CertificateAuthorityRoot,
  toStatus: CertificateAuthorityStatus,
  now: Date = new Date(),
): CertificateAuthorityRoot {
  assertCertificateAuthorityTransitionAllowed(certificateAuthority.status, toStatus);
  if (certificateAuthority.status === toStatus) {
    return certificateAuthority;
  }

  const nowIso = now.toISOString();
  const updated: CertificateAuthorityRoot = Object.freeze({
    ...certificateAuthority,
    status: toStatus,
    retiredAt: toStatus === CertificateAuthorityStatuses.retired ? nowIso : certificateAuthority.retiredAt,
    compromisedAt: toStatus === CertificateAuthorityStatuses.compromised ? nowIso : certificateAuthority.compromisedAt,
    updatedAt: nowIso,
  });

  assertCertificateAuthorityState(updated);
  return updated;
}

export function revokeIssuedCertificate(
  certificate: IssuedCertificate,
  input: {
    readonly reason: CertificateRevocationReason;
    readonly revokedAt?: Date | string;
    readonly revokedByActorId?: string;
    readonly note?: string;
  },
): IssuedCertificate {
  const revokedAt = normalizeTimestamp(input.revokedAt ?? new Date(), "Issued certificate revokedAt");
  const updated: IssuedCertificate = Object.freeze({
    ...certificate,
    status: CertificateStatuses.revoked,
    revocation: normalizeRevocationRecord({
      reason: input.reason,
      revokedAt,
      revokedByActorId: input.revokedByActorId,
      note: input.note,
    }),
    supersededBySerialNumber: undefined,
    updatedAt: revokedAt,
  });

  assertIssuedCertificateState(updated);
  return updated;
}

export function supersedeIssuedCertificate(
  certificate: IssuedCertificate,
  supersededBySerialNumber: CertificateSerialNumber,
  now: Date = new Date(),
): IssuedCertificate {
  const updated: IssuedCertificate = Object.freeze({
    ...certificate,
    status: CertificateStatuses.superseded,
    revocation: undefined,
    supersededBySerialNumber: supersededBySerialNumber.value,
    updatedAt: now.toISOString(),
  });

  assertIssuedCertificateState(updated);
  return updated;
}

export function isIssuedCertificateActiveAt(
  certificate: IssuedCertificate,
  asOf: Date | string,
): boolean {
  const asOfIso = normalizeTimestamp(asOf, "Issued certificate asOf");
  const asOfMs = Date.parse(asOfIso);
  if (certificate.status !== CertificateStatuses.issued) {
    return false;
  }

  return asOfMs >= Date.parse(certificate.validity.notBefore)
    && asOfMs < Date.parse(certificate.validity.notAfter);
}

export function updateCertificateAuthorityRotationPolicy(
  certificateAuthority: CertificateAuthorityRoot,
  rotationPolicy: RotationPolicyMetadata,
  now: Date = new Date(),
): CertificateAuthorityRoot {
  const updated: CertificateAuthorityRoot = Object.freeze({
    ...certificateAuthority,
    rotationPolicy: normalizeRotationPolicyMetadata(rotationPolicy),
    updatedAt: now.toISOString(),
  });

  assertCertificateAuthorityState(updated);
  return updated;
}
