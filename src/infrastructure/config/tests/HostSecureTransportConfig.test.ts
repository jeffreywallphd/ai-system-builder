import { describe, expect, it } from "bun:test";
import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../HostSecureTransportConfig";

describe("HostSecureTransportConfig", () => {
  it("requires secure web endpoints outside loopback by default", () => {
    const config = resolveHostSecureTransportConfig({
      hostKind: HostSecureTransportKinds.web,
      hostAddress: "0.0.0.0",
    });

    expect(() => assertSecureTransportEndpoint("http://example.com:8788", config)).toThrow(
      "Insecure transport endpoint",
    );
    expect(assertSecureTransportEndpoint("https://example.com:8788", config)).toBe(
      "https://example.com:8788",
    );
  });

  it("allows desktop loopback HTTP endpoint defaults", () => {
    const config = resolveHostSecureTransportConfig({
      hostKind: HostSecureTransportKinds.desktop,
      hostAddress: "127.0.0.1",
    });

    expect(assertSecureTransportEndpoint("http://127.0.0.1:8788", config)).toBe("http://127.0.0.1:8788");
  });

  it("resolves server managed TLS state from environment", () => {
    const config = resolveHostSecureTransportConfig({
      hostKind: HostSecureTransportKinds.server,
      hostAddress: "127.0.0.1",
      env: {
        AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED: "true",
        AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID: "server:authoritative",
        AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF: "trust:server:key:v1",
      },
    });

    expect(config.trustMaterial.managedServerTlsEnabled).toBe(true);
    expect(config.requireSecureHttp).toBe(true);
    expect(config.requireSecureWebSocket).toBe(true);
    expect(config.trustMaterial.serverReferenceId).toBe("server:authoritative");
    expect(config.trustMaterial.privateKeyMaterialRef).toBe("trust:server:key:v1");
  });

  it("supports runtime contexts where process is unavailable", () => {
    const globalProcessOwner = globalThis as typeof globalThis & { process?: unknown };
    const previousProcess = globalProcessOwner.process;

    try {
      delete globalProcessOwner.process;
      const config = resolveHostSecureTransportConfig({
        hostKind: HostSecureTransportKinds.web,
      });

      expect(config.allowInsecureLoopback).toBe(false);
      expect(config.requireSecureHttp).toBe(true);
      expect(config.enforceTransportTrustValidation).toBe(true);
    } finally {
      globalProcessOwner.process = previousProcess;
    }
  });
});
