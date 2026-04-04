import { describe, expect, it } from "bun:test";
import { IdentityAuthSessionStore } from "../IdentityAuthSessionStore";

describe("IdentityAuthSessionStore", () => {
  it("stores and clears local identity session payloads", () => {
    const backing = new Map<string, string>();
    (globalThis as typeof globalThis & { window?: Window }).window = {
      localStorage: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => { backing.set(key, value); },
        removeItem: (key: string) => { backing.delete(key); },
      },
    } as unknown as Window;

    const store = new IdentityAuthSessionStore();
    store.clearSession();

    store.saveSession({
      userIdentityId: "user-1",
      username: "alice",
      providerId: "provider:local-password",
      providerSubject: "alice",
      authPath: "password",
      authenticatedAt: "2026-04-04T20:00:00.000Z",
    });

    expect(store.hasSession()).toBeTrue();
    expect(store.getSession()?.username).toBe("alice");

    store.clearSession();
    expect(store.hasSession()).toBeFalse();
  });
});
