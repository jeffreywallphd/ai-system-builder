import type { LoginLocalIdentityApiResponse } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import type {
  ResolveSessionActorContextApiResponse,
  ResolveSessionActorWorkspaceContextApiRecord,
} from "@shared/contracts/identity/IdentityTransportContracts";

const IdentitySessionStorageKey = "ai-loom.identity.session.v1";

export interface IdentityAuthInitialCapabilityState {
  readonly workspaceId?: string;
  readonly effectiveRoles: ReadonlyArray<ResolveSessionActorWorkspaceContextApiRecord["effectiveRoles"][number]>;
  readonly canAdministrate: boolean;
  readonly isWorkspaceOwner: boolean;
}

export interface IdentityAuthWorkspaceContext {
  readonly requestedWorkspaceId?: string;
  readonly resolvedWorkspaceId?: string;
  readonly workspaces: ReadonlyArray<ResolveSessionActorWorkspaceContextApiRecord>;
}

export interface IdentityAuthPersistedSession {
  readonly userIdentityId: string;
  readonly username: string;
  readonly displayName?: string;
  readonly providerId: string;
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly sessionTokenType: "Bearer";
  readonly sessionIssuedAt: string;
  readonly sessionExpiresAt: string;
  readonly sessionAccessChannel?: "desktop" | "thin-client";
  readonly sessionAssuranceLevel?: ResolveSessionActorContextApiResponse["session"]["assuranceLevel"];
  readonly sessionTrustState?: ResolveSessionActorContextApiResponse["session"]["trustState"];
  readonly sessionTrustedDeviceId?: string;
  readonly sessionTrustEvaluatedAt?: string;
  readonly sessionTrustInvalidationReasons?: ReadonlyArray<
    NonNullable<ResolveSessionActorContextApiResponse["session"]["trustInvalidationReasons"]>[number]
  >;
  readonly trustedDeviceDisplayName?: string;
  readonly workspaceContext?: IdentityAuthWorkspaceContext;
  readonly initialCapabilityState?: IdentityAuthInitialCapabilityState;
}

export class IdentityAuthSessionStore {
  public hasSession(): boolean {
    return this.getSession() !== undefined;
  }

  public hasActiveSession(at: Date = new Date()): boolean {
    const session = this.getSession();
    if (!session) {
      return false;
    }
    return !this.isSessionExpired(session, at);
  }

  public getSession(): IdentityAuthPersistedSession | undefined {
    const storage = resolveStorage();
    if (!storage) {
      return undefined;
    }

    const raw = storage.getItem(IdentitySessionStorageKey);
    if (!raw) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<IdentityAuthPersistedSession>;
      if (!parsed.sessionToken || !parsed.sessionExpiresAt) {
        storage.removeItem(IdentitySessionStorageKey);
        return undefined;
      }
      if (!parsed.userIdentityId || !parsed.username || !parsed.providerId || !parsed.sessionId || !parsed.sessionIssuedAt) {
        storage.removeItem(IdentitySessionStorageKey);
        return undefined;
      }

      return Object.freeze({
        userIdentityId: parsed.userIdentityId,
        username: parsed.username,
        displayName: parsed.displayName,
        providerId: parsed.providerId,
        sessionId: parsed.sessionId,
        sessionToken: parsed.sessionToken,
        sessionTokenType: parsed.sessionTokenType === "Bearer" ? "Bearer" : "Bearer",
        sessionIssuedAt: parsed.sessionIssuedAt,
        sessionExpiresAt: parsed.sessionExpiresAt,
        sessionAccessChannel: parsed.sessionAccessChannel,
        sessionAssuranceLevel: normalizeOptionalStringUnion(parsed.sessionAssuranceLevel, [
          "authenticated-untrusted",
          "authenticated-restricted",
          "authenticated-trusted",
        ]),
        sessionTrustState: normalizeOptionalStringUnion(parsed.sessionTrustState, [
          "unknown",
          "untrusted",
          "trusted",
          "pending-pairing",
          "revoked",
          "expired",
        ]),
        sessionTrustedDeviceId: normalizeOptionalString(parsed.sessionTrustedDeviceId),
        sessionTrustEvaluatedAt: normalizeOptionalString(parsed.sessionTrustEvaluatedAt),
        sessionTrustInvalidationReasons: normalizeTrustInvalidationReasons(parsed.sessionTrustInvalidationReasons),
        trustedDeviceDisplayName: normalizeOptionalString(parsed.trustedDeviceDisplayName),
        workspaceContext: normalizeWorkspaceContext(parsed.workspaceContext),
        initialCapabilityState: normalizeInitialCapabilityState(parsed.initialCapabilityState),
      });
    } catch {
      storage.removeItem(IdentitySessionStorageKey);
      return undefined;
    }
  }

  public saveSession(session: LoginLocalIdentityApiResponse | IdentityAuthPersistedSession): void {
    const storage = resolveStorage();
    if (!storage) {
      return;
    }
    storage.setItem(IdentitySessionStorageKey, JSON.stringify(toPersistedIdentitySession(session)));
  }

  public clearSession(): void {
    const storage = resolveStorage();
    if (!storage) {
      return;
    }
    storage.removeItem(IdentitySessionStorageKey);
  }

  public isSessionExpired(
    session: Pick<IdentityAuthPersistedSession, "sessionExpiresAt">,
    at: Date = new Date(),
  ): boolean {
    const expiresAt = Date.parse(session.sessionExpiresAt);
    if (!Number.isFinite(expiresAt)) {
      return true;
    }
    return expiresAt <= at.getTime();
  }
}

