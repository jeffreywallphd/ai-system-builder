import { describe, expect, it } from "bun:test";
import {
  ModelDownloadHandle,
  ModelDownloadProgress,
  ModelDownloadResult,
  ModelDownloader,
} from "../ModelDownloader";
import type { IModelDownloadHandle, IModelDownloadRequest, IModelDownloader } from "../interfaces/IModelDownloader";
import { makeModel } from "./testUtils";

const request: IModelDownloadRequest = {
  model: makeModel(),
  destination: "/models/m1",
};

describe("ModelDownloader value objects", () => {
  it("normalizes progress/result and validates required fields", () => {
    const progress = new ModelDownloadProgress({ modelId: " m1 ", status: "downloading", bytesDownloaded: 50, totalBytes: 100 });
    const result = new ModelDownloadResult({ modelId: " m1 ", destination: " /dest ", status: "completed", sha256: " ABC ", message: " done " });

    expect(progress.modelId).toBe("m1");
    expect(progress.percent).toBe(50);
    expect(result.destination).toBe("/dest");
    expect(result.sha256).toBe("abc");
    expect(() => new ModelDownloadProgress({ modelId: " ", status: "queued" })).toThrow();
    expect(() => new ModelDownloadResult({ modelId: "m1", destination: " ", status: "completed" })).toThrow();
  });

  it("handle updates progress and supports cancellation", async () => {
    let cancelled = false;
    const handle = new ModelDownloadHandle({
      operationId: "op1",
      request,
      completionPromise: Promise.resolve(new ModelDownloadResult({ modelId: "model-1", destination: "/models/m1", status: "completed", sizeBytes: 100 })),
      cancel: async () => {
        cancelled = true;
      },
    });

    handle.updateProgress(new ModelDownloadProgress({ modelId: "model-1", status: "downloading", percent: 20 }));
    expect((await handle.getProgress()).percent).toBe(20);
    await handle.waitForCompletion();
    expect((await handle.getProgress()).percent).toBe(100);
    await handle.cancel();
    expect(cancelled).toBeTrue();
    expect(() => handle.updateProgress(new ModelDownloadProgress({ modelId: "other", status: "queued" }))).toThrow();
  });
});

describe("ModelDownloader", () => {
  it("delegates startDownload and direct download", async () => {
    const provider: IModelDownloader = {
      startDownload: async () => new ModelDownloadHandle({
        operationId: "p1",
        request,
        completionPromise: Promise.resolve(new ModelDownloadResult({ modelId: "model-1", destination: "/models/m1", status: "completed" })),
      }),
      download: async () => new ModelDownloadResult({ modelId: "model-1", destination: "/models/m1", status: "completed" }),
      canDownload: () => true,
    };
    const downloader = new ModelDownloader([provider]);

    expect((await downloader.startDownload(request)).operationId).toBe("p1");
    expect((await downloader.download(request)).status).toBe("completed");
    expect(downloader.canDownload(request)).toBeTrue();
  });

  it("streams progress when onProgress callback is provided", async () => {
    let status: IModelDownloadHandle | undefined;
    const provider: IModelDownloader = {
      startDownload: async () => {
        const handle = new ModelDownloadHandle({
          operationId: "op",
          request,
          initialProgress: new ModelDownloadProgress({ modelId: "model-1", status: "downloading", percent: 10 }),
          completionPromise: Promise.resolve(new ModelDownloadResult({ modelId: "model-1", destination: "/models/m1", status: "completed", sizeBytes: 100 })),
        });
        status = handle;
        return handle;
      },
      download: async () => {
        throw new Error("not used");
      },
      canDownload: () => true,
    };

    const events: string[] = [];
    const downloader = new ModelDownloader([provider]);
    const result = await downloader.download(request, (p) => events.push(p.status));

    expect(result.status).toBe("completed");
    expect(events.length).toBeGreaterThan(0);
    expect(status).toBeDefined();
  });

  it("throws when no provider can handle request", async () => {
    const downloader = new ModelDownloader([]);
    expect(() => downloader.canDownload(request)).not.toThrow();
    expect(downloader.download(request)).rejects.toThrow("No model downloader is available");
  });
});
