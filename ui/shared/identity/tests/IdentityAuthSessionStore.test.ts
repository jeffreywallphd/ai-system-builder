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
      displayName: "Alice",
      providerId: "provider:local-password",
      sessionId: "identity-session:1",
      sessionToken: "token-1",
      sessionTokenType: "Bearer",
      sessionIssuedAt: "2026-04-04T20:00:00.000Z",
      sessionExpiresAt: "2026-04-05T20:00:00.000Z",
    });

    expect(store.hasSession()).toBeTrue();
    expect(store.getSession()?.username).toBe("alice");
    const serialized = backing.values().next().value as string;
    expect(serialized.includes("providerSubject")).toBeFalse();
    expect(serialized.includes("sessionTrustMarker")).toBeFalse();
    expect(serialized.includes("\"email\"")).toBeFalse();

    store.clearSession();
    expect(store.hasSession()).toBeFalse();
  });

  it("prefers desktop storage bridge when available", () => {
    const desktopBacking = new Map<string, string>();
    const localBacking = new Map<string, string>();
    (globalThis as typeof globalThis & { window?: Window }).window = {
      aiLoomDesktop: {
        storage: {
          getItem: (key: string) => desktopBacking.get(key) ?? null,
          setItem: (key: string, value: string) => { desktopBacking.set(key, value); },
          removeItem: (key: string) => { desktopBacking.delete(key); },
        },
      },
      localStorage: {
        getItem: (key: string) => localBacking.get(key) ?? null,
        setItem: (key: string, value: string) => { localBacking.set(key, value); },
        removeItem: (key: string) => { localBacking.delete(key); },
      },
    } as unknown as Window;

    const store = new IdentityAuthSessionStore();
    store.saveSession({
      userIdentityId: "user-2",
      username: "desktop-user",
      providerId: "provider:local-password",
      sessionId: "identity-session:2",
      sessionToken: "token-2",
      sessionTokenType: "Bearer",
      sessionIssuedAt: "2026-04-04T20:00:00.000Z",
      sessionExpiresAt: "2026-04-05T20:00:00.000Z",
    });

    expect(desktopBacking.size).toBe(1);
    expect(localBacking.size).toBe(0);
  });

  it("reports active sessions based on session expiry", () => {
    const backing = new Map<string, string>();
    (globalThis as typeof globalThis & { window?: Window }).window = {
      localStorage: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => { backing.set(key, value); },
        removeItem: (key: string) => { backing.delete(key); },
      },
    } as unknown as Window;

    const store = new IdentityAuthSessionStore();
    store.saveSession({
      userIdentityId: "user-3",
      username: "bob",
      providerId: "provider:local-password",
      sessionId: "identity-session:3",
      sessionToken: "token-3",
      sessionTokenType: "Bearer",
      sessionIssuedAt: "2026-04-04T20:00:00.000Z",
      sessionExpiresAt: "2026-04-04T20:30:00.000Z",
    });

    expect(store.hasActiveSession(new Date("2026-04-04T20:15:00.000Z"))).toBeTrue();
    expect(store.hasActiveSession(new Date("2026-04-04T20:30:00.000Z"))).toBeFalse();
  });
});
