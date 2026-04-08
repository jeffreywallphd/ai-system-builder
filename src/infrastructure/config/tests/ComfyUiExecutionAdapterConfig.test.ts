import { describe, expect, it } from "bun:test";
import {
  ComfyUiExecutionAdapterConfig,
  ComfyUiExecutionAdapterEnvironmentKeys,
} from "../ComfyUiExecutionAdapterConfig";

describe("ComfyUiExecutionAdapterConfig", () => {
  it("defaults to disabled when no endpoint is configured", () => {
    const config = new ComfyUiExecutionAdapterConfig();
    expect(config.enabled).toBeFalse();
    expect(config.baseUrl).toBeUndefined();
    expect(config.requestTimeoutMs).toBe(30000);
    expect(config.capabilityProbeOnStartup).toBeTrue();
    expect(config.requiredNodeTypes).toEqual([]);
  });

  it("enables automatically when baseUrl is provided and normalizes defaults", () => {
    const config = new ComfyUiExecutionAdapterConfig({
      baseUrl: "http://localhost:8188/",
      requiredNodeTypes: Object.freeze([" LoadImage ", "SaveImage", "LoadImage"]),
    });

    expect(config.enabled).toBeTrue();
    expect(config.baseUrl).toBe("http://localhost:8188");
    expect(config.requiredNodeTypes).toEqual(["LoadImage", "SaveImage"]);
  });

  it("requires baseUrl when enabled explicitly", () => {
    expect(() => new ComfyUiExecutionAdapterConfig({
      enabled: true,
    })).toThrow("requires baseUrl");
  });

  it("rejects unsupported baseUrl protocols", () => {
    expect(() => new ComfyUiExecutionAdapterConfig({
      enabled: true,
      baseUrl: "ftp://localhost:8188",
    })).toThrow("must use http or https");
  });

  it("loads environment configuration with fallback keys and safe snapshot redaction", () => {
    const config = ComfyUiExecutionAdapterConfig.fromEnv({
      [ComfyUiExecutionAdapterEnvironmentKeys.enabled]: "true",
      COMFYUI_BASE_URL: "http://127.0.0.1:8188/",
      COMFYUI_TIMEOUT_MS: "45000",
      [ComfyUiExecutionAdapterEnvironmentKeys.requiredNodeTypes]: "LoadImage, SaveImage ,",
      [ComfyUiExecutionAdapterEnvironmentKeys.capabilityProbeOnStartup]: "false",
      [ComfyUiExecutionAdapterEnvironmentKeys.authToken]: " secret-token ",
    });

    expect(config.enabled).toBeTrue();
    expect(config.baseUrl).toBe("http://127.0.0.1:8188");
    expect(config.requestTimeoutMs).toBe(45000);
    expect(config.capabilityProbeOnStartup).toBeFalse();
    expect(config.requiredNodeTypes).toEqual(["LoadImage", "SaveImage"]);
    expect(config.authToken).toBe("secret-token");
    expect(config.toSafeSnapshot()).toEqual({
      enabled: true,
      baseUrl: "http://127.0.0.1:8188",
      requestTimeoutMs: 45000,
      capabilityProbeOnStartup: false,
      requiredNodeTypes: ["LoadImage", "SaveImage"],
      hasAuthToken: true,
    });
  });
});
