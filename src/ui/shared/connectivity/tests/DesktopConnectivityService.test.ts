import { describe, expect, it } from "bun:test";
import { DesktopConnectivityService } from "../DesktopConnectivityService";

describe("DesktopConnectivityService", () => {
  it("reads and parses desktop connectivity state from bridge payloads", async () => {
    const service = new DesktopConnectivityService();
    const state = await service.getConnectivityState({
      connectivity: {
        async getConnectivityState() {
          return JSON.stringify({
            state: "connected",
            stale: false,
            localModeActive: false,
            reasonCode: "online",
            lastChangedAt: "2026-04-07T12:00:00.000Z",
            canQueueOperations: true,
            canResynchronize: true,
          });
        },
        async setOfflineMode() {
          return "";
        },
      },
    });

    expect(state?.state).toBe("connected");
    expect(state?.reasonCode).toBe("online");
  });

  it("sets deliberate offline mode through desktop bridge", async () => {
    const service = new DesktopConnectivityService();
    const state = await service.setOfflineMode({ active: true, detail: "manual" }, {
      connectivity: {
        async getConnectivityState() {
          return "";
        },
        async setOfflineMode(requestJson: string) {
          const request = JSON.parse(requestJson) as { readonly active: boolean; readonly detail?: string };
          expect(request.active).toBeTrue();
          expect(request.detail).toBe("manual");
          return JSON.stringify({
            state: "disconnected",
            stale: true,
            localModeActive: true,
            reasonCode: "offline-mode-deliberate",
            offlineModeIntent: "deliberate",
            lastChangedAt: "2026-04-07T12:00:00.000Z",
            canQueueOperations: true,
            canResynchronize: false,
          });
        },
      },
    });

    expect(state?.state).toBe("disconnected");
    expect(state?.offlineModeIntent).toBe("deliberate");
  });
});
