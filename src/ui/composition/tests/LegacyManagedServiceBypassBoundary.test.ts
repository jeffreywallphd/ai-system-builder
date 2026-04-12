import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "@infrastructure/config/PythonRuntimeConfig";
import { LocalStorageManagedServiceDefinitionRepository } from "@infrastructure/browser/services/LocalStorageManagedServiceDefinitionRepository";
import { HttpManagedServiceDefinitionRepository } from "@infrastructure/services/HttpManagedServiceDefinitionRepository";
import { resolveLegacyManagedServiceBypassBoundary } from "../legacy/LegacyManagedServiceBypassBoundary";

describe("LegacyManagedServiceBypassBoundary", () => {
  it("isolates the supervisor bypass path outside explicit managed-local runtime mode", () => {
    const boundary = resolveLegacyManagedServiceBypassBoundary({
      enableLegacyBypass: false,
      pythonRuntimeConfig: new PythonRuntimeConfig({
        mode: "external-http",
        baseUrl: "http://127.0.0.1:8000",
      }),
    });

    expect(boundary.isEnabled).toBeFalse();
    expect(boundary.supervisorClient).toBeUndefined();
    expect(boundary.eventStream).toBeUndefined();
    expect(boundary.definitionRepository).toBeInstanceOf(
      LocalStorageManagedServiceDefinitionRepository,
    );
  });

  it("enables the isolated legacy bypass boundary for managed-local supervisor mode only", () => {
    const boundary = resolveLegacyManagedServiceBypassBoundary({
      enableLegacyBypass: true,
      pythonRuntimeConfig: new PythonRuntimeConfig({
        mode: "managed-local",
        baseUrl: "http://127.0.0.1:8000",
        supervisorBaseUrl: "http://127.0.0.1:8790",
      }),
    });

    expect(boundary.isEnabled).toBeTrue();
    expect(boundary.supervisorClient).toBeDefined();
    expect(boundary.eventStream).toBeDefined();
    expect(boundary.definitionRepository).toBeInstanceOf(
      HttpManagedServiceDefinitionRepository,
    );
  });
});
