import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createPythonRuntimeHttpClient } from "../client/createPythonRuntimeHttpClient";

describe("createPythonRuntimeHttpClient", () => {
  it("calls POST /tasks/start", async () => {
    const fetcher = testDouble.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ requestId: "r1", taskType: "train-model", accepted: true, status: "queued" }) });
    const client = createPythonRuntimeHttpClient({ baseUrl: "http://localhost:8000", fetchImplementation: fetcher as never });
    await client.startTask({ requestId: "r1", taskType: "train-model", payload: { x: 1 } });
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:8000/tasks/start");
    expect((fetcher.mock.calls[0]?.[1] as { method?: string }).method).toBe("POST");
  });

  it("calls GET /tasks/{requestId}", async () => {
    const fetcher = testDouble.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ requestId: "r2", taskType: "train-model", status: "running" }) });
    const client = createPythonRuntimeHttpClient({ baseUrl: "http://localhost:8000", fetchImplementation: fetcher as never });
    await client.readTaskStatus("r2");
    expect(fetcher).toHaveBeenCalledWith("http://localhost:8000/tasks/r2", { method: "GET" });
  });

  it("calls POST /tasks/{requestId}/cancel", async () => {
    const fetcher = testDouble.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ requestId: "r3", status: "cancelled", cancelled: true }) });
    const client = createPythonRuntimeHttpClient({ baseUrl: "http://localhost:8000", fetchImplementation: fetcher as never });
    await client.cancelTask("r3");
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:8000/tasks/r3/cancel");
    expect((fetcher.mock.calls[0]?.[1] as { method?: string }).method).toBe("POST");
  });

  it("does not expose executeTask", () => {
    const client = createPythonRuntimeHttpClient({ baseUrl: "http://localhost:8000", fetchImplementation: testDouble.fn() as never });
    expect("executeTask" in (client as Record<string, unknown>)).toBe(false);
  });

  it("runs model downloads through async task polling instead of a long request", async () => {
    const responses = [
      {
        ok: true,
        status: 200,
        json: async () => ({
          requestId: "model-download-1",
          taskType: "ensure-model-download",
          accepted: true,
          status: "queued",
        }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          requestId: "model-download-1",
          taskType: "ensure-model-download",
          status: "succeeded",
          data: {
            provider: "transformers",
            modelId: "stabilityai/stable-diffusion-xl-base-1.0",
            downloaded: true,
            fromCache: false,
            localPath: "/hf/snapshots/sdxl",
          },
        }),
      },
    ];
    const fetcher = testDouble.fn(async () => {
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected fetch call.");
      }
      return response;
    });
    const client = createPythonRuntimeHttpClient({
      baseUrl: "http://localhost:8000",
      fetchImplementation: fetcher as never,
      modelDownloadPollIntervalMs: 1,
    });

    const result = await client.ensureModelDownloaded({
      provider: "transformers",
      modelId: "stabilityai/stable-diffusion-xl-base-1.0",
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:8000/tasks/start");
    expect(JSON.parse(String((fetcher.mock.calls[0]?.[1] as { body?: string }).body))).toMatchObject({
      taskType: "ensure-model-download",
      payload: {
        provider: "transformers",
        modelId: "stabilityai/stable-diffusion-xl-base-1.0",
      },
    });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("/tasks/model-download-");
    expect(result).toEqual({
      provider: "transformers",
      modelId: "stabilityai/stable-diffusion-xl-base-1.0",
      downloaded: true,
      fromCache: false,
      localPath: "/hf/snapshots/sdxl",
    });
  });

  it("continues polling model downloads after recoverable task status transport failures", async () => {
    const responses = [
      {
        ok: true,
        status: 200,
        json: async () => ({
          requestId: "model-download-1",
          taskType: "ensure-model-download",
          accepted: true,
          status: "queued",
        }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          requestId: "model-download-1",
          taskType: "ensure-model-download",
          status: "running",
          progress: {
            stage: "snapshot-download",
            message: "Downloading Hugging Face snapshot.",
          },
        }),
      },
      new TypeError("fetch failed"),
      {
        ok: true,
        status: 200,
        json: async () => ({
          requestId: "model-download-1",
          taskType: "ensure-model-download",
          status: "succeeded",
          data: {
            provider: "transformers",
            modelId: "stabilityai/stable-diffusion-xl-base-1.0",
            downloaded: true,
            fromCache: false,
            localPath: "/hf/snapshots/sdxl",
          },
        }),
      },
    ];
    const fetcher = testDouble.fn(async () => {
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected fetch call.");
      }
      if (response instanceof Error) {
        throw response;
      }
      return response;
    });
    const client = createPythonRuntimeHttpClient({
      baseUrl: "http://localhost:8000",
      fetchImplementation: fetcher as never,
      modelDownloadPollIntervalMs: 1,
    });

    const result = await client.ensureModelDownloaded({
      provider: "transformers",
      modelId: "stabilityai/stable-diffusion-xl-base-1.0",
    });

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(result.localPath).toBe("/hf/snapshots/sdxl");
  });
});
