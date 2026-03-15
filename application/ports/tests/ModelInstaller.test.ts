import { describe, expect, it } from "bun:test";
import {
  ModelInstallHandle,
  ModelInstaller,
  ModelInstallProgress,
  ModelInstallResult,
} from "../ModelInstaller";
import { ModelDownloadHandle, ModelDownloadProgress, ModelDownloadResult } from "../ModelDownloader";
import type { IModelDownloader } from "../interfaces/IModelDownloader";
import type { IModelInstallRequest, IModelInstaller } from "../interfaces/IModelInstaller";
import { makeModel } from "./testUtils";

const model = makeModel();
const request: IModelInstallRequest = { model, destination: "/models/model-1" };

describe("ModelInstaller value objects", () => {
  it("normalizes and validates", async () => {
    const p = new ModelInstallProgress({ modelId: " m1 ", status: "queued", message: " hi " });
    const r = new ModelInstallResult({ model, destination: " /dest ", status: "completed", installedLocation: " /dest/model " });

    expect(p.modelId).toBe("m1");
    expect(r.destination).toBe("/dest");
    expect(r.installedLocation).toBe("/dest/model");
    expect(() => new ModelInstallProgress({ modelId: " ", status: "queued" })).toThrow();
    expect(() => new ModelInstallResult({ model, destination: " ", status: "failed" })).toThrow();

    let cancelled = false;
    const handle = new ModelInstallHandle({
      operationId: "op",
      request,
      completionPromise: Promise.resolve(new ModelInstallResult({ model, destination: "/models/model-1", status: "completed" })),
      cancel: () => {
        cancelled = true;
      },
    });
    await handle.cancel();
    expect(cancelled).toBeTrue();
    expect(() => handle.updateProgress(new ModelInstallProgress({ modelId: "other", status: "queued" }))).toThrow();
  });
});

describe("ModelInstaller", () => {
  it("supports local/bundled/manual installs without downloader", async () => {
    const installer = new ModelInstaller();
    const localModel = makeModel({ source: { ...model.source, type: "local" } as any });

    const result = await installer.install({ model: localModel, destination: "/models/local" });
    expect(result.status).toBe("completed");
    expect(installer.canInstall({ model: localModel, destination: "/models/local" })).toBeTrue();
  });

  it("delegates to matching provider", async () => {
    const provider: IModelInstaller = {
      startInstall: async () => new ModelInstallHandle({
        operationId: "p1",
        request,
        completionPromise: Promise.resolve(new ModelInstallResult({ model, destination: request.destination, status: "completed" })),
      }),
      install: async () => new ModelInstallResult({ model, destination: request.destination, status: "completed" }),
      canInstall: () => true,
      isInstalled: async () => true,
    };
    const installer = new ModelInstaller({ providers: [provider] });
    expect((await installer.startInstall(request)).operationId).toBe("p1");
    expect((await installer.install(request)).status).toBe("completed");
    expect(await installer.isInstalled(model, request.destination)).toBeTrue();
  });

  it("performs downloader-based install flows", async () => {
    const downloader: IModelDownloader = {
      canDownload: () => true,
      download: async () => new ModelDownloadResult({ modelId: model.id, destination: request.destination, status: "completed" }),
      startDownload: async () =>
        new ModelDownloadHandle({
          operationId: "d1",
          request: { model, destination: request.destination },
          initialProgress: new ModelDownloadProgress({ modelId: model.id, status: "downloading", percent: 50 }),
          completionPromise: Promise.resolve(new ModelDownloadResult({ modelId: model.id, destination: request.destination, status: "completed", sizeBytes: 123 })),
        }),
    };

    const installer = new ModelInstaller({ downloader });
    const progressStates: string[] = [];
    const result = await installer.install(request, (p) => progressStates.push(p.status));

    expect(result.status).toBe("completed");
    expect(progressStates).toContain("preparing");
    expect(progressStates).toContain("preparing");
    expect(progressStates.length).toBeGreaterThan(0);
  });

  it("captures current startInstall initialization regression", async () => {
    const downloader: IModelDownloader = {
      canDownload: () => true,
      download: async () => new ModelDownloadResult({ modelId: model.id, destination: request.destination, status: "cancelled" }),
      startDownload: async () =>
        new ModelDownloadHandle({
          operationId: "d2",
          request: { model, destination: request.destination },
          completionPromise: Promise.resolve(new ModelDownloadResult({ modelId: model.id, destination: request.destination, status: "cancelled" })),
        }),
    };

    const installer = new ModelInstaller({ downloader });
    const handle = await installer.startInstall(request);
    expect(handle.waitForCompletion()).rejects.toThrow("Cannot access 'handle' before initialization");
  });
});
