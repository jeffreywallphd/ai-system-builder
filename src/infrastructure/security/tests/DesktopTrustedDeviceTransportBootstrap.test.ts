import { describe, expect, it } from "bun:test";
import type { DesktopAuthBootstrapContext } from "../../../../electron/shared/DesktopContracts";
import {
  DesktopTrustedDeviceBootstrapFailureReasons,
  resolveDesktopTrustedDeviceTransportBootstrap,
  type IDesktopTrustedDeviceBootstrapClockPort,
  type IDesktopTrustedDeviceBootstrapPort,
} from "../DesktopTrustedDeviceTransportBootstrap";

describe("resolveDesktopTrustedDeviceTransportBootstrap", () => {
  const fixedClock: IDesktopTrustedDeviceBootstrapClockPort = Object.freeze({
    now: () => new Date("2026-04-05T12:00:00.000Z"),
  });

  it("returns not-required when desktop trust bootstrap is unavailable", () => {
    const result = resolveDesktopTrustedDeviceTransportBootstrap({
      bootstrapPort: createBootstrapPort(undefined),
      clock: fixedClock,
    });
    expect(result).toEqual({ status: "not-required" });
  });

  it("fails when trust enforcement is required and registration is missing", () => {
    const result = resolveDesktopTrustedDeviceTransportBootstrap({
      bootstrapPort: createBootstrapPort({
        identityTransportTrust: {
          enforcement: "required",
          pinnedTrustMaterial: {
            pinReference: "pin:alpha",
            materialKind: "session-signing-key",
          },
        },
      }),
      clock: fixedClock,
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe(DesktopTrustedDeviceBootstrapFailureReasons.registrationMissing);
    }
  });

  it("fails when trust enforcement is required and pinned trust material is missing", () => {
    const result = resolveDesktopTrustedDeviceTransportBootstrap({
      bootstrapPort: createBootstrapPort({
        identityTransportTrust: {
          enforcement: "required",
          registeredDevice: {
            trustedDeviceBindingId: "trusted-device:alpha",
          },
        },
      }),
      clock: fixedClock,
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe(DesktopTrustedDeviceBootstrapFailureReasons.pinnedTrustMaterialMissing);
    }
  });

  it("fails when pinned trust material is expired", () => {
    const result = resolveDesktopTrustedDeviceTransportBootstrap({
      bootstrapPort: createBootstrapPort({
        identityTransportTrust: {
          enforcement: "required",
          registeredDevice: {
            trustedDeviceBindingId: "trusted-device:alpha",
          },
          pinnedTrustMaterial: {
            pinReference: "pin:alpha",
            materialKind: "session-signing-key",
            expiresAt: "2026-04-05T11:59:59.000Z",
          },
        },
      }),
      clock: fixedClock,
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe(DesktopTrustedDeviceBootstrapFailureReasons.pinnedTrustMaterialExpired);
    }
  });

  it("returns ready when registration and pinned trust material are valid", () => {
    const result = resolveDesktopTrustedDeviceTransportBootstrap({
      bootstrapPort: createBootstrapPort({
        identityTransportTrust: {
          enforcement: "required",
          registeredDevice: {
            trustedDeviceBindingId: "trusted-device:alpha",
            trustMarker: "marker:alpha",
          },
          pinnedTrustMaterial: {
            pinReference: "pin:alpha",
            materialKind: "session-signing-key",
            issuedAt: "2026-04-05T10:00:00.000Z",
            expiresAt: "2026-04-05T13:00:00.000Z",
          },
        },
      }),
      clock: fixedClock,
    });

    expect(result).toEqual({
      status: "ready",
      trustedDeviceBindingId: "trusted-device:alpha",
      trustMarker: "marker:alpha",
      pinnedTrustMaterial: {
        pinReference: "pin:alpha",
        materialKind: "session-signing-key",
        issuedAt: "2026-04-05T10:00:00.000Z",
        expiresAt: "2026-04-05T13:00:00.000Z",
        publicKeyFingerprint: undefined,
      },
    });
  });
});

function createBootstrapPort(
  bootstrap: Pick<DesktopAuthBootstrapContext, "identityTransportTrust"> | undefined,
): IDesktopTrustedDeviceBootstrapPort {
  return Object.freeze({
    getDesktopBootstrapContext: () => {
      if (!bootstrap) {
        return undefined;
      }
      return Object.freeze({
        runtimeConfig: {
          runtimeMode: "desktop-development",
          hostKind: "desktop",
          lifecycleStage: "development",
          distributionTarget: "electron",
          rendererDeliveryMode: "dev-server",
          workflowRepositoryMode: "filesystem-indexed",
          workflowExecutorMode: "strategy",
          nodeCatalogMode: "registered",
          uiSettingsPersistenceMode: "local-storage",
          installedModelCatalogMode: "browser-local-storage",
          seedStarterNode: true,
          isProductionMode: false,
          modelInstallDirectory: "dev/models",
        },
        ...bootstrap,
      });
    },
  });
}
