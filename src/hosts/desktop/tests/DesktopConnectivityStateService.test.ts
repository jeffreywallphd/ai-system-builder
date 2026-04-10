import { describe, expect, it } from "bun:test";
import {
  DesktopConnectivityReasonCodes,
  DesktopConnectivityStateService,
} from "../DesktopConnectivityStateService";
import {
  OfflineOperationalEventTypes,
  type IOfflineOperationalEventSink,
} from "@application/common/OfflineOperationalEventPorts";

class RecordingOfflineOperationalSink implements IOfflineOperationalEventSink {
  public readonly events: Array<Parameters<IOfflineOperationalEventSink["recordOfflineOperationalEvent"]>[0]> = [];

  public async recordOfflineOperationalEvent(
    event: Parameters<IOfflineOperationalEventSink["recordOfflineOperationalEvent"]>[0],
  ): Promise<void> {
    this.events.push(event);
  }
}

describe("DesktopConnectivityStateService", () => {
  it("starts and stops monitoring probes explicitly", async () => {
    const service = new DesktopConnectivityStateService();
    let probeCount = 0;
    const probePort = Object.freeze({
      probe: async () => {
        probeCount += 1;
        return Object.freeze({
          transportReachable: true,
          trustedSessionAvailable: true,
          trustPrerequisitesSatisfied: true,
          trustEnforcement: "optional" as const,
        });
      },
    });

    await waitForMs(25);
    expect(probeCount).toBe(0);

    service.startMonitoring(probePort, { intervalMs: 25 });
    await waitForCondition(() => probeCount >= 2);
    const countAtStop = probeCount;
    service.stopMonitoring();

    await waitForMs(80);
    expect(probeCount).toBe(countAtStop);
  });

  it("transitions to connected when transport/session/trust prerequisites are satisfied", () => {
    const service = new DesktopConnectivityStateService({
      now: () => new Date("2026-04-07T12:00:00.000Z"),
    });

    const state = service.observe({
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "required",
      observedAt: "2026-04-07T12:00:00.000Z",
    });

    expect(state.state).toBe("connected");
    expect(state.localModeActive).toBeFalse();
    expect(state.canResynchronize).toBeTrue();
    expect(state.reasonCode).toBe(DesktopConnectivityReasonCodes.online);
  });

  it("uses degraded when transport is up but trusted session is unavailable", () => {
    const service = new DesktopConnectivityStateService({
      now: () => new Date("2026-04-07T12:00:00.000Z"),
    });

    const state = service.observe({
      transportReachable: true,
      trustedSessionAvailable: false,
      trustedSessionDetail: "Session expired while disconnected.",
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "required",
      observedAt: "2026-04-07T12:00:00.000Z",
    });

    expect(state.state).toBe("degraded");
    expect(state.localModeActive).toBeTrue();
    expect(state.canResynchronize).toBeFalse();
    expect(state.reasonCode).toBe(DesktopConnectivityReasonCodes.trustedSessionUnavailable);
    expect(state.detail).toContain("Session expired");
  });

  it("uses reconnecting for transient transport failures", () => {
    const service = new DesktopConnectivityStateService({
      now: () => new Date("2026-04-07T12:00:00.000Z"),
    });

    service.observe({
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "optional",
      observedAt: "2026-04-07T12:00:00.000Z",
    });

    const state = service.observe({
      transportReachable: false,
      transportTransientFailure: true,
      transportDetail: "Connection reset.",
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "optional",
      observedAt: "2026-04-07T12:00:03.000Z",
    });

    expect(state.state).toBe("reconnecting");
    expect(state.localModeActive).toBeTrue();
    expect(state.canResynchronize).toBeTrue();
    expect(state.reasonCode).toBe(DesktopConnectivityReasonCodes.transportTransientFailure);
  });

  it("distinguishes deliberate offline mode from transport failures", () => {
    const sink = new RecordingOfflineOperationalSink();
    const service = new DesktopConnectivityStateService({
      now: () => new Date("2026-04-07T12:00:00.000Z"),
      eventSink: sink,
      eventContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    service.observe({
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "optional",
      observedAt: "2026-04-07T12:00:00.000Z",
    });

    const forcedOffline = service.setDeliberateOfflineMode(true, "User enabled offline mode.");
    expect(forcedOffline.state).toBe("disconnected");
    expect(forcedOffline.reasonCode).toBe(DesktopConnectivityReasonCodes.deliberateOfflineMode);
    expect(forcedOffline.offlineModeIntent).toBe("deliberate");

    const observedWhileForced = service.observe({
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "optional",
      observedAt: "2026-04-07T12:00:02.000Z",
    });
    expect(observedWhileForced.state).toBe("disconnected");
    expect(observedWhileForced.reasonCode).toBe(DesktopConnectivityReasonCodes.deliberateOfflineMode);

    service.setDeliberateOfflineMode(false);
    const recovered = service.observe({
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: "optional",
      observedAt: "2026-04-07T12:00:04.000Z",
    });
    expect(recovered.state).toBe("connected");
    expect(sink.events.map((event) => event.type)).toEqual([
      OfflineOperationalEventTypes.offlineEntered,
      OfflineOperationalEventTypes.offlineExited,
    ]);
    expect(sink.events[0]).toMatchObject({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      classification: "operational-diagnostic",
      correlationId: expect.stringContaining("offline-connectivity:"),
      diagnostics: {
        trustEnforcement: "optional",
      },
    });
  });
});

function waitForMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(check: () => boolean, timeoutMs = 400, stepMs = 20): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) {
      return;
    }
    await waitForMs(stepMs);
  }
  throw new Error("Timed out waiting for expected condition.");
}
