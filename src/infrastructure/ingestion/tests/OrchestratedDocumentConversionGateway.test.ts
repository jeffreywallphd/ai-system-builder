import { describe, expect, it, mock } from "bun:test";
import { RuntimeDependencyIds, RuntimeDependencyOperationalStates, RuntimeDependencyUnavailableError } from "@application/runtime/RuntimeDependencyOrchestrator";
import { OrchestratedDocumentConversionGateway } from "../OrchestratedDocumentConversionGateway";

describe("OrchestratedDocumentConversionGateway", () => {
  it("throws a runtime dependency error when document conversion is not operational", async () => {
    const delegate = {
      convert: mock(async () => ({
        markdown: "# ignored",
        sourceFormat: "pdf",
        outputFormat: "markdown" as const,
        file: { name: "report.pdf", mimeType: "application/pdf", sizeInBytes: 4 },
        conversion: { strategy: "converted" as const, converterId: "x" },
        warnings: [],
      })),
    };
    const gateway = new OrchestratedDocumentConversionGateway(delegate, {
      ensureAvailable: async (dependencyId) => ({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: "document-conversion-test",
        state: RuntimeDependencyOperationalStates.starting,
        health: "degraded",
        availability: "degraded",
        available: false,
        degraded: false,
        checkedAt: new Date().toISOString(),
        dependencyChain: [RuntimeDependencyIds.pythonRuntime, RuntimeDependencyIds.documentConversionRuntime],
        fallbackDependencyIds: [],
        usedFallback: false,
        detail: "Document conversion runtime is starting.",
        remediationHints: ["Wait for the runtime to finish starting."],
      }),
      refresh: async () => { throw new Error("unused"); },
      invalidate: () => undefined,
      invalidateAll: () => undefined,
      listRegistrations: () => [],
    });

    await expect(gateway.convert({
      file: { name: "report.pdf", mimeType: "application/pdf", sizeInBytes: 4 },
      content: new Uint8Array([1, 2, 3]),
      outputFormat: "markdown",
    })).rejects.toBeInstanceOf(RuntimeDependencyUnavailableError);
    expect(delegate.convert).not.toHaveBeenCalled();
  });
});

