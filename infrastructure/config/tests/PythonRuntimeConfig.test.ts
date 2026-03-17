import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "../PythonRuntimeConfig";

describe("PythonRuntimeConfig", () => {
  it("defaults to disabled mode", () => {
    const config = new PythonRuntimeConfig();
    expect(config.isEnabled).toBe(false);
    expect(config.timeoutMs).toBe(15000);
    expect(config.pythonExecutable).toBe("python");
    expect(config.autoStartEnabled).toBeTrue();
  });

  it("requires base url when enabled", () => {
    expect(() => new PythonRuntimeConfig({ mode: "local-http" })).toThrow();
  });

  it("uses a browser-safe default runtime working directory", () => {
    const config = new PythonRuntimeConfig();
    expect(config.runtimeWorkingDirectory.endsWith("python-runtime")).toBeTrue();
  });

  it("loads from env", () => {
    const config = PythonRuntimeConfig.fromEnv({
      PYTHON_RUNTIME_MODE: "local-http",
      PYTHON_RUNTIME_BASE_URL: " http://localhost:8100 ",
      PYTHON_RUNTIME_TIMEOUT_MS: "2000",
      PYTHON_RUNTIME_AUTH_TOKEN: " token ",
      PYTHON_RUNTIME_EXECUTABLE: "python3",
      PYTHON_RUNTIME_WORKDIR: "./python-runtime",
      PYTHON_RUNTIME_STARTUP_TIMEOUT_MS: "25000",
      PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS: "250",
      PYTHON_RUNTIME_AUTO_START: "true",
    });

    expect(config.isEnabled).toBe(true);
    expect(config.baseUrl).toBe("http://localhost:8100");
    expect(config.timeoutMs).toBe(2000);
    expect(config.authToken).toBe("token");
    expect(config.pythonExecutable).toBe("python3");
    expect(config.runtimeWorkingDirectory).toBe("./python-runtime");
    expect(config.startupTimeoutMs).toBe(25000);
    expect(config.healthPollIntervalMs).toBe(250);
    expect(config.autoStartEnabled).toBeTrue();
  });
});
