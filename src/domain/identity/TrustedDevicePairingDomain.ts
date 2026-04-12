import type { DeviceTrustMaterialKind } from "./TrustedDeviceDomain";

export class TrustedDevicePairingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustedDevicePairingDomainError";
  }
}

export class PairingTokenLifecycleTransitionError extends TrustedDevicePairingDomainError {
  constructor(fromStatus: PairingTokenStatus, toStatus: PairingTokenStatus) {
    super(`Pairing token lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "PairingTokenLifecycleTransitionError";
  }
}

export class PairingSessionLifecycleTransitionError extends TrustedDevicePairingDomainError {
  constructor(fromStatus: PairingSessionStatus, toStatus: PairingSessionStatus) {
    super(`Pairing session lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "PairingSessionLifecycleTransitionError";
  }
}

export const PairingTokenStatuses = Object.freeze({
  issued: "issued",
  consumed: "consumed",
  expired: "expired",
  invalidated: "invalidated",
});

export type PairingTokenStatus = typeof PairingTokenStatuses[keyof typeof PairingTokenStatuses];

export const PairingSessionStatuses = Object.freeze({
  initiated: "initiated",
  validated: "validated",
  completed: "completed",
  expired: "expired",
  invalidated: "invalidated",
  rejected: "rejected",
});

export type PairingSessionStatus = typeof PairingSessionStatuses[keyof typeof PairingSessionStatuses];

export const PairingTokenArtifactTypes = Object.freeze({
  oneTimeCode: "one-time-code",
  qrPayload: "qr-payload",
});

export type PairingTokenArtifactType = typeof PairingTokenArtifactTypes[keyof typeof PairingTokenArtifactTypes];

export const PairingTokenActorScopes = Object.freeze({
  sameUser: "same-user",
  workspaceAdmin: "workspace-admin",
  bootstrapAdmin: "bootstrap-admin",
  sessionBound: "session-bound",
});

export type PairingTokenActorScope = typeof PairingTokenActorScopes[keyof typeof PairingTokenActorScopes];

export const PairingTokenInvalidationReasons = Object.freeze({
  manualCancel: "manual-cancel",
  invalidTokenPresented: "invalid-token-presented",
  tokenReused: "token-reused",
  attemptLimitReached: "attempt-limit-reached",
  trustedDeviceRevoked: "trusted-device-revoked",
});

export type PairingTokenInvalidationReason =
  typeof PairingTokenInvalidationReasons[keyof typeof PairingTokenInvalidationReasons];

export const PairingSessionRejectionReasons = Object.freeze({
  invalidToken: "invalid-token",
  tokenReused: "token-reused",
  tokenExpired: "token-expired",
  actorScopeViolation: "actor-scope-violation",
});

export type PairingSessionRejectionReason =
  typeof PairingSessionRejectionReasons[keyof typeof PairingSessionRejectionReasons];

export interface PairingTokenIssuanceMetadata {
  readonly issuedByUserIdentityId?: string;
  readonly issuedFromIpAddress?: string;
  readonly issuedFromUserAgent?: string;
  readonly channelHint?: string;
}

export interface PairingTokenActorBinding {
  readonly scope: PairingTokenActorScope;
  readonly userIdentityId?: string;
  readonly sessionId?: string;
}

export interface PairingTokenAttemptState {
  readonly failedValidationAttempts: number;
  readonly maxValidationAttempts: number;
  readonly lastValidationAttemptAt?: string;
}

export interface PairingTokenInvalidation {
  readonly reason: PairingTokenInvalidationReason;
  readonly invalidatedAt: string;
  readonly invalidatedByUserIdentityId?: string;
  readonly note?: string;
}

export interface PairingTokenConsumption {
  readonly consumedAt: string;
  readonly consumedByUserIdentityId?: string;
}

export interface PairingToken {
  readonly id: string;
  readonly pairingSessionId: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly artifactType: PairingTokenArtifactType;
  readonly tokenHash: string;
  readonly hashAlgorithm: "sha256";
  readonly actorBinding: PairingTokenActorBinding;
  readonly issuance: PairingTokenIssuanceMetadata;
  readonly attempts: PairingTokenAttemptState;
  readonly status: PairingTokenStatus;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumed?: PairingTokenConsumption;
  readonly invalidation?: PairingTokenInvalidation;
  readonly updatedAt: string;
}

export interface PairingPinnedTrustMaterialRegistration {
  readonly materialKind: DeviceTrustMaterialKind;
  readonly pinReference: string;
  readonly publicKeyFingerprint?: string;
}

export interface PairingSessionCompletion {
  readonly completedAt: string;
  readonly completedByUserIdentityId?: string;
  readonly trustMaterialRegistration?: PairingPinnedTrustMaterialRegistration;
}

export interface PairingSessionRejection {
  readonly rejectedAt: string;
  readonly reason: PairingSessionRejectionReason;
  readonly note?: string;
}

export interface PairingSession {
  readonly id: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly pairingTokenId: string;
  readonly status: PairingSessionStatus;
  readonly initiatedAt: string;
  readonly validatedAt?: string;
  readonly completion?: PairingSessionCompletion;
  readonly rejection?: PairingSessionRejection;
  readonly invalidatedAt?: string;
  readonly expiredAt?: string;
  readonly updatedAt: string;
}

export const PairingTokenLifecycleTransitions: Readonly<
  Record<PairingTokenStatus, ReadonlyArray<PairingTokenStatus>>
> = Object.freeze({
  [PairingTokenStatuses.issued]: Object.freeze([
    PairingTokenStatuses.consumed,
    PairingTokenStatuses.expired,
    PairingTokenStatuses.invalidated,
  ]),
  [PairingTokenStatuses.consumed]: Object.freeze([]),
  [PairingTokenStatuses.expired]: Object.freeze([]),
  [PairingTokenStatuses.invalidated]: Object.freeze([]),
});

export const PairingSessionLifecycleTransitions: Readonly<
  Record<PairingSessionStatus, ReadonlyArray<PairingSessionStatus>>
> = Object.freeze({
  [PairingSessionStatuses.initiated]: Object.freeze([
    PairingSessionStatuses.validated,
    PairingSessionStatuses.completed,
    PairingSessionStatuses.expired,
    PairingSessionStatuses.invalidated,
    PairingSessionStatuses.rejected,
  ]),
  [PairingSessionStatuses.validated]: Object.freeze([
    PairingSessionStatuses.completed,
    PairingSessionStatuses.expired,
    PairingSessionStatuses.invalidated,
    PairingSessionStatuses.rejected,
  ]),
  [PairingSessionStatuses.completed]: Object.freeze([]),
  [PairingSessionStatuses.expired]: Object.freeze([]),
  [PairingSessionStatuses.invalidated]: Object.freeze([]),
  [PairingSessionStatuses.rejected]: Object.freeze([]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TrustedDevicePairingDomainError(`${field} is required.`);
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
    throw new TrustedDevicePairingDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function assertPairingTokenTransitionAllowed(from: PairingTokenStatus, to: PairingTokenStatus): void {
  if (from === to) {
    return;
  }
  if (!PairingTokenLifecycleTransitions[from].includes(to)) {
    throw new PairingTokenLifecycleTransitionError(from, to);
  }
}

function assertPairingSessionTransitionAllowed(from: PairingSessionStatus, to: PairingSessionStatus): void {
  if (from === to) {
    return;
  }
  if (!PairingSessionLifecycleTransitions[from].includes(to)) {
    throw new PairingSessionLifecycleTransitionError(from, to);
  }
}

function normalizeActorScope(value: PairingTokenActorScope): PairingTokenActorScope {
  if (!Object.values(PairingTokenActorScopes).includes(value)) {
    throw new TrustedDevicePairingDomainError(`Pairing actor scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeArtifactType(value: PairingTokenArtifactType): PairingTokenArtifactType {
  if (!Object.values(PairingTokenArtifactTypes).includes(value)) {
    throw new TrustedDevicePairingDomainError(`Pairing token artifact type '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeTokenStatus(value: PairingTokenStatus): PairingTokenStatus {
  if (!Object.values(PairingTokenStatuses).includes(value)) {
    throw new TrustedDevicePairingDomainError(`Pairing token status '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSessionStatus(value: PairingSessionStatus): PairingSessionStatus {
  if (!Object.values(PairingSessionStatuses).includes(value)) {
    throw new TrustedDevicePairingDomainError(`Pairing session status '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeAttempts(input?: {
  readonly failedValidationAttempts?: number;
  readonly maxValidationAttempts?: number;
  readonly lastValidationAttemptAt?: Date | string;
}): PairingTokenAttemptState {
  const maxValidationAttempts = input?.maxValidationAttempts ?? 5;
  if (!Number.isInteger(maxValidationAttempts) || maxValidationAttempts < 1) {
    throw new TrustedDevicePairingDomainError("Pairing token maxValidationAttempts must be at least 1.");
  }

  const failedValidationAttempts = input?.failedValidationAttempts ?? 0;
  if (!Number.isInteger(failedValidationAttempts) || failedValidationAttempts < 0) {
    throw new TrustedDevicePairingDomainError("Pairing token failedValidationAttempts cannot be negative.");
  }

  if (failedValidationAttempts > maxValidationAttempts) {
    throw new TrustedDevicePairingDomainError(
      "Pairing token failedValidationAttempts cannot exceed maxValidationAttempts.",
    );
  }

  return Object.freeze({
    failedValidationAttempts,
    maxValidationAttempts,
    lastValidationAttemptAt: input?.lastValidationAttemptAt
      ? normalizeIsoTimestamp(input.lastValidationAttemptAt, "Pairing token lastValidationAttemptAt")
      : undefined,
  });
}

function assertPairingTokenState(token: PairingToken): void {
  if (new Date(token.expiresAt).getTime() <= new Date(token.issuedAt).getTime()) {
    throw new TrustedDevicePairingDomainError("Pairing token expiresAt must be later than issuedAt.");
  }

  if (token.status === PairingTokenStatuses.consumed && !token.consumed) {
    throw new TrustedDevicePairingDomainError("Consumed pairing tokens must include consumption details.");
  }

  if (token.status !== PairingTokenStatuses.consumed && token.consumed) {
    throw new TrustedDevicePairingDomainError("Only consumed pairing tokens may include consumption details.");
  }

  if (token.status === PairingTokenStatuses.invalidated && !token.invalidation) {
    throw new TrustedDevicePairingDomainError("Invalidated pairing tokens must include invalidation details.");
  }

  if (token.status !== PairingTokenStatuses.invalidated && token.invalidation) {
    throw new TrustedDevicePairingDomainError("Only invalidated pairing tokens may include invalidation details.");
  }

  if (token.consumed && new Date(token.consumed.consumedAt).getTime() < new Date(token.issuedAt).getTime()) {
    throw new TrustedDevicePairingDomainError("Pairing token consumedAt cannot be earlier than issuedAt.");
  }

  if (
    token.attempts.lastValidationAttemptAt &&
    new Date(token.attempts.lastValidationAttemptAt).getTime() < new Date(token.issuedAt).getTime()
  ) {
    throw new TrustedDevicePairingDomainError(
      "Pairing token lastValidationAttemptAt cannot be earlier than issuedAt.",
    );
  }
}

function normalizePairingTokenInvalidation(input: {
  readonly reason: PairingTokenInvalidationReason;
  readonly invalidatedAt?: Date | string;
  readonly invalidatedByUserIdentityId?: string;
  readonly note?: string;
}): PairingTokenInvalidation {
  if (!Object.values(PairingTokenInvalidationReasons).includes(input.reason)) {
    throw new TrustedDevicePairingDomainError(`Pairing token invalidation reason '${String(input.reason)}' is invalid.`);
  }
  return Object.freeze({
    reason: input.reason,
    invalidatedAt: normalizeIsoTimestamp(input.invalidatedAt ?? new Date(), "Pairing token invalidatedAt"),
    invalidatedByUserIdentityId: normalizeOptional(input.invalidatedByUserIdentityId),
    note: normalizeOptional(input.note),
  });
}

function normalizePairingSessionRejection(input: {
  readonly reason: PairingSessionRejectionReason;
  readonly rejectedAt?: Date | string;
  readonly note?: string;
}): PairingSessionRejection {
  if (!Object.values(PairingSessionRejectionReasons).includes(input.reason)) {
    throw new TrustedDevicePairingDomainError(`Pairing session rejection reason '${String(input.reason)}' is invalid.`);
  }
  return Object.freeze({
    reason: input.reason,
    rejectedAt: normalizeIsoTimestamp(input.rejectedAt ?? new Date(), "Pairing session rejectedAt"),
    note: normalizeOptional(input.note),
  });
}

function assertPairingSessionState(session: PairingSession): void {
  if (session.status === PairingSessionStatuses.validated && !session.validatedAt) {
    throw new TrustedDevicePairingDomainError("Validated pairing sessions must include validatedAt.");
  }

  if (session.status === PairingSessionStatuses.completed && !session.completion) {
    throw new TrustedDevicePairingDomainError("Completed pairing sessions must include completion details.");
  }

  if (session.status !== PairingSessionStatuses.completed && session.completion) {
    throw new TrustedDevicePairingDomainError("Only completed pairing sessions may include completion details.");
  }

  if (session.status === PairingSessionStatuses.rejected && !session.rejection) {
    throw new TrustedDevicePairingDomainError("Rejected pairing sessions must include rejection details.");
  }

  if (session.status !== PairingSessionStatuses.rejected && session.rejection) {
    throw new TrustedDevicePairingDomainError("Only rejected pairing sessions may include rejection details.");
  }

  if (session.status === PairingSessionStatuses.invalidated && !session.invalidatedAt) {
    throw new TrustedDevicePairingDomainError("Invalidated pairing sessions must include invalidatedAt.");
  }

  if (session.status !== PairingSessionStatuses.invalidated && session.invalidatedAt) {
    throw new TrustedDevicePairingDomainError("Only invalidated pairing sessions may include invalidatedAt.");
  }

  if (session.status === PairingSessionStatuses.expired && !session.expiredAt) {
    throw new TrustedDevicePairingDomainError("Expired pairing sessions must include expiredAt.");
  }

  if (session.status !== PairingSessionStatuses.expired && session.expiredAt) {
    throw new TrustedDevicePairingDomainError("Only expired pairing sessions may include expiredAt.");
  }

  if (session.validatedAt && new Date(session.validatedAt).getTime() < new Date(session.initiatedAt).getTime()) {
    throw new TrustedDevicePairingDomainError("Pairing session validatedAt cannot be earlier than initiatedAt.");
  }

  if (
    session.completion &&
    new Date(session.completion.completedAt).getTime() < new Date(session.initiatedAt).getTime()
  ) {
    throw new TrustedDevicePairingDomainError("Pairing session completedAt cannot be earlier than initiatedAt.");
  }
}

export function createPairingToken(input: {
  readonly id: string;
  readonly pairingSessionId: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly artifactType: PairingTokenArtifactType;
  readonly tokenHash: string;
  readonly actorBinding: PairingTokenActorBinding;
  readonly issuance?: PairingTokenIssuanceMetadata;
  readonly attempts?: {
    readonly failedValidationAttempts?: number;
    readonly maxValidationAttempts?: number;
    readonly lastValidationAttemptAt?: Date | string;
  };
  readonly status?: PairingTokenStatus;
  readonly issuedAt?: Date | string;
  readonly expiresAt: Date | string;
  readonly consumed?: PairingTokenConsumption;
  readonly invalidation?: PairingTokenInvalidation;
  readonly updatedAt?: Date | string;
}): PairingToken {
  const issuedAt = normalizeIsoTimestamp(input.issuedAt ?? new Date(), "Pairing token issuedAt");
  const token: PairingToken = Object.freeze({
    id: normalizeRequired(input.id, "Pairing token id"),
    pairingSessionId: normalizeRequired(input.pairingSessionId, "Pairing token pairingSessionId"),
    trustedDeviceId: normalizeRequired(input.trustedDeviceId, "Pairing token trustedDeviceId"),
    userIdentityId: normalizeRequired(input.userIdentityId, "Pairing token userIdentityId"),
    workspaceId: normalizeOptional(input.workspaceId),
    artifactType: normalizeArtifactType(input.artifactType),
    tokenHash: normalizeRequired(input.tokenHash, "Pairing token tokenHash"),
    hashAlgorithm: "sha256",
    actorBinding: Object.freeze({
      scope: normalizeActorScope(input.actorBinding.scope),
      userIdentityId: normalizeOptional(input.actorBinding.userIdentityId),
      sessionId: normalizeOptional(input.actorBinding.sessionId),
    }),
    issuance: Object.freeze({
      issuedByUserIdentityId: normalizeOptional(input.issuance?.issuedByUserIdentityId),
      issuedFromIpAddress: normalizeOptional(input.issuance?.issuedFromIpAddress),
      issuedFromUserAgent: normalizeOptional(input.issuance?.issuedFromUserAgent),
      channelHint: normalizeOptional(input.issuance?.channelHint),
    }),
    attempts: normalizeAttempts(input.attempts),
    status: normalizeTokenStatus(input.status ?? PairingTokenStatuses.issued),
    issuedAt,
    expiresAt: normalizeIsoTimestamp(input.expiresAt, "Pairing token expiresAt"),
    consumed: input.consumed
      ? Object.freeze({
          consumedAt: normalizeIsoTimestamp(input.consumed.consumedAt, "Pairing token consumedAt"),
          consumedByUserIdentityId: normalizeOptional(input.consumed.consumedByUserIdentityId),
        })
      : undefined,
    invalidation: input.invalidation
      ? Object.freeze({
          reason: input.invalidation.reason,
          invalidatedAt: normalizeIsoTimestamp(input.invalidation.invalidatedAt, "Pairing token invalidatedAt"),
          invalidatedByUserIdentityId: normalizeOptional(input.invalidation.invalidatedByUserIdentityId),
          note: normalizeOptional(input.invalidation.note),
        })
      : undefined,
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? issuedAt, "Pairing token updatedAt"),
  });

  assertPairingTokenState(token);
  return token;
}

export function createPairingSession(input: {
  readonly id: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly pairingTokenId: string;
  readonly status?: PairingSessionStatus;
  readonly initiatedAt?: Date | string;
  readonly validatedAt?: Date | string;
  readonly completion?: PairingSessionCompletion;
  readonly rejection?: PairingSessionRejection;
  readonly invalidatedAt?: Date | string;
  readonly expiredAt?: Date | string;
  readonly updatedAt?: Date | string;
}): PairingSession {
  const initiatedAt = normalizeIsoTimestamp(input.initiatedAt ?? new Date(), "Pairing session initiatedAt");
  const session: PairingSession = Object.freeze({
    id: normalizeRequired(input.id, "Pairing session id"),
    trustedDeviceId: normalizeRequired(input.trustedDeviceId, "Pairing session trustedDeviceId"),
    userIdentityId: normalizeRequired(input.userIdentityId, "Pairing session userIdentityId"),
    workspaceId: normalizeOptional(input.workspaceId),
    pairingTokenId: normalizeRequired(input.pairingTokenId, "Pairing session pairingTokenId"),
    status: normalizeSessionStatus(input.status ?? PairingSessionStatuses.initiated),
    initiatedAt,
    validatedAt: input.validatedAt
      ? normalizeIsoTimestamp(input.validatedAt, "Pairing session validatedAt")
      : undefined,
    completion: input.completion
      ? Object.freeze({
          completedAt: normalizeIsoTimestamp(input.completion.completedAt, "Pairing session completedAt"),
          completedByUserIdentityId: normalizeOptional(input.completion.completedByUserIdentityId),
          trustMaterialRegistration: input.completion.trustMaterialRegistration
            ? Object.freeze({
                materialKind: input.completion.trustMaterialRegistration.materialKind,
                pinReference: normalizeRequired(
                  input.completion.trustMaterialRegistration.pinReference,
                  "Pairing session trust material pinReference",
                ),
                publicKeyFingerprint: normalizeOptional(
                  input.completion.trustMaterialRegistration.publicKeyFingerprint,
                ),
              })
            : undefined,
        })
      : undefined,
    rejection: input.rejection
      ? Object.freeze({
          rejectedAt: normalizeIsoTimestamp(input.rejection.rejectedAt, "Pairing session rejectedAt"),
          reason: input.rejection.reason,
          note: normalizeOptional(input.rejection.note),
        })
      : undefined,
    invalidatedAt: input.invalidatedAt
      ? normalizeIsoTimestamp(input.invalidatedAt, "Pairing session invalidatedAt")
      : undefined,
    expiredAt: input.expiredAt
      ? normalizeIsoTimestamp(input.expiredAt, "Pairing session expiredAt")
      : undefined,
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? initiatedAt, "Pairing session updatedAt"),
  });
  assertPairingSessionState(session);
  return session;
}

export function isPairingTokenActive(token: PairingToken, now: Date = new Date()): boolean {
  if (token.status !== PairingTokenStatuses.issued) {
    return false;
  }
  if (new Date(token.expiresAt).getTime() <= now.getTime()) {
    return false;
  }
  if (token.attempts.failedValidationAttempts >= token.attempts.maxValidationAttempts) {
    return false;
  }
  return true;
}

export function registerPairingTokenFailedAttempt(
  token: PairingToken,
  input?: {
    readonly attemptedAt?: Date | string;
    readonly invalidateWhenLimitReached?: boolean;
    readonly invalidatedByUserIdentityId?: string;
    readonly note?: string;
  },
): PairingToken {
  if (token.status !== PairingTokenStatuses.issued) {
    throw new TrustedDevicePairingDomainError("Failed attempts can only be recorded for issued pairing tokens.");
  }

  const attemptedAt = normalizeIsoTimestamp(
    input?.attemptedAt ?? new Date(),
    "Pairing token failed attempt attemptedAt",
  );

  const failedValidationAttempts = token.attempts.failedValidationAttempts + 1;
  const attempts = normalizeAttempts({
    failedValidationAttempts: Math.min(failedValidationAttempts, token.attempts.maxValidationAttempts),
    maxValidationAttempts: token.attempts.maxValidationAttempts,
    lastValidationAttemptAt: attemptedAt,
  });

  const limitReached = failedValidationAttempts >= token.attempts.maxValidationAttempts;
  if (limitReached && input?.invalidateWhenLimitReached !== false) {
    return invalidatePairingToken(
      Object.freeze({
        ...token,
        attempts,
        updatedAt: attemptedAt,
      }),
      {
        reason: PairingTokenInvalidationReasons.attemptLimitReached,
        invalidatedAt: attemptedAt,
        invalidatedByUserIdentityId: input.invalidatedByUserIdentityId,
        note: input.note,
      },
    );
  }

  const updated = Object.freeze({
    ...token,
    attempts,
    updatedAt: attemptedAt,
  });
  assertPairingTokenState(updated);
  return updated;
}

export function consumePairingToken(
  token: PairingToken,
  input?: {
    readonly consumedAt?: Date | string;
    readonly consumedByUserIdentityId?: string;
  },
): PairingToken {
  const consumedAt = normalizeIsoTimestamp(input?.consumedAt ?? new Date(), "Pairing token consumedAt");
  if (!isPairingTokenActive(token, new Date(consumedAt))) {
    throw new TrustedDevicePairingDomainError("Pairing token is not active and cannot be consumed.");
  }

  assertPairingTokenTransitionAllowed(token.status, PairingTokenStatuses.consumed);

  const updated: PairingToken = Object.freeze({
    ...token,
    status: PairingTokenStatuses.consumed,
    consumed: Object.freeze({
      consumedAt,
      consumedByUserIdentityId: normalizeOptional(input?.consumedByUserIdentityId),
    }),
    invalidation: undefined,
    updatedAt: consumedAt,
  });
  assertPairingTokenState(updated);
  return updated;
}

export function expirePairingToken(token: PairingToken, now: Date = new Date()): PairingToken {
  if (token.status !== PairingTokenStatuses.issued) {
    throw new TrustedDevicePairingDomainError("Only issued pairing tokens can be expired.");
  }
  if (new Date(token.expiresAt).getTime() > now.getTime()) {
    throw new TrustedDevicePairingDomainError("Pairing token cannot be expired before its expiresAt timestamp.");
  }
  assertPairingTokenTransitionAllowed(token.status, PairingTokenStatuses.expired);

  const nowIso = now.toISOString();
  const updated: PairingToken = Object.freeze({
    ...token,
    status: PairingTokenStatuses.expired,
    consumed: undefined,
    invalidation: undefined,
    updatedAt: nowIso,
  });
  assertPairingTokenState(updated);
  return updated;
}

export function invalidatePairingToken(
  token: PairingToken,
  input: {
    readonly reason: PairingTokenInvalidationReason;
    readonly invalidatedAt?: Date | string;
    readonly invalidatedByUserIdentityId?: string;
    readonly note?: string;
  },
): PairingToken {
  if (token.status !== PairingTokenStatuses.issued) {
    throw new TrustedDevicePairingDomainError("Only issued pairing tokens can be invalidated.");
  }
  const invalidation = normalizePairingTokenInvalidation(input);
  assertPairingTokenTransitionAllowed(token.status, PairingTokenStatuses.invalidated);

  const updated: PairingToken = Object.freeze({
    ...token,
    status: PairingTokenStatuses.invalidated,
    invalidation,
    consumed: undefined,
    updatedAt: invalidation.invalidatedAt,
  });
  assertPairingTokenState(updated);
  return updated;
}

export function markPairingSessionValidated(
  session: PairingSession,
  input?: {
    readonly validatedAt?: Date | string;
  },
): PairingSession {
  const validatedAt = normalizeIsoTimestamp(input?.validatedAt ?? new Date(), "Pairing session validatedAt");
  assertPairingSessionTransitionAllowed(session.status, PairingSessionStatuses.validated);

  const updated: PairingSession = Object.freeze({
    ...session,
    status: PairingSessionStatuses.validated,
    validatedAt,
    completion: undefined,
    rejection: undefined,
    invalidatedAt: undefined,
    expiredAt: undefined,
    updatedAt: validatedAt,
  });
  assertPairingSessionState(updated);
  return updated;
}

export function completePairingSession(
  session: PairingSession,
  token: PairingToken,
  input: {
    readonly completedAt?: Date | string;
    readonly completedByUserIdentityId?: string;
    readonly trustMaterialRegistration?: PairingPinnedTrustMaterialRegistration;
  },
): PairingSession {
  const completedAt = normalizeIsoTimestamp(input.completedAt ?? new Date(), "Pairing session completedAt");
  if (token.status !== PairingTokenStatuses.consumed) {
    throw new TrustedDevicePairingDomainError("Pairing session completion requires a consumed pairing token.");
  }
  if (token.id !== session.pairingTokenId) {
    throw new TrustedDevicePairingDomainError("Pairing token does not belong to pairing session.");
  }

  assertPairingSessionTransitionAllowed(session.status, PairingSessionStatuses.completed);

  const updated: PairingSession = Object.freeze({
    ...session,
    status: PairingSessionStatuses.completed,
    completion: Object.freeze({
      completedAt,
      completedByUserIdentityId: normalizeOptional(input.completedByUserIdentityId),
      trustMaterialRegistration: input.trustMaterialRegistration
        ? Object.freeze({
            materialKind: input.trustMaterialRegistration.materialKind,
            pinReference: normalizeRequired(
              input.trustMaterialRegistration.pinReference,
              "Pairing session trust material pinReference",
            ),
            publicKeyFingerprint: normalizeOptional(input.trustMaterialRegistration.publicKeyFingerprint),
          })
        : undefined,
    }),
    rejection: undefined,
    invalidatedAt: undefined,
    expiredAt: undefined,
    updatedAt: completedAt,
  });
  assertPairingSessionState(updated);
  return updated;
}

export function rejectPairingSession(
  session: PairingSession,
  input: {
    readonly reason: PairingSessionRejectionReason;
    readonly rejectedAt?: Date | string;
    readonly note?: string;
  },
): PairingSession {
  const rejection = normalizePairingSessionRejection(input);
  assertPairingSessionTransitionAllowed(session.status, PairingSessionStatuses.rejected);

  const updated: PairingSession = Object.freeze({
    ...session,
    status: PairingSessionStatuses.rejected,
    rejection,
    completion: undefined,
    invalidatedAt: undefined,
    expiredAt: undefined,
    updatedAt: rejection.rejectedAt,
  });
  assertPairingSessionState(updated);
  return updated;
}

export function expirePairingSession(session: PairingSession, now: Date = new Date()): PairingSession {
  assertPairingSessionTransitionAllowed(session.status, PairingSessionStatuses.expired);
  const nowIso = now.toISOString();
  const updated: PairingSession = Object.freeze({
    ...session,
    status: PairingSessionStatuses.expired,
    completion: undefined,
    rejection: undefined,
    invalidatedAt: undefined,
    expiredAt: nowIso,
    updatedAt: nowIso,
  });
  assertPairingSessionState(updated);
  return updated;
}

export function invalidatePairingSession(
  session: PairingSession,
  input?: {
    readonly invalidatedAt?: Date | string;
  },
): PairingSession {
  assertPairingSessionTransitionAllowed(session.status, PairingSessionStatuses.invalidated);
  const invalidatedAt = normalizeIsoTimestamp(input?.invalidatedAt ?? new Date(), "Pairing session invalidatedAt");
  const updated: PairingSession = Object.freeze({
    ...session,
    status: PairingSessionStatuses.invalidated,
    completion: undefined,
    rejection: undefined,
    invalidatedAt,
    expiredAt: undefined,
    updatedAt: invalidatedAt,
  });
  assertPairingSessionState(updated);
  return updated;
}
