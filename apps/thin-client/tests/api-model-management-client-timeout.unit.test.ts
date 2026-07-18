import {
  afterEach,
  describe,
  expect,
  it,
  testDouble,
} from "../../../modules/testing/node-test";

import {
  createApiModelManagementClient,
  MODEL_MANAGEMENT_DOWNLOAD_REQUEST_TIMEOUT_MS,
} from "../src/features/model-management/api/apiModelManagementClient";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "window",
);
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "fetch",
);
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);

const defineGlobal = (
  property: "window" | "fetch" | "localStorage",
  value: unknown,
): void => {
  Object.defineProperty(globalThis, property, {
    configurable: true,
    value,
    writable: true,
  });
};

const restoreGlobal = (
  property: "window" | "fetch" | "localStorage",
  descriptor?: PropertyDescriptor,
): void => {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, property);
};

describe("api model management client request timeouts", () => {
  afterEach(() => {
    restoreGlobal("window", originalWindowDescriptor);
    restoreGlobal("fetch", originalFetchDescriptor);
    restoreGlobal("localStorage", originalLocalStorageDescriptor);
  });

  it("uses a long transport timeout for Hugging Face model downloads", async () => {
    const setTimeoutSpy = testDouble.fn(
      (handler: TimerHandler, timeout?: number) => {
        return 1;
      },
    );
    const clearTimeoutSpy = testDouble.fn();
    defineGlobal("window", {
      setTimeout: setTimeoutSpy,
      clearTimeout: clearTimeoutSpy,
    });
    defineGlobal("localStorage", { getItem: () => null });
    defineGlobal(
      "fetch",
      testDouble.fn(() =>
        Promise.resolve({
          headers: { get: () => "application/json" },
          status: 200,
          json: async () => ({
            ok: true,
            value: {
              model: { modelRecordId: "m1" },
              download: {
                provider: "transformers",
                modelId: "stabilityai/stable-diffusion-xl-base-1.0",
                downloaded: true,
                fromCache: false,
                localPath: "/models/sdxl",
              },
            },
          }),
        } as unknown as Response),
      ) as typeof fetch,
    );

    const result = createApiModelManagementClient().downloadModel({
      provider: "huggingface",
      modelId: "stabilityai/stable-diffusion-xl-base-1.0",
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      MODEL_MANAGEMENT_DOWNLOAD_REQUEST_TIMEOUT_MS,
    );
    const resolved = await result;
    expect(JSON.stringify(resolved)).not.toContain("/models/sdxl");
    expect("localPath" in resolved.model).toBe(false);
    expect("localPath" in resolved.download).toBe(false);
  });

  it("keeps short request timeouts short for list operations", async () => {
    const setTimeoutSpy = testDouble.fn(
      (handler: TimerHandler, timeout?: number) => {
        return 1;
      },
    );
    defineGlobal("window", {
      setTimeout: setTimeoutSpy,
      clearTimeout: testDouble.fn(),
    });
    defineGlobal("localStorage", { getItem: () => null });
    defineGlobal(
      "fetch",
      testDouble.fn(() =>
        Promise.resolve({
          headers: { get: () => "application/json" },
          status: 200,
          json: async () => ({ ok: true, value: { models: [] } }),
        } as unknown as Response),
      ) as typeof fetch,
    );

    const result = createApiModelManagementClient().listModels();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15000);
    await result;
  });
});
