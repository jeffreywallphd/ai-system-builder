import type { LoginLocalIdentityApiResponse } from "../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

const IdentitySessionStorageKey = "ai-loom.identity.session.v1";

export class IdentityAuthSessionStore {
  public hasSession(): boolean {
    return this.getSession() !== undefined;
  }

  public getSession(): LoginLocalIdentityApiResponse | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }

    const raw = window.localStorage.getItem(IdentitySessionStorageKey);
    if (!raw) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as LoginLocalIdentityApiResponse;
    } catch {
      window.localStorage.removeItem(IdentitySessionStorageKey);
      return undefined;
    }
  }

  public saveSession(session: LoginLocalIdentityApiResponse): void {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(IdentitySessionStorageKey, JSON.stringify(session));
  }

  public clearSession(): void {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(IdentitySessionStorageKey);
  }
}
