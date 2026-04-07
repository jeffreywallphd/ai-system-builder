import { describe, expect, it } from "bun:test";
import { resolveWebIdentityApiBaseUrl } from "../resolveWebIdentityApiBaseUrl";

describe("resolveWebIdentityApiBaseUrl", () => {
  it("uses runtime config identity endpoint when injected by browser dev bootstrap", () => {
    (globalThis as typeof globalThis & { window?: Window & { aiLoomBrowserDevelopment?: { env?: Record<string, string | undefined> } } }).window = {
      location: {
        origin: "http://127.0.0.1:5174",
      },
      aiLoomBrowserDevelopment: {
        env: {
          VITE_IDENTITY_API_BASE_URL: "http://127.0.0.1:8788",
        },
      },
    } as Window & { aiLoomBrowserDevelopment?: { env?: Record<string, string | undefined> } };

    expect(resolveWebIdentityApiBaseUrl()).toBe("http://127.0.0.1:8788");
  });

  it("uses browser origin when available", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {
      location: {
        origin: "http://127.0.0.1:5174",
      },
    } as Window;

    expect(resolveWebIdentityApiBaseUrl()).toBe("http://127.0.0.1:5174");
  });

  it("rejects insecure non-loopback endpoints", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {
      location: {
        origin: "http://example.com:8788",
      },
    } as Window;

    expect(() => resolveWebIdentityApiBaseUrl()).toThrow("Insecure transport endpoint");
  });
});
