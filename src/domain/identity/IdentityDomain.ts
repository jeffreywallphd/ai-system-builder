export class IdentityDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityDomainError";
  }
}

export class IdentityLifecycleTransitionError extends IdentityDomainError {
  constructor(fromStatus: UserIdentityStatus, toStatus: UserIdentityStatus) {
    super(`User identity lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "IdentityLifecycleTransitionError";
  }
}

export class SessionLifecycleTransitionError extends IdentityDomainError {
  constructor(fromStatus: IdentitySessionStatus, toStatus: IdentitySessionStatus) {
    super(`Identity session lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "SessionLifecycleTransitionError";
  }
}

export const AuthProviderCategories = Object.freeze({
  local: "local",
  external: "external",
});

export type AuthProviderCategory = typeof AuthProviderCategories[keyof typeof AuthProviderCategories];

export const AuthProviderKinds = Object.freeze({
  localPassword: "local-password",
  oidc: "oidc",
  oauth2: "oauth2",
  saml: "saml",
  passkey: "passkey",
  custom: "custom",
});

export type AuthProviderKind = typeof AuthProviderKinds[keyof typeof AuthProviderKinds];

export const AuthProviderStatuses = Object.freeze({
  active: "active",
  disabled: "disabled",
  deprecated: "deprecated",
});

export type AuthProviderStatus = typeof AuthProviderStatuses[keyof typeof AuthProviderStatuses];

export interface AuthProvider {
  readonly id: string;
  readonly kind: AuthProviderKind;
  readonly category: AuthProviderCategory;
  readonly displayName: string;
  readonly isFirstParty: boolean;
  readonly status: AuthProviderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CredentialPolicy {
  readonly id: string;
  readonly minLength: number;
  readonly maxLength: number;
  readonly requireLowercase: boolean;
  readonly requireUppercase: boolean;
  readonly requireNumber: boolean;
  readonly requireSymbol: boolean;
  readonly minUniqueCharacters: number;
  readonly maxRepeatedCharacters: number;
  readonly blockedSubstrings: ReadonlyArray<string>;
  readonly minPasswordAgeDays: number;
  readonly maxPasswordAgeDays: number;
  readonly passwordHistoryCount: number;
  readonly maxFailedAttempts: number;
  readonly lockoutDurationMinutes: number;
}

export interface CredentialPolicyValidationIssue {
  readonly code: "length" | "lowercase" | "uppercase" | "number" | "symbol" | "unique" | "repeat" | "blocked-substring";
  readonly message: string;
}

export interface CredentialPolicyValidationResult {
  readonly isValid: boolean;
  readonly issues: ReadonlyArray<CredentialPolicyValidationIssue>;
}

export const CredentialStatuses = Object.freeze({
  active: "active",
  resetRequired: "reset-required",
  locked: "locked",
  compromised: "compromised",
  disabled: "disabled",
});

export type CredentialStatus = typeof CredentialStatuses[keyof typeof CredentialStatuses];

export interface CredentialState {
  readonly status: CredentialStatus;
  readonly policyId: string;
  readonly failedAttempts: number;
  readonly lockoutUntil?: string;
  readonly passwordChangedAt?: string;
  readonly resetRequiredAt?: string;
  readonly compromisedAt?: string;
  readonly disabledAt?: string;
}

export interface UserIdentityProviderLink {
  readonly providerId: string;
  readonly providerSubject: string;
  readonly isPrimary: boolean;
  readonly linkedAt: string;
  readonly unlinkedAt?: string;
  readonly credentialState?: CredentialState;
  readonly lastAuthenticatedAt?: string;
}

export const UserIdentityStatuses = Object.freeze({
  pendingActivation: "pending-activation",
  active: "active",
  suspended: "suspended",
  locked: "locked",
  deactivated: "deactivated",
});

export type UserIdentityStatus = typeof UserIdentityStatuses[keyof typeof UserIdentityStatuses];

export interface UserIdentity {
  readonly id: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly status: UserIdentityStatus;
  readonly linkedProviders: ReadonlyArray<UserIdentityProviderLink>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly suspendedAt?: string;
  readonly lockedAt?: string;
  readonly deactivatedAt?: string;
}

export const IdentitySessionStatuses = Object.freeze({
  active: "active",
  rotated: "rotated",
  expired: "expired",
  revoked: "revoked",
});

export type IdentitySessionStatus = typeof IdentitySessionStatuses[keyof typeof IdentitySessionStatuses];

export interface SessionClientContext {
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly deviceId?: string;
}

export interface SessionRevocation {
  readonly reason: "logout" | "security" | "rotation" | "admin";
  readonly revokedAt: string;
}

export interface Session {
  readonly id: string;
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly status: IdentitySessionStatus;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly rotatedAt?: string;
  readonly replacedBySessionId?: string;
  readonly revocation?: SessionRevocation;
  readonly client?: SessionClientContext;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new IdentityDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeEmail(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new IdentityDomainError(`Email '${value}' is invalid.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new IdentityDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeCredentialStatus(value?: CredentialStatus): CredentialStatus {
  const status = value ?? CredentialStatuses.active;
  if (!Object.values(CredentialStatuses).includes(status)) {
    throw new IdentityDomainError(`Credential status '${String(value)}' is invalid.`);
  }
  return status;
}

function normalizeCredentialState(input: {
  readonly status?: CredentialStatus;
  readonly policyId: string;
  readonly failedAttempts?: number;
  readonly lockoutUntil?: string;
  readonly passwordChangedAt?: Date | string;
  readonly resetRequiredAt?: Date | string;
  readonly compromisedAt?: Date | string;
  readonly disabledAt?: Date | string;
}): CredentialState {
  const status = normalizeCredentialStatus(input.status);
  const failedAttempts = input.failedAttempts ?? 0;
  if (!Number.isInteger(failedAttempts) || failedAttempts < 0) {
    throw new IdentityDomainError("Credential failedAttempts must be a non-negative integer.");
  }

  const lockoutUntil = normalizeOptional(input.lockoutUntil);
  if (status === CredentialStatuses.locked && !lockoutUntil) {
    throw new IdentityDomainError("Locked credentials must include lockoutUntil.");
  }

  return Object.freeze({
    status,
    policyId: normalizeRequired(input.policyId, "Credential policy id"),
    failedAttempts,
    lockoutUntil,
    passwordChangedAt: input.passwordChangedAt ? normalizeIsoTimestamp(input.passwordChangedAt, "Credential passwordChangedAt") : undefined,
    resetRequiredAt: input.resetRequiredAt ? normalizeIsoTimestamp(input.resetRequiredAt, "Credential resetRequiredAt") : undefined,
    compromisedAt: input.compromisedAt ? normalizeIsoTimestamp(input.compromisedAt, "Credential compromisedAt") : undefined,
    disabledAt: input.disabledAt ? normalizeIsoTimestamp(input.disabledAt, "Credential disabledAt") : undefined,
  });
}

function normalizeProviderLink(input: {
  readonly providerId: string;
  readonly providerSubject: string;
  readonly isPrimary?: boolean;
  readonly linkedAt?: Date | string;
  readonly unlinkedAt?: Date | string;
  readonly credentialState?: CredentialState;
  readonly lastAuthenticatedAt?: Date | string;
}): UserIdentityProviderLink {
  const linkedAt = normalizeIsoTimestamp(input.linkedAt ?? new Date(), "Provider link linkedAt");
  return Object.freeze({
    providerId: normalizeRequired(input.providerId, "Provider link providerId"),
    providerSubject: normalizeRequired(input.providerSubject, "Provider link providerSubject"),
    isPrimary: input.isPrimary ?? false,
    linkedAt,
    unlinkedAt: input.unlinkedAt ? normalizeIsoTimestamp(input.unlinkedAt, "Provider link unlinkedAt") : undefined,
    credentialState: input.credentialState,
    lastAuthenticatedAt: input.lastAuthenticatedAt ? normalizeIsoTimestamp(input.lastAuthenticatedAt, "Provider link lastAuthenticatedAt") : undefined,
  });
}

function normalizeProviderLinks(
  links?: ReadonlyArray<UserIdentityProviderLink>,
): ReadonlyArray<UserIdentityProviderLink> {
  const normalized = (links ?? []).map((entry) => normalizeProviderLink(entry));
  if (normalized.length === 0) {
    throw new IdentityDomainError("User identity must include at least one linked provider.");
  }

  let primaryCount = 0;
  const deduped = new Map<string, UserIdentityProviderLink>();

  for (const link of normalized) {
    if (link.isPrimary) {
      primaryCount += 1;
    }

    const dedupeKey = `${link.providerId}|${link.providerSubject}`;
    if (deduped.has(dedupeKey)) {
      throw new IdentityDomainError(`Duplicate provider link '${dedupeKey}' is not allowed.`);
    }

    deduped.set(dedupeKey, link);
  }

  if (primaryCount !== 1) {
    throw new IdentityDomainError("User identity must have exactly one primary provider link.");
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeUserIdentityStatus(value?: UserIdentityStatus): UserIdentityStatus {
  const status = value ?? UserIdentityStatuses.pendingActivation;
  if (!Object.values(UserIdentityStatuses).includes(status)) {
    throw new IdentityDomainError(`User identity status '${String(value)}' is invalid.`);
  }
  return status;
}

function assertIdentityTransitionAllowed(from: UserIdentityStatus, to: UserIdentityStatus): void {
  if (from === to) {
    return;
  }

  const allowed: Readonly<Record<UserIdentityStatus, ReadonlyArray<UserIdentityStatus>>> = {
    [UserIdentityStatuses.pendingActivation]: Object.freeze([UserIdentityStatuses.active, UserIdentityStatuses.deactivated]),
    [UserIdentityStatuses.active]: Object.freeze([UserIdentityStatuses.locked, UserIdentityStatuses.suspended, UserIdentityStatuses.deactivated]),
    [UserIdentityStatuses.locked]: Object.freeze([UserIdentityStatuses.active, UserIdentityStatuses.suspended, UserIdentityStatuses.deactivated]),
    [UserIdentityStatuses.suspended]: Object.freeze([UserIdentityStatuses.active, UserIdentityStatuses.deactivated]),
    [UserIdentityStatuses.deactivated]: Object.freeze([]),
  };

  if (!allowed[from].includes(to)) {
    throw new IdentityLifecycleTransitionError(from, to);
  }
}

function normalizeSessionStatus(value?: IdentitySessionStatus): IdentitySessionStatus {
  const status = value ?? IdentitySessionStatuses.active;
  if (!Object.values(IdentitySessionStatuses).includes(status)) {
    throw new IdentityDomainError(`Session status '${String(value)}' is invalid.`);
  }
  return status;
}

function assertSessionTransitionAllowed(from: IdentitySessionStatus, to: IdentitySessionStatus): void {
  if (from === to) {
    return;
  }

  const allowed: Readonly<Record<IdentitySessionStatus, ReadonlyArray<IdentitySessionStatus>>> = {
    [IdentitySessionStatuses.active]: Object.freeze([IdentitySessionStatuses.rotated, IdentitySessionStatuses.expired, IdentitySessionStatuses.revoked]),
    [IdentitySessionStatuses.rotated]: Object.freeze([]),
    [IdentitySessionStatuses.expired]: Object.freeze([]),
    [IdentitySessionStatuses.revoked]: Object.freeze([]),
  };

  if (!allowed[from].includes(to)) {
    throw new SessionLifecycleTransitionError(from, to);
  }
}

function normalizeBlockedSubstrings(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function assertPolicyValidity(policy: CredentialPolicy): void {
  if (!Number.isInteger(policy.minLength) || policy.minLength < 8) {
    throw new IdentityDomainError("Credential policy minLength must be an integer >= 8.");
  }
  if (!Number.isInteger(policy.maxLength) || policy.maxLength < policy.minLength) {
    throw new IdentityDomainError("Credential policy maxLength must be an integer >= minLength.");
  }
  if (!Number.isInteger(policy.minUniqueCharacters) || policy.minUniqueCharacters < 1) {
    throw new IdentityDomainError("Credential policy minUniqueCharacters must be >= 1.");
  }
  if (!Number.isInteger(policy.maxRepeatedCharacters) || policy.maxRepeatedCharacters < 1) {
    throw new IdentityDomainError("Credential policy maxRepeatedCharacters must be >= 1.");
  }
  if (!Number.isInteger(policy.minPasswordAgeDays) || policy.minPasswordAgeDays < 0) {
    throw new IdentityDomainError("Credential policy minPasswordAgeDays must be >= 0.");
  }
  if (!Number.isInteger(policy.maxPasswordAgeDays) || policy.maxPasswordAgeDays <= policy.minPasswordAgeDays) {
    throw new IdentityDomainError("Credential policy maxPasswordAgeDays must be greater than minPasswordAgeDays.");
  }
  if (!Number.isInteger(policy.passwordHistoryCount) || policy.passwordHistoryCount < 0) {
    throw new IdentityDomainError("Credential policy passwordHistoryCount must be >= 0.");
  }
  if (!Number.isInteger(policy.maxFailedAttempts) || policy.maxFailedAttempts < 1) {
    throw new IdentityDomainError("Credential policy maxFailedAttempts must be >= 1.");
  }
  if (!Number.isInteger(policy.lockoutDurationMinutes) || policy.lockoutDurationMinutes < 1) {
    throw new IdentityDomainError("Credential policy lockoutDurationMinutes must be >= 1.");
  }
}

export function createAuthProvider(input: {
  readonly id: string;
  readonly kind: AuthProviderKind;
  readonly category: AuthProviderCategory;
  readonly displayName: string;
  readonly isFirstParty?: boolean;
  readonly status?: AuthProviderStatus;
  readonly now?: Date;
}): AuthProvider {
  if (!Object.values(AuthProviderKinds).includes(input.kind)) {
    throw new IdentityDomainError(`Auth provider kind '${String(input.kind)}' is invalid.`);
  }
  if (!Object.values(AuthProviderCategories).includes(input.category)) {
    throw new IdentityDomainError(`Auth provider category '${String(input.category)}' is invalid.`);
  }

  const status = input.status ?? AuthProviderStatuses.active;
  if (!Object.values(AuthProviderStatuses).includes(status)) {
    throw new IdentityDomainError(`Auth provider status '${String(input.status)}' is invalid.`);
  }

  const now = (input.now ?? new Date()).toISOString();
  return Object.freeze({
    id: normalizeRequired(input.id, "Auth provider id"),
    kind: input.kind,
    category: input.category,
    displayName: normalizeRequired(input.displayName, "Auth provider display name"),
    isFirstParty: input.isFirstParty ?? true,
    status,
    createdAt: now,
    updatedAt: now,
  });
}

export function createCredentialPolicy(input: {
  readonly id: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly requireLowercase?: boolean;
  readonly requireUppercase?: boolean;
  readonly requireNumber?: boolean;
  readonly requireSymbol?: boolean;
  readonly minUniqueCharacters?: number;
  readonly maxRepeatedCharacters?: number;
  readonly blockedSubstrings?: ReadonlyArray<string>;
  readonly minPasswordAgeDays?: number;
  readonly maxPasswordAgeDays?: number;
  readonly passwordHistoryCount?: number;
  readonly maxFailedAttempts?: number;
  readonly lockoutDurationMinutes?: number;
}): CredentialPolicy {
  const policy: CredentialPolicy = Object.freeze({
    id: normalizeRequired(input.id, "Credential policy id"),
    minLength: input.minLength ?? 12,
    maxLength: input.maxLength ?? 128,
    requireLowercase: input.requireLowercase ?? true,
    requireUppercase: input.requireUppercase ?? true,
    requireNumber: input.requireNumber ?? true,
    requireSymbol: input.requireSymbol ?? true,
    minUniqueCharacters: input.minUniqueCharacters ?? 6,
    maxRepeatedCharacters: input.maxRepeatedCharacters ?? 3,
    blockedSubstrings: normalizeBlockedSubstrings(input.blockedSubstrings),
    minPasswordAgeDays: input.minPasswordAgeDays ?? 0,
    maxPasswordAgeDays: input.maxPasswordAgeDays ?? 365,
    passwordHistoryCount: input.passwordHistoryCount ?? 10,
    maxFailedAttempts: input.maxFailedAttempts ?? 5,
    lockoutDurationMinutes: input.lockoutDurationMinutes ?? 15,
  });

  assertPolicyValidity(policy);
  return policy;
}

export function validateCredentialCandidate(policy: CredentialPolicy, candidate: string): CredentialPolicyValidationResult {
  const password = candidate;
  const issues: CredentialPolicyValidationIssue[] = [];

  if (password.length < policy.minLength || password.length > policy.maxLength) {
    issues.push({ code: "length", message: `Credential length must be between ${policy.minLength} and ${policy.maxLength} characters.` });
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    issues.push({ code: "lowercase", message: "Credential must include at least one lowercase letter." });
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push({ code: "uppercase", message: "Credential must include at least one uppercase letter." });
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    issues.push({ code: "number", message: "Credential must include at least one number." });
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    issues.push({ code: "symbol", message: "Credential must include at least one symbol." });
  }

  const uniqueCount = new Set(password.split("")).size;
  if (uniqueCount < policy.minUniqueCharacters) {
    issues.push({ code: "unique", message: `Credential must include at least ${policy.minUniqueCharacters} unique characters.` });
  }

  const maxRepeat = password.split("").reduce((state, character) => {
    if (state.last === character) {
      return { last: character, runLength: state.runLength + 1, max: Math.max(state.max, state.runLength + 1) };
    }
    return { last: character, runLength: 1, max: state.max };
  }, { last: "", runLength: 0, max: 0 }).max;

  if (maxRepeat > policy.maxRepeatedCharacters) {
    issues.push({ code: "repeat", message: `Credential cannot repeat the same character more than ${policy.maxRepeatedCharacters} times consecutively.` });
  }

  const lowered = password.toLowerCase();
  for (const blockedSubstring of policy.blockedSubstrings) {
    if (lowered.includes(blockedSubstring)) {
      issues.push({ code: "blocked-substring", message: `Credential cannot contain blocked substring '${blockedSubstring}'.` });
    }
  }

  return Object.freeze({
    isValid: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

export function createLocalCredentialState(input: {
  readonly policy: CredentialPolicy;
  readonly passwordChangedAt?: Date;
}): CredentialState {
  return normalizeCredentialState({
    status: CredentialStatuses.active,
    policyId: input.policy.id,
    failedAttempts: 0,
    passwordChangedAt: input.passwordChangedAt ?? new Date(),
  });
}

export function recordCredentialFailure(
  credential: CredentialState,
  policy: CredentialPolicy,
  now: Date = new Date(),
): CredentialState {
  if (credential.policyId !== policy.id) {
    throw new IdentityDomainError("Credential policy mismatch.");
  }
  if (credential.status === CredentialStatuses.disabled || credential.status === CredentialStatuses.compromised) {
    throw new IdentityDomainError(`Credential status '${credential.status}' does not allow authentication attempts.`);
  }

  const failedAttempts = credential.failedAttempts + 1;
  const shouldLock = failedAttempts >= policy.maxFailedAttempts;

  return normalizeCredentialState({
    ...credential,
    status: shouldLock ? CredentialStatuses.locked : credential.status,
    failedAttempts,
    lockoutUntil: shouldLock ? new Date(now.getTime() + policy.lockoutDurationMinutes * 60_000).toISOString() : credential.lockoutUntil,
  });
}

export function clearCredentialFailures(credential: CredentialState): CredentialState {
  return normalizeCredentialState({
    ...credential,
    status: credential.status === CredentialStatuses.locked ? CredentialStatuses.active : credential.status,
    failedAttempts: 0,
    lockoutUntil: undefined,
  });
}

export function requireCredentialReset(credential: CredentialState, now: Date = new Date()): CredentialState {
  return normalizeCredentialState({
    ...credential,
    status: CredentialStatuses.resetRequired,
    resetRequiredAt: now,
  });
}

export function markCredentialCompromised(credential: CredentialState, now: Date = new Date()): CredentialState {
  return normalizeCredentialState({
    ...credential,
    status: CredentialStatuses.compromised,
    compromisedAt: now,
  });
}

export function disableCredential(credential: CredentialState, now: Date = new Date()): CredentialState {
  return normalizeCredentialState({
    ...credential,
    status: CredentialStatuses.disabled,
    disabledAt: now,
  });
}

export function createUserIdentity(input: {
  readonly id: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly status?: UserIdentityStatus;
  readonly linkedProviders: ReadonlyArray<UserIdentityProviderLink>;
  readonly now?: Date;
}): UserIdentity {
  const status = normalizeUserIdentityStatus(input.status);
  const linkedProviders = normalizeProviderLinks(input.linkedProviders);
  const now = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id: normalizeRequired(input.id, "User identity id"),
    username: normalizeRequired(input.username, "User identity username").toLowerCase(),
    email: normalizeEmail(input.email),
    displayName: normalizeOptional(input.displayName),
    status,
    linkedProviders,
    createdAt: now,
    updatedAt: now,
    activatedAt: status === UserIdentityStatuses.active ? now : undefined,
    suspendedAt: status === UserIdentityStatuses.suspended ? now : undefined,
    lockedAt: status === UserIdentityStatuses.locked ? now : undefined,
    deactivatedAt: status === UserIdentityStatuses.deactivated ? now : undefined,
  });
}

export function transitionUserIdentityStatus(
  identity: UserIdentity,
  nextStatus: UserIdentityStatus,
  now: Date = new Date(),
): UserIdentity {
  assertIdentityTransitionAllowed(identity.status, nextStatus);
  if (identity.status === nextStatus) {
    return identity;
  }

  const nowIso = now.toISOString();
  return Object.freeze({
    ...identity,
    status: nextStatus,
    updatedAt: nowIso,
    activatedAt: nextStatus === UserIdentityStatuses.active ? nowIso : identity.activatedAt,
    suspendedAt: nextStatus === UserIdentityStatuses.suspended ? nowIso : identity.suspendedAt,
    lockedAt: nextStatus === UserIdentityStatuses.locked ? nowIso : identity.lockedAt,
    deactivatedAt: nextStatus === UserIdentityStatuses.deactivated ? nowIso : identity.deactivatedAt,
  });
}

export function withUserIdentityProviderCredentialState(
  identity: UserIdentity,
  providerId: string,
  providerSubject: string,
  credentialState: CredentialState,
  now: Date = new Date(),
): UserIdentity {
  const providerIdValue = normalizeRequired(providerId, "Provider id");
  const providerSubjectValue = normalizeRequired(providerSubject, "Provider subject");
  let matched = false;

  const linkedProviders = identity.linkedProviders.map((link) => {
    if (link.providerId === providerIdValue && link.providerSubject === providerSubjectValue) {
      matched = true;
      return Object.freeze({
        ...link,
        credentialState,
      });
    }
    return link;
  });

  if (!matched) {
    throw new IdentityDomainError(`Provider link '${providerIdValue}|${providerSubjectValue}' is not attached to user identity '${identity.id}'.`);
  }

  return Object.freeze({
    ...identity,
    linkedProviders: Object.freeze(linkedProviders),
    updatedAt: now.toISOString(),
  });
}

export function createSession(input: {
  readonly id: string;
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly issuedAt?: Date;
  readonly expiresAt: Date;
  readonly client?: SessionClientContext;
}): Session {
  const status = normalizeSessionStatus(IdentitySessionStatuses.active);
  const issuedAtDate = input.issuedAt ?? new Date();
  const issuedAt = issuedAtDate.toISOString();
  const expiresAt = input.expiresAt.toISOString();

  if (new Date(expiresAt).getTime() <= issuedAtDate.getTime()) {
    throw new IdentityDomainError("Session expiresAt must be later than issuedAt.");
  }

  return Object.freeze({
    id: normalizeRequired(input.id, "Session id"),
    userIdentityId: normalizeRequired(input.userIdentityId, "Session userIdentityId"),
    providerId: normalizeRequired(input.providerId, "Session providerId"),
    providerSubject: normalizeRequired(input.providerSubject, "Session providerSubject"),
    status,
    issuedAt,
    expiresAt,
    rotatedAt: undefined,
    replacedBySessionId: undefined,
    revocation: undefined,
    client: input.client ? Object.freeze({
      userAgent: normalizeOptional(input.client.userAgent),
      ipAddress: normalizeOptional(input.client.ipAddress),
      deviceId: normalizeOptional(input.client.deviceId),
    }) : undefined,
  });
}

export function rotateSession(session: Session, replacementSessionId: string, now: Date = new Date()): Session {
  assertSessionTransitionAllowed(session.status, IdentitySessionStatuses.rotated);
  const rotatedAt = now.toISOString();

  return Object.freeze({
    ...session,
    status: IdentitySessionStatuses.rotated,
    rotatedAt,
    replacedBySessionId: normalizeRequired(replacementSessionId, "Session replacementSessionId"),
    revocation: Object.freeze({ reason: "rotation", revokedAt: rotatedAt }),
  });
}

export function revokeSession(
  session: Session,
  reason: SessionRevocation["reason"],
  now: Date = new Date(),
): Session {
  assertSessionTransitionAllowed(session.status, IdentitySessionStatuses.revoked);
  const revokedAt = now.toISOString();
  return Object.freeze({
    ...session,
    status: IdentitySessionStatuses.revoked,
    revocation: Object.freeze({ reason, revokedAt }),
  });
}

export function expireSession(session: Session, now: Date = new Date()): Session {
  assertSessionTransitionAllowed(session.status, IdentitySessionStatuses.expired);

  if (now.getTime() < new Date(session.expiresAt).getTime()) {
    throw new IdentityDomainError("Session cannot be expired before expiresAt.");
  }

  return Object.freeze({
    ...session,
    status: IdentitySessionStatuses.expired,
  });
}
