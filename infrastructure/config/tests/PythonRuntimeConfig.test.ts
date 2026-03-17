import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "../PythonRuntimeConfig";

describe("PythonRuntimeConfig", () => {
  it("defaults to disabled mode", () => {
    const config = new PythonRuntimeConfig();
    expect(config.isEnabled).toBe(false);
    expect(config.timeoutMs).toBe(15000);
  });

  it("requires base url when enabled", () => {
    expect(() => new PythonRuntimeConfig({ mode: "local-http" })).toThrow();
  });

  it("loads from env", () => {
    const config = PythonRuntimeConfig.fromEnv({
      PYTHON_RUNTIME_MODE: "local-http",
      PYTHON_RUNTIME_BASE_URL: " http://localhost:8100 ",
      PYTHON_RUNTIME_TIMEOUT_MS: "2000",
      PYTHON_RUNTIME_AUTH_TOKEN: " token ",
    });

    expect(config.isEnabled).toBe(true);
    expect(config.baseUrl).toBe("http://localhost:8100");
    expect(config.timeoutMs).toBe(2000);
    expect(config.authToken).toBe("token");
  });
});
