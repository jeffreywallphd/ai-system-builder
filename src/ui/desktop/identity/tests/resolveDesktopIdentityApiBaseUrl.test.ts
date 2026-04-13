import { describe, expect, it } from "bun:test";
import { resolveDesktopIdentityApiBaseUrl } from "../resolveDesktopIdentityApiBaseUrl";

describe("resolveDesktopIdentityApiBaseUrl", () => {
  it("returns undefined when desktop bootstrap transport is unavailable", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {} as Window;
    expect(resolveDesktopIdentityApiBaseUrl()).toBeUndefined();
  });

  it("resolves loopback endpoint from desktop bootstrap config", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {
      aiLoomDesktop: {
        bootstrap: {
          runtimeConfig: {
            controlPlaneBaseUrl: "http://127.0.0.1:8788/",
          },
        },
      },
    } as unknown as Window;

    expect(resolveDesktopIdentityApiBaseUrl()).toBe("http://127.0.0.1:8788");
  });

  it("prefers explicit control-plane bridge base URL when available", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {
      aiLoomDesktop: {
        auth: {
          controlPlane: {
            baseUrl: "http://127.0.0.1:9001/",
          },
        },
        bootstrap: {
          runtimeConfig: {
            controlPlaneBaseUrl: "http://127.0.0.1:8788/",
          },
        },
      },
    } as unknown as Window;

    expect(resolveDesktopIdentityApiBaseUrl()).toBe("http://127.0.0.1:9001");
  });

  it("falls back to legacy identityApiBaseUrl when control-plane field is absent", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {
      aiLoomDesktop: {
        bootstrap: {
          runtimeConfig: {
            identityApiBaseUrl: "http://127.0.0.1:8788/",
          },
        },
      },
    } as unknown as Window;

    expect(resolveDesktopIdentityApiBaseUrl()).toBe("http://127.0.0.1:8788");
  });
});
