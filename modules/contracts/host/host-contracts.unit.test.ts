import { describe, expect, it } from "vitest";

import {
  createHostContext,
  createHostIdentity,
  isKnownHostKind,
  KNOWN_HOST_KINDS,
  resolveHostKind,
} from ".";

describe("host contracts", () => {
  it("exposes known host kinds while allowing future host kinds", () => {
    expect(KNOWN_HOST_KINDS).toEqual(["desktop", "server", "hybrid"]);
    expect(isKnownHostKind("desktop")).toBe(true);
    expect(isKnownHostKind("mobile")).toBe(false);
    expect(resolveHostKind(undefined)).toBe("desktop");
    expect(resolveHostKind(" SERVER ")).toBe("server");
    expect(resolveHostKind("mobile")).toBe("mobile");
  });

  it("creates a host identity with optional host instance identity", () => {
    const identity = createHostIdentity("server", { id: "server-east-1" });

    expect(identity).toEqual({
      kind: "server",
      id: "server-east-1",
    });
  });

  it("creates a host context with only host-neutral boundary metadata", () => {
    const context = createHostContext("desktop", {
      hostId: "desktop-main",
      requestId: "req-301",
      correlationId: "corr-301",
      metadata: {
        entryPoint: "desktop.ipc",
        surface: "ui",
      },
    });

    expect(context).toEqual({
      host: {
        kind: "desktop",
        id: "desktop-main",
      },
      requestId: "req-301",
      correlationId: "corr-301",
      metadata: {
        entryPoint: "desktop.ipc",
        surface: "ui",
      },
    });
  });
});
