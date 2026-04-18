import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it, testDouble } from "../../../../testing/node-test";

import type { LoggingPort } from "../../../../application/ports/logging";
import type { StructuredLogEvent } from "../../../../contracts/logging";

import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_REGISTER_FROM_REPO_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../../../../adapters/transport/ipc-electron/ipcMainHandlePort";

import { composeDesktopHost, type RegisterDesktopImageUploadIpcOptions } from "../composeDesktopHost";

describe("composeDesktopHost", () => {
  it("uses the canonical ipc-main handle port type for registration options", () => {
    expectTypeOf<RegisterDesktopImageUploadIpcOptions["ipcMain"]>().toEqualTypeOf<IpcMainHandlePort>();
  });

  it("provides a LoggingPort-backed seam using the real logging adapter", async () => {
    const sink = testDouble.fn();
    const host = composeDesktopHost({
      logging: {
        verbosity: "verbose",
        level: "debug",
      },
      logSink: sink,
    });

    expectTypeOf(host.loggingPort).toExtend<LoggingPort>();
    expect(host.loggingConfig).toEqual({
      verbosity: "verbose",
      level: "debug",
      includeDiagnostics: undefined,
    });

    const event: StructuredLogEvent = {
      timestamp: "2026-04-14T12:00:00.000Z",
      level: "info",
      verbosity: "normal",
      event: "upload.started",
      message: "Upload started",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
    };

    await host.loggingPort.log(event);

    expect(sink).toHaveBeenCalledOnce();
    const [, emittedEvent] = sink.mock.calls[0] as [string, StructuredLogEvent];
    expect(emittedEvent).toMatchObject({
      event: "upload.started",
      host: "desktop",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
    });
  });


  it("registers the desktop image upload IPC handler on the request channel", () => {
    const ipcMain = {
      handle: testDouble.fn(),
    };
    const host = composeDesktopHost();

    host.registerImageUploadIpc({
      ipcMain,
      storageRootDirectory: "/tmp/desktop-image-upload-test",
    });

    expect(ipcMain.handle).toHaveBeenCalledTimes(9);
    const channels = ipcMain.handle.mock.calls.map((call) => call[0]);
    expect(channels).toEqual([
      DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_REGISTER_FROM_REPO_REQUEST_CHANNEL.value,
      DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_REQUEST_CHANNEL.value,
    ]);
    const listener = ipcMain.handle.mock.calls[0]?.[1];
    expect(listener).toBeTypeOf("function");
  });

  it("keeps the composition seam usable for upload success and failure event logging", async () => {
    const sink = testDouble.fn();
    const host = composeDesktopHost({
      logging: {
        verbosity: "trace",
        level: "info",
      },
      logSink: sink,
    });

    await host.loggingPort.log({
      timestamp: "2026-04-14T12:00:01.000Z",
      level: "info",
      verbosity: "normal",
      event: "upload.stored_successfully",
      message: "Upload stored successfully",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
      outcome: "success",
    });
    await host.loggingPort.log({
      timestamp: "2026-04-14T12:00:02.000Z",
      level: "error",
      verbosity: "normal",
      event: "upload.failed",
      message: "Upload failed",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
      outcome: "failure",
    });

    expect(sink).toHaveBeenCalledTimes(2);
  });

  it("reuses the shared PublishArtifactToRepoUseCase in desktop host composition", () => {
    const typeScriptPath = fileURLToPath(new URL("../composeDesktopHost.ts", import.meta.url));
    const sourcePath = existsSync(typeScriptPath) ? typeScriptPath : typeScriptPath.replace(/\.ts$/, ".js");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("PublishArtifactToRepoUseCase");
    expect(source).not.toContain("class DesktopPublish");
  });
});