export function toPersistedIdentitySession(
  session: LoginLocalIdentityApiResponse | IdentityAuthPersistedSession,
): IdentityAuthPersistedSession {
  if ("sessionToken" in session && !("providerSubject" in session)) {
    return Object.freeze({
      userIdentityId: session.userIdentityId,
      username: session.username,
      displayName: session.displayName,
      providerId: session.providerId,
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
      sessionTokenType: session.sessionTokenType,
      sessionIssuedAt: session.sessionIssuedAt,
      sessionExpiresAt: session.sessionExpiresAt,
      sessionAccessChannel: session.sessionAccessChannel,
      sessionAssuranceLevel: session.sessionAssuranceLevel,
      sessionTrustState: session.sessionTrustState,
      sessionTrustedDeviceId: session.sessionTrustedDeviceId,
      sessionTrustEvaluatedAt: session.sessionTrustEvaluatedAt,
      sessionTrustInvalidationReasons: session.sessionTrustInvalidationReasons,
      trustedDeviceDisplayName: session.trustedDeviceDisplayName,
      workspaceContext: session.workspaceContext,
      initialCapabilityState: session.initialCapabilityState,
    });
  }

  return Object.freeze({
    userIdentityId: session.userIdentityId,
    username: session.username,
    displayName: session.displayName,
    providerId: session.providerId,
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    sessionTokenType: session.sessionTokenType,
    sessionIssuedAt: session.sessionIssuedAt,
    sessionExpiresAt: session.sessionExpiresAt,
    sessionAccessChannel: session.sessionAccessChannel,
  });
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const desktopStorage = window.aiLoomDesktop?.auth?.storage ?? window.aiLoomDesktop?.storage;
  if (desktopStorage) {
    return desktopStorage;
  }

  return window.localStorage;
}

function normalizeWorkspaceContext(value: unknown): IdentityAuthWorkspaceContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const workspaces = Array.isArray(value.workspaces)
    ? value.workspaces
      .map((entry) => normalizeWorkspaceRecord(entry))
      .filter((entry): entry is ResolveSessionActorWorkspaceContextApiRecord => entry !== undefined)
    : [];

  return Object.freeze({
    requestedWorkspaceId: normalizeOptionalString(value.requestedWorkspaceId),
    resolvedWorkspaceId: normalizeOptionalString(value.resolvedWorkspaceId),
    workspaces: Object.freeze(workspaces),
  });
}

function normalizeWorkspaceRecord(value: unknown): ResolveSessionActorWorkspaceContextApiRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const workspaceId = normalizeOptionalString(value.workspaceId);
  const slug = normalizeOptionalString(value.slug);
  const displayName = normalizeOptionalString(value.displayName);
  const status = normalizeOptionalStringUnion(value.status, ["active", "suspended", "archived"]);
  const visibility = normalizeOptionalStringUnion(value.visibility, ["private", "workspace", "public"]);
  if (!workspaceId || !slug || !displayName || !status || !visibility) {
    return undefined;
  }

  const effectiveRoles = Array.isArray(value.effectiveRoles)
    ? value.effectiveRoles
      .map((entry) => normalizeOptionalStringUnion(entry, ["owner", "admin", "member", "viewer"]))
      .filter((entry): entry is "owner" | "admin" | "member" | "viewer" => entry !== undefined)
    : [];

  return Object.freeze({
    workspaceId,
    slug,
    displayName,
    status,
    visibility,
    membershipStatus: normalizeOptionalStringUnion(value.membershipStatus, ["invited", "active", "suspended", "removed"]),
    effectiveRoles: Object.freeze(effectiveRoles),
    canAdministrate: value.canAdministrate === true,
    isWorkspaceOwner: value.isWorkspaceOwner === true,
  });
}

function normalizeInitialCapabilityState(value: unknown): IdentityAuthInitialCapabilityState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const effectiveRoles = Array.isArray(value.effectiveRoles)
    ? value.effectiveRoles
      .map((entry) => normalizeOptionalStringUnion(entry, ["owner", "admin", "member", "viewer"]))
      .filter((entry): entry is "owner" | "admin" | "member" | "viewer" => entry !== undefined)
    : [];

  return Object.freeze({
    workspaceId: normalizeOptionalString(value.workspaceId),
    effectiveRoles: Object.freeze(effectiveRoles),
    canAdministrate: value.canAdministrate === true,
    isWorkspaceOwner: value.isWorkspaceOwner === true,
  });
}

function normalizeTrustInvalidationReasons(value: unknown): IdentityAuthPersistedSession["sessionTrustInvalidationReasons"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeOptionalStringUnion(entry, [
      "trusted-device-revoked",
      "trusted-device-trust-lost",
      "trusted-device-expired",
      "trusted-device-mismatch",
    ]))
    .filter((entry): entry is NonNullable<IdentityAuthPersistedSession["sessionTrustInvalidationReasons"]>[number] => entry !== undefined);

  return Object.freeze(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalStringUnion<TValue extends string>(
  value: unknown,
  allowed: ReadonlyArray<TValue>,
): TValue | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  return allowed.includes(normalized as TValue) ? normalized as TValue : undefined;
}
