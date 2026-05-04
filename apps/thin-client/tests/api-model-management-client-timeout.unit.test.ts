import { afterEach, describe, expect, it, testDouble } from "../../../modules/testing/node-test";

import {
  createApiModelManagementClient,
  MODEL_MANAGEMENT_DOWNLOAD_REQUEST_TIMEOUT_MS,
} from "../src/features/model-management/api/apiModelManagementClient";

const originalWindow = (globalThis as { window?: unknown }).window;
const originalFetch = globalThis.fetch;
const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

describe("api model management client request timeouts", () => {
  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    globalThis.fetch = originalFetch;
    (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
  });

  it("uses a long transport timeout for Hugging Face model downloads", async () => {
    const setTimeoutSpy = testDouble.fn((handler: TimerHandler, timeout?: number) => {
      return 1;
    });
    const clearTimeoutSpy = testDouble.fn();
    (globalThis as { window?: unknown }).window = {
      setTimeout: setTimeoutSpy,
      clearTimeout: clearTimeoutSpy,
    };
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null };
    globalThis.fetch = testDouble.fn(() => Promise.resolve({ headers: { get: () => "application/json" }, status: 200, json: async () => ({ ok: true, value: { model: { modelRecordId: "m1" }, download: { provider: "transformers", modelId: "stabilityai/stable-diffusion-xl-base-1.0", downloaded: true, fromCache: false, localPath: "/models/sdxl" } } }) } as unknown as Response)) as typeof fetch;

    const result = createApiModelManagementClient().downloadModel({
      provider: "huggingface",
      modelId: "stabilityai/stable-diffusion-xl-base-1.0",
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MODEL_MANAGEMENT_DOWNLOAD_REQUEST_TIMEOUT_MS);
    await result;
  });

  it("keeps short request timeouts short for list operations", async () => {
    const setTimeoutSpy = testDouble.fn((handler: TimerHandler, timeout?: number) => {
      return 1;
    });
    (globalThis as { window?: unknown }).window = {
      setTimeout: setTimeoutSpy,
      clearTimeout: testDouble.fn(),
    };
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null };
    globalThis.fetch = testDouble.fn(() => Promise.resolve({ headers: { get: () => "application/json" }, status: 200, json: async () => ({ ok: true, value: { models: [] } }) } as unknown as Response)) as typeof fetch;

    const result = createApiModelManagementClient().listModels();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15000);
    await result;
  });
});
