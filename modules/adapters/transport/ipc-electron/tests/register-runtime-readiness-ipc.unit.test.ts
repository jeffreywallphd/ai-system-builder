import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_REQUEST_CHANNEL,
  DESKTOP_RUNTIME_READINESS_READ_REQUEST_CHANNEL,
  createDesktopRuntimeCapabilityStatusReadRequest,
  createDesktopRuntimeReadinessReadRequest,
} from "../../../../contracts/ipc";
import { createRuntimeCapabilityStatus } from "../../../../contracts/runtime";
import type { RuntimeReadinessPort } from "../../../../application/ports/runtime";
import {
  createDesktopRuntimeCapabilityStatusReadIpcHandler,
  createDesktopRuntimeReadinessReadIpcHandler,
  registerRuntimeReadinessIpc,
} from "../runtime-readiness/registerRuntimeReadinessIpc";

function createRuntimeReadiness(overrides?: Partial<RuntimeReadinessPort>): RuntimeReadinessPort {
  return {
    getReadinessSnapshot: testDouble.fn<RuntimeReadinessPort["getReadinessSnapshot"]>().mockResolvedValue({
      status: "ready",
      healthy: true,
      available: true,
      capabilities: [],
      updatedAt: "2026-05-06T00:00:00.000Z",
    }),
    getCapabilityStatus: testDouble.fn<RuntimeReadinessPort["getCapabilityStatus"]>().mockResolvedValue(
      createRuntimeCapabilityStatus({
        capabilityId: "python-runtime",
        status: "ready",
        updatedAt: "2026-05-06T00:00:00.000Z",
      }),
    ),
    ...overrides,
  };
}

describe("registerRuntimeReadinessIpc", () => {
  it("returns readiness snapshots with request correlation preserved", async () => {
    const runtimeReadiness = createRuntimeReadiness();
    const handler = createDesktopRuntimeReadinessReadIpcHandler({ runtimeReadiness });
    const request = createDesktopRuntimeReadinessReadRequest(
      { boundary: { host: "desktop", source: "desktop.renderer.runtime-readiness" } },
      { requestId: "req-ready", correlationId: "corr-ready" },
    );

    const response = await handler({}, request);

    expect(runtimeReadiness.getReadinessSnapshot).toHaveBeenCalledOnce();
    expect(response).toMatchObject({
      ok: true,
      requestId: "req-ready",
      correlationId: "corr-ready",
      value: { status: "ready" },
    });
  });

  it("reads individual capability status by normalized capability id", async () => {
    const runtimeReadiness = createRuntimeReadiness();
    const handler = createDesktopRuntimeCapabilityStatusReadIpcHandler({ runtimeReadiness });
    const request = createDesktopRuntimeCapabilityStatusReadRequest(
      {
        capabilityId: "python-runtime",
        boundary: { host: "desktop", source: "desktop.renderer.runtime-readiness" },
      },
      { requestId: "req-cap", correlationId: "corr-cap" },
    );

    const response = await handler({}, request);

    expect(runtimeReadiness.getCapabilityStatus).toHaveBeenCalledWith("python-runtime");
    expect(response).toMatchObject({
      ok: true,
      requestId: "req-cap",
      correlationId: "corr-cap",
      value: { capabilityId: "python-runtime", status: "ready" },
    });
  });

  it("maps invalid capability ids to validation failures without calling the service", async () => {
    const runtimeReadiness = createRuntimeReadiness();
    const handler = createDesktopRuntimeCapabilityStatusReadIpcHandler({ runtimeReadiness });
    const request = {
      ...createDesktopRuntimeCapabilityStatusReadRequest({
        capabilityId: "python-runtime",
        boundary: { host: "desktop", source: "desktop.renderer.runtime-readiness" },
      }, { requestId: "req-bad", correlationId: "corr-bad" }),
      payload: {
        capabilityId: "not-a-capability",
        boundary: { host: "desktop", source: "desktop.renderer.runtime-readiness" },
      },
    } as any;

    const response = await handler({}, request);

    expect(runtimeReadiness.getCapabilityStatus).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      requestId: "req-bad",
      correlationId: "corr-bad",
      error: {
        code: "validation",
        message: "Unknown runtime capability id.",
        details: { field: "capabilityId" },
      },
    });
  });

  it("registers readiness snapshot and capability status channels", () => {
    const channels: string[] = [];
    registerRuntimeReadinessIpc({
      ipcMain: {
        handle: testDouble.fn((channel: string) => channels.push(channel)),
      },
      runtimeReadiness: createRuntimeReadiness(),
    });

    expect(channels).toEqual([
      DESKTOP_RUNTIME_READINESS_READ_REQUEST_CHANNEL.value,
      DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_REQUEST_CHANNEL.value,
    ]);
  });
});
