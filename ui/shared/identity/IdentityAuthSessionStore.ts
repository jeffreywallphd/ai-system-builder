import type { LoginLocalIdentityApiResponse } from "../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

const IdentitySessionStorageKey = "ai-loom.identity.session.v1";

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

  public getSession(): LoginLocalIdentityApiResponse | undefined {
    const storage = resolveStorage();
    if (!storage) {
      return undefined;
    }

    const raw = storage.getItem(IdentitySessionStorageKey);
    if (!raw) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(raw) as LoginLocalIdentityApiResponse;
      if (!parsed.sessionToken || !parsed.sessionExpiresAt) {
        storage.removeItem(IdentitySessionStorageKey);
        return undefined;
      }
      return parsed;
    } catch {
      storage.removeItem(IdentitySessionStorageKey);
      return undefined;
    }
  }

  public saveSession(session: LoginLocalIdentityApiResponse): void {
    const storage = resolveStorage();
    if (!storage) {
      return;
    }
    storage.setItem(IdentitySessionStorageKey, JSON.stringify(session));
  }

  public clearSession(): void {
    const storage = resolveStorage();
    if (!storage) {
      return;
    }
    storage.removeItem(IdentitySessionStorageKey);
  }

  public isSessionExpired(
    session: Pick<LoginLocalIdentityApiResponse, "sessionExpiresAt">,
    at: Date = new Date(),
  ): boolean {
    const expiresAt = Date.parse(session.sessionExpiresAt);
    if (!Number.isFinite(expiresAt)) {
      return true;
    }
    return expiresAt <= at.getTime();
  }
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
