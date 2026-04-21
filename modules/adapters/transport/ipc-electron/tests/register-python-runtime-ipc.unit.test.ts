import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  DESKTOP_PYTHON_RUNTIME_CONTROL_REQUEST_CHANNEL,
  DESKTOP_PYTHON_RUNTIME_STATUS_READ_REQUEST_CHANNEL,
  createDesktopPythonRuntimeControlRequest,
  createDesktopPythonRuntimeStatusReadRequest,
} from "../../../../contracts/ipc";
import {
  createDesktopPythonRuntimeControlIpcHandler,
  createDesktopPythonRuntimeStatusReadIpcHandler,
  registerPythonRuntimeIpc,
} from "../python-runtime/registerPythonRuntimeIpc";

describe("registerPythonRuntimeIpc", () => {
  it("maps status-read requests to runtime status response envelope", async () => {
    const handler = createDesktopPythonRuntimeStatusReadIpcHandler({
      readPythonRuntimeStatus: testDouble.fn(async () => ({
        supervisorStatus: "ready",
        healthy: true,
        runtimeStatus: "ready",
        capabilities: ["prepare-training-dataset"],
        logs: [],
      })),
    });

    const response = await handler({}, createDesktopPythonRuntimeStatusReadRequest({
      boundary: {
        host: "desktop",
        source: "desktop.renderer.runtime-footer",
      },
    }));

    expect(response.ok).toBe(true);
    expect(response.value.runtimeStatus).toBe("ready");
  });

  it("maps control requests to runtime action and status response envelope", async () => {
    const startPythonRuntime = testDouble.fn(async () => undefined);
    const handler = createDesktopPythonRuntimeControlIpcHandler({
      startPythonRuntime,
      stopPythonRuntime: testDouble.fn(async () => undefined),
      restartPythonRuntime: testDouble.fn(async () => undefined),
      readPythonRuntimeStatus: testDouble.fn(async () => ({
        supervisorStatus: "starting",
        healthy: false,
        runtimeStatus: "starting",
        capabilities: [],
        logs: [],
      })),
    });

    const response = await handler({}, createDesktopPythonRuntimeControlRequest({
      action: "start",
      boundary: {
        host: "desktop",
        source: "desktop.renderer.runtime-footer",
      },
    }));

    expect(startPythonRuntime).toHaveBeenCalledOnce();
    expect(response.ok).toBe(true);
    expect(response.value.supervisorStatus).toBe("starting");
  });

  it("registers python runtime IPC channels", () => {
    const channels: string[] = [];
    registerPythonRuntimeIpc({
      ipcMain: {
        handle: testDouble.fn((channel: string) => {
          channels.push(channel);
        }),
      },
      startPythonRuntime: testDouble.fn(async () => undefined),
      stopPythonRuntime: testDouble.fn(async () => undefined),
      restartPythonRuntime: testDouble.fn(async () => undefined),
      readPythonRuntimeStatus: testDouble.fn(async () => ({
        supervisorStatus: "stopped",
        healthy: false,
        runtimeStatus: "stopped",
        capabilities: [],
        logs: [],
      })),
    });

    expect(channels).toEqual([
      DESKTOP_PYTHON_RUNTIME_STATUS_READ_REQUEST_CHANNEL.value,
      DESKTOP_PYTHON_RUNTIME_CONTROL_REQUEST_CHANNEL.value,
    ]);
  });
});
