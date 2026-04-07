import { describe, expect, it } from "bun:test";
import { ComfyAdapterConfig } from "../ComfyAdapterConfig";

describe("ComfyAdapterConfig", () => {
  it("requires a base URL", () => {
    expect(() => new ComfyAdapterConfig()).toThrow("requires baseUrl");
  });

  it("normalizes and defaults runtime settings", () => {
    const config = new ComfyAdapterConfig({ baseUrl: " http://localhost:8188/ " });

    expect(config.baseUrl).toBe("http://localhost:8188");
    expect(config.requestTimeoutMs).toBe(30_000);
    expect(config.pollIntervalMs).toBe(1_000);
    expect(config.maxExecutionWaitMs).toBe(1000 * 60 * 60);
  });

  it("loads from environment values", () => {
    const config = ComfyAdapterConfig.fromEnv({
      COMFYUI_BASE_URL: "http://127.0.0.1:8188",
      COMFYUI_TIMEOUT_MS: "45000",
      COMFYUI_POLL_INTERVAL_MS: "250",
      COMFYUI_MAX_WAIT_MS: "120000",
    });

    expect(config.baseUrl).toBe("http://127.0.0.1:8188");
    expect(config.requestTimeoutMs).toBe(45_000);
    expect(config.pollIntervalMs).toBe(250);
    expect(config.maxExecutionWaitMs).toBe(120_000);
  });
});
