export class TrustedDeviceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustedDeviceDomainError";
  }
}

export class TrustedDeviceLifecycleTransitionError extends TrustedDeviceDomainError {
  constructor(fromStatus: DeviceTrustStatus, toStatus: DeviceTrustStatus) {
    super(`Trusted device lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "TrustedDeviceLifecycleTransitionError";
  }
}

export const DeviceTrustStatuses = Object.freeze({
  pendingPairing: "pending-pairing",
  trusted: "trusted",
  revoked: "revoked",
  expired: "expired",
});

export type DeviceTrustStatus = typeof DeviceTrustStatuses[keyof typeof DeviceTrustStatuses];

export const DevicePairingMethods = Object.freeze({
  oneTimeCode: "one-time-code",
  qrCode: "qr-code",
  passkey: "passkey",
  adminProvisioned: "admin-provisioned",
  recoveryFlow: "recovery-flow",
});

export type DevicePairingMethod = typeof DevicePairingMethods[keyof typeof DevicePairingMethods];

export const DeviceFingerprintAlgorithms = Object.freeze({
  sha256: "sha256",
  sha512: "sha512",
  opaque: "opaque",
});

export type DeviceFingerprintAlgorithm =
  typeof DeviceFingerprintAlgorithms[keyof typeof DeviceFingerprintAlgorithms];

export interface DeviceFingerprint {
  readonly algorithm: DeviceFingerprintAlgorithm;
  readonly value: string;
  readonly capturedAt: string;
}

export interface DeviceDisplayName {
  readonly value: string;
}

export const DeviceTrustMaterialKinds = Object.freeze({
  sessionSigningKey: "session-signing-key",
  attestationKey: "attestation-key",
  opaqueMarker: "opaque-marker",
});

export type DeviceTrustMaterialKind = typeof DeviceTrustMaterialKinds[keyof typeof DeviceTrustMaterialKinds];

export interface DeviceTrustMaterialRef {
  readonly materialId: string;
  readonly kind: DeviceTrustMaterialKind;
  readonly version?: string;
  readonly issuedAt: string;
  readonly expiresAt?: string;
}

export const DeviceRevocationReasons = Object.freeze({
  userRequest: "user-request",
  adminAction: "admin-action",
  lostDevice: "lost-device",
  suspectedCompromise: "suspected-compromise",
  workspaceAccessRemoved: "workspace-access-removed",
  policyViolation: "policy-violation",
});

export type DeviceRevocationReason = typeof DeviceRevocationReasons[keyof typeof DeviceRevocationReasons];

export interface DeviceRevocation {
  readonly reason: DeviceRevocationReason;
  readonly revokedAt: string;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
}

export interface TrustedDeviceMetadata {
  readonly platform?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly deviceModel?: string;
  readonly locale?: string;
  readonly lastIpAddress?: string;
}

export interface TrustedDevice {
  readonly id: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly displayName: DeviceDisplayName;
  readonly fingerprint: DeviceFingerprint;
  readonly pairingMethod: DevicePairingMethod;
  readonly trustStatus: DeviceTrustStatus;
  readonly trustMaterialRef?: DeviceTrustMaterialRef;
  readonly registeredAt: string;
  readonly pairedAt?: string;
  readonly lastSeenAt?: string;
  readonly metadata: TrustedDeviceMetadata;
  readonly revocation?: DeviceRevocation;
  readonly updatedAt: string;
}

export const TrustedDeviceLifecycleTransitions: Readonly<
  Record<DeviceTrustStatus, ReadonlyArray<DeviceTrustStatus>>
> = Object.freeze({
  [DeviceTrustStatuses.pendingPairing]: Object.freeze([
    DeviceTrustStatuses.trusted,
    DeviceTrustStatuses.revoked,
    DeviceTrustStatuses.expired,
  ]),
  [DeviceTrustStatuses.trusted]: Object.freeze([
    DeviceTrustStatuses.revoked,
    DeviceTrustStatuses.expired,
  ]),
  [DeviceTrustStatuses.revoked]: Object.freeze([DeviceTrustStatuses.pendingPairing]),
  [DeviceTrustStatuses.expired]: Object.freeze([
    DeviceTrustStatuses.pendingPairing,
    DeviceTrustStatuses.revoked,
  ]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TrustedDeviceDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new TrustedDeviceDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeTrustStatus(value?: DeviceTrustStatus): DeviceTrustStatus {
  const normalized = value ?? DeviceTrustStatuses.pendingPairing;
  if (!Object.values(DeviceTrustStatuses).includes(normalized)) {
    throw new TrustedDeviceDomainError(`Device trust status '${String(value)}' is invalid.`);
  }
  return normalized;
}

function normalizePairingMethod(value: DevicePairingMethod): DevicePairingMethod {
  if (!Object.values(DevicePairingMethods).includes(value)) {
    throw new TrustedDeviceDomainError(`Device pairing method '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeFingerprintAlgorithm(value: DeviceFingerprintAlgorithm): DeviceFingerprintAlgorithm {
  if (!Object.values(DeviceFingerprintAlgorithms).includes(value)) {
    throw new TrustedDeviceDomainError(`Device fingerprint algorithm '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeDeviceMetadata(input?: TrustedDeviceMetadata): TrustedDeviceMetadata {
  return Object.freeze({
    platform: normalizeOptional(input?.platform),
    osVersion: normalizeOptional(input?.osVersion),
    appVersion: normalizeOptional(input?.appVersion),
    deviceModel: normalizeOptional(input?.deviceModel),
    locale: normalizeOptional(input?.locale),
    lastIpAddress: normalizeOptional(input?.lastIpAddress),
  });
}

export function createDeviceDisplayName(input: string | DeviceDisplayName): DeviceDisplayName {
  const value = typeof input === "string" ? input : input.value;
  const normalized = normalizeRequired(value, "Device display name");
  if (normalized.length > 80) {
    throw new TrustedDeviceDomainError("Device display name must be 80 characters or fewer.");
  }
  return Object.freeze({
    value: normalized,
  });
}

export function createDeviceFingerprint(input: {
  readonly algorithm: DeviceFingerprintAlgorithm;
  readonly value: string;
  readonly capturedAt?: Date | string;
}): DeviceFingerprint {
  return Object.freeze({
    algorithm: normalizeFingerprintAlgorithm(input.algorithm),
    value: normalizeRequired(input.value, "Device fingerprint value"),
    capturedAt: normalizeIsoTimestamp(input.capturedAt ?? new Date(), "Device fingerprint capturedAt"),
  });
}

export function createDeviceTrustMaterialRef(input: {
  readonly materialId: string;
  readonly kind: DeviceTrustMaterialKind;
  readonly version?: string;
  readonly issuedAt?: Date | string;
  readonly expiresAt?: Date | string;
}): DeviceTrustMaterialRef {
  if (!Object.values(DeviceTrustMaterialKinds).includes(input.kind)) {
    throw new TrustedDeviceDomainError(`Device trust material kind '${String(input.kind)}' is invalid.`);
  }

  const issuedAt = normalizeIsoTimestamp(input.issuedAt ?? new Date(), "Device trust material issuedAt");
  const expiresAt = input.expiresAt
    ? normalizeIsoTimestamp(input.expiresAt, "Device trust material expiresAt")
    : undefined;

  if (expiresAt && new Date(expiresAt).getTime() <= new Date(issuedAt).getTime()) {
    throw new TrustedDeviceDomainError("Device trust material expiresAt must be later than issuedAt.");
  }

  return Object.freeze({
    materialId: normalizeRequired(input.materialId, "Device trust material materialId"),
    kind: input.kind,
    version: normalizeOptional(input.version),
    issuedAt,
    expiresAt,
  });
}

function normalizeRevocation(input?: {
  readonly reason: DeviceRevocationReason;
  readonly revokedAt?: Date | string;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
}): DeviceRevocation | undefined {
  if (!input) {
    return undefined;
  }

  if (!Object.values(DeviceRevocationReasons).includes(input.reason)) {
    throw new TrustedDeviceDomainError(`Device revocation reason '${String(input.reason)}' is invalid.`);
  }

  return Object.freeze({
    reason: input.reason,
    revokedAt: normalizeIsoTimestamp(input.revokedAt ?? new Date(), "Device revocation revokedAt"),
    revokedByUserIdentityId: normalizeOptional(input.revokedByUserIdentityId),
    note: normalizeOptional(input.note),
  });
}

function assertTrustedDeviceState(device: {
  readonly trustStatus: DeviceTrustStatus;
  readonly trustMaterialRef?: DeviceTrustMaterialRef;
  readonly pairedAt?: string;
  readonly revocation?: DeviceRevocation;
  readonly registeredAt: string;
  readonly lastSeenAt?: string;
}): void {
  if (device.trustStatus === DeviceTrustStatuses.trusted) {
    if (!device.pairedAt) {
      throw new TrustedDeviceDomainError("Trusted devices must include pairedAt.");
    }
    if (!device.trustMaterialRef) {
      throw new TrustedDeviceDomainError("Trusted devices must include trustMaterialRef.");
    }
  }

  if (device.trustStatus === DeviceTrustStatuses.revoked) {
    if (!device.revocation) {
      throw new TrustedDeviceDomainError("Revoked devices must include revocation details.");
    }
  } else if (device.revocation) {
    throw new TrustedDeviceDomainError("Only revoked devices can include revocation details.");
  }

  if (device.pairedAt && new Date(device.pairedAt).getTime() < new Date(device.registeredAt).getTime()) {
    throw new TrustedDeviceDomainError("Device pairedAt cannot be earlier than registeredAt.");
  }

  if (device.lastSeenAt && new Date(device.lastSeenAt).getTime() < new Date(device.registeredAt).getTime()) {
    throw new TrustedDeviceDomainError("Device lastSeenAt cannot be earlier than registeredAt.");
  }
}

export function createTrustedDevice(input: {
  readonly id: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly displayName: string | DeviceDisplayName;
  readonly fingerprint: DeviceFingerprint;
  readonly pairingMethod: DevicePairingMethod;
  readonly trustStatus?: DeviceTrustStatus;
  readonly trustMaterialRef?: DeviceTrustMaterialRef;
  readonly registeredAt?: Date | string;
  readonly pairedAt?: Date | string;
  readonly lastSeenAt?: Date | string;
  readonly metadata?: TrustedDeviceMetadata;
  readonly revocation?: {
    readonly reason: DeviceRevocationReason;
    readonly revokedAt?: Date | string;
    readonly revokedByUserIdentityId?: string;
    readonly note?: string;
  };
  readonly updatedAt?: Date | string;
}): TrustedDevice {
  const registeredAt = normalizeIsoTimestamp(input.registeredAt ?? new Date(), "Trusted device registeredAt");
  const trustStatus = normalizeTrustStatus(input.trustStatus);
  const pairedAt = input.pairedAt
    ? normalizeIsoTimestamp(input.pairedAt, "Trusted device pairedAt")
    : undefined;
  const lastSeenAt = input.lastSeenAt
    ? normalizeIsoTimestamp(input.lastSeenAt, "Trusted device lastSeenAt")
    : undefined;
  const revocation = normalizeRevocation(input.revocation);

  const trustedDevice: TrustedDevice = Object.freeze({
    id: normalizeRequired(input.id, "Trusted device id"),
    userIdentityId: normalizeRequired(input.userIdentityId, "Trusted device userIdentityId"),
    workspaceId: normalizeOptional(input.workspaceId),
    displayName: createDeviceDisplayName(input.displayName),
    fingerprint: createDeviceFingerprint(input.fingerprint),
    pairingMethod: normalizePairingMethod(input.pairingMethod),
    trustStatus,
    trustMaterialRef: input.trustMaterialRef,
    registeredAt,
    pairedAt,
    lastSeenAt,
    metadata: normalizeDeviceMetadata(input.metadata),
    revocation,
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? registeredAt, "Trusted device updatedAt"),
  });

  assertTrustedDeviceState(trustedDevice);
  return trustedDevice;
}

export function isTrustedDeviceTransitionAllowed(from: DeviceTrustStatus, to: DeviceTrustStatus): boolean {
  if (from === to) {
    return true;
  }
  return TrustedDeviceLifecycleTransitions[from].includes(to);
}

function assertTrustedDeviceTransitionAllowed(from: DeviceTrustStatus, to: DeviceTrustStatus): void {
  if (!isTrustedDeviceTransitionAllowed(from, to)) {
    throw new TrustedDeviceLifecycleTransitionError(from, to);
  }
}

export function pairTrustedDevice(
  device: TrustedDevice,
  input: {
    readonly trustMaterialRef: DeviceTrustMaterialRef;
    readonly pairedAt?: Date | string;
    readonly now?: Date;
  },
): TrustedDevice {
  const pairedAt = normalizeIsoTimestamp(input.pairedAt ?? input.now ?? new Date(), "Trusted device pairedAt");
  assertTrustedDeviceTransitionAllowed(device.trustStatus, DeviceTrustStatuses.trusted);

  const updated: TrustedDevice = Object.freeze({
    ...device,
    trustStatus: DeviceTrustStatuses.trusted,
    trustMaterialRef: input.trustMaterialRef,
    pairedAt,
    revocation: undefined,
    updatedAt: normalizeIsoTimestamp(input.now ?? pairedAt, "Trusted device updatedAt"),
  });

  assertTrustedDeviceState(updated);
  return updated;
}

export function touchTrustedDevice(
  device: TrustedDevice,
  input?: {
    readonly seenAt?: Date | string;
    readonly metadataPatch?: TrustedDeviceMetadata;
  },
): TrustedDevice {
  if (device.trustStatus === DeviceTrustStatuses.revoked) {
    throw new TrustedDeviceDomainError("Revoked devices cannot be marked as seen.");
  }

  const seenAt = normalizeIsoTimestamp(input?.seenAt ?? new Date(), "Trusted device lastSeenAt");
  const metadata = {
    ...device.metadata,
    ...input?.metadataPatch,
  };

  const updated: TrustedDevice = Object.freeze({
    ...device,
    lastSeenAt: seenAt,
    metadata: normalizeDeviceMetadata(metadata),
    updatedAt: seenAt,
  });

  assertTrustedDeviceState(updated);
  return updated;
}

export function updateTrustedDeviceDisplayName(
  device: TrustedDevice,
  displayName: string | DeviceDisplayName,
  now: Date = new Date(),
): TrustedDevice {
  return Object.freeze({
    ...device,
    displayName: createDeviceDisplayName(displayName),
    updatedAt: now.toISOString(),
  });
}

export function revokeTrustedDevice(
  device: TrustedDevice,
  input: {
    readonly reason: DeviceRevocationReason;
    readonly revokedAt?: Date | string;
    readonly revokedByUserIdentityId?: string;
    readonly note?: string;
  },
): TrustedDevice {
  assertTrustedDeviceTransitionAllowed(device.trustStatus, DeviceTrustStatuses.revoked);

  const revocation = normalizeRevocation(input);
  const updated: TrustedDevice = Object.freeze({
    ...device,
    trustStatus: DeviceTrustStatuses.revoked,
    revocation,
    updatedAt: revocation?.revokedAt ?? new Date().toISOString(),
  });

  assertTrustedDeviceState(updated);
  return updated;
}

export function expireTrustedDevice(device: TrustedDevice, now: Date = new Date()): TrustedDevice {
  assertTrustedDeviceTransitionAllowed(device.trustStatus, DeviceTrustStatuses.expired);

  const nowIso = now.toISOString();
  const updated: TrustedDevice = Object.freeze({
    ...device,
    trustStatus: DeviceTrustStatuses.expired,
    updatedAt: nowIso,
  });

  assertTrustedDeviceState(updated);
  return updated;
}
