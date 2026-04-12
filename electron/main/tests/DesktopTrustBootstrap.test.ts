import { describe, expect, it } from "bun:test";
import {
  createDesktopConnectivityProbePort,
  resolveDesktopIdentityTransportTrustBootstrap,
} from "../DesktopTrustBootstrap";

const DESKTOP_TRUST_STORAGE_KEYS = Object.freeze({
  trustedDeviceBindingId: "identity.desktop.transport.trusted-device-binding-id",
  pinReference: "identity.desktop.transport.pin-reference",
  expiresAt: "identity.desktop.transport.expires-at",
});

describe("DesktopTrustBootstrap", () => {
  it("surfaces explicit trusted-device bootstrap failure detail when binding id is missing", async () => {
    const storage = new Map<string, string>([
      [DESKTOP_TRUST_STORAGE_KEYS.pinReference, "pin:alpha"],
    ]);
    stubSuccessfulFetch();

    const probe = createDesktopConnectivityProbePort("http://127.0.0.1:8788", (key) => storage.get(key) ?? null);
    const state = await probe.probe();

    expect(state.trustEnforcement).toBe("required");
    expect(state.trustPrerequisitesSatisfied).toBeFalse();
    expect(state.trustPrerequisitesDetail).toContain("Trusted-device binding ID is missing");
  });

  it("surfaces explicit trusted-device bootstrap failure detail when pin reference is missing", async () => {
    const storage = new Map<string, string>([
      [DESKTOP_TRUST_STORAGE_KEYS.trustedDeviceBindingId, "trusted-device:alpha"],
    ]);
    stubSuccessfulFetch();

    const probe = createDesktopConnectivityProbePort("http://127.0.0.1:8788", (key) => storage.get(key) ?? null);
    const state = await probe.probe();

    expect(state.trustEnforcement).toBe("required");
    expect(state.trustPrerequisitesSatisfied).toBeFalse();
    expect(state.trustPrerequisitesDetail).toContain("Pinned trust material reference is missing");
  });

  it("surfaces explicit trusted-device bootstrap failure detail when pin material is expired", async () => {
    const storage = new Map<string, string>([
      [DESKTOP_TRUST_STORAGE_KEYS.trustedDeviceBindingId, "trusted-device:alpha"],
      [DESKTOP_TRUST_STORAGE_KEYS.pinReference, "pin:alpha"],
      [DESKTOP_TRUST_STORAGE_KEYS.expiresAt, "2026-04-05T11:00:00.000Z"],
    ]);
    stubSuccessfulFetch();

    const probe = createDesktopConnectivityProbePort("http://127.0.0.1:8788", (key) => storage.get(key) ?? null);
    const state = await probe.probe();

    expect(state.trustEnforcement).toBe("required");
    expect(state.trustPrerequisitesSatisfied).toBeFalse();
    expect(state.trustPrerequisitesDetail).toContain("Pinned trust material expired at");
  });

  it("preserves required trusted bootstrap payload and reports satisfied prerequisites", async () => {
    const storage = new Map<string, string>([
      [DESKTOP_TRUST_STORAGE_KEYS.trustedDeviceBindingId, "trusted-device:alpha"],
      [DESKTOP_TRUST_STORAGE_KEYS.pinReference, "pin:alpha"],
      [DESKTOP_TRUST_STORAGE_KEYS.expiresAt, "2026-04-15T11:00:00.000Z"],
    ]);
    stubSuccessfulFetch();

    const bootstrap = resolveDesktopIdentityTransportTrustBootstrap((key) => storage.get(key) ?? null);
    expect(bootstrap?.enforcement).toBe("required");
    expect(bootstrap?.registeredDevice?.trustedDeviceBindingId).toBe("trusted-device:alpha");
    expect(bootstrap?.pinnedTrustMaterial?.pinReference).toBe("pin:alpha");

    const probe = createDesktopConnectivityProbePort("http://127.0.0.1:8788", (key) => storage.get(key) ?? null);
    const state = await probe.probe();
    expect(state.trustPrerequisitesSatisfied).toBeTrue();
    expect(state.trustPrerequisitesDetail).toBeUndefined();
  });
});

function stubSuccessfulFetch(): void {
  (globalThis as typeof globalThis & {
    fetch: (input: string, init?: RequestInit) => Promise<Response>;
  }).fetch = async () => new Response("", {
    status: 200,
  });
}
