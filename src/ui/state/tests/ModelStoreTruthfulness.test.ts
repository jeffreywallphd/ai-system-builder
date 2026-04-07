import { describe, expect, it } from "bun:test";
import { ModelStore } from "../ModelStore";

describe("ModelStore truthfulness", () => {
  it("captures managed model library inspection alongside installed models", async () => {
    const store = new ModelStore({
      modelService: {
        listInstalledModels: async () => [],
        inspectManagedLibrary: async () => ({
          mode: "browser-download-fallback",
          location: "dev/models",
          detail: "Browser fallback only.",
          sourceOfTruth: "browser-download-fallback",
          recordedAt: new Date("2025-01-01T00:00:00.000Z"),
          items: [],
        }),
      } as never,
    });

    await store.refreshInstalled();

    expect(store.getState().managedLibrary?.mode).toBe("browser-download-fallback");
    expect(store.getState().managedLibrary?.detail).toContain("Browser fallback");
  });
});
