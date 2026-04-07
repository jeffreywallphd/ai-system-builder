import type { LoginLocalIdentityApiResponse } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

const IdentitySessionStorageKey = "ai-loom.identity.session.v1";

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

  const desktopStorage = window.aiLoomDesktop?.storage;
  if (desktopStorage) {
    return desktopStorage;
  }

  return window.localStorage;
}

