import { describe, expect, it } from "bun:test";
import { createComfyImageManipulationDefaultConfig } from "@application/system-studio/ComfyImageManipulationPropertySchema";
import { createImageManipulationRuntimeWindowLaunchContract } from "@application/system-runtime/SystemRuntimeWindowLaunchResolver";
import {
  RuntimeWindowSessionPersistenceVersion,
  SystemRuntimeWindowSessionPersistenceService,
} from "../SystemRuntimeWindowSessionPersistenceService";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("SystemRuntimeWindowSessionPersistenceService", () => {
  it("persists and restores runtime-window session state with logical scope identity", () => {
    const storage = new MemoryStorage();
    const service = new SystemRuntimeWindowSessionPersistenceService(storage);
    const launch = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "studio-system",
      draftId: "draft-1",
      sessionId: "session-1",
      systemAssetId: "asset:system:image",
    });
    const scope = service.resolveScope({ launch });

    service.save(Object.freeze({
      schemaVersion: RuntimeWindowSessionPersistenceVersion,
      scope,
      launch: Object.freeze({
        launchId: launch.launchId,
        runtimeSessionId: "session-1",
      }),
      resolvedPage: Object.freeze({
        systemAssetId: "asset:system:image",
        pageBindingId: "system-page:image-manipulation",
        pageId: "page-main",
        workflowTemplateAssetId: "asset:workflow:image-runtime",
        workflowTemplateVersionId: "asset:workflow:image-runtime:v1",
        datasetBindingIds: Object.freeze(["input-image-dataset", "output-image-dataset"]),
      }),
      property: Object.freeze({
        presetId: "balanced-default",
        config: createComfyImageManipulationDefaultConfig(),
      }),
      selection: Object.freeze({
        selectedDatasetBindingId: "output-image-dataset",
        activePreviewRole: "output" as const,
        selectedRecordIds: Object.freeze({
          "input-image-dataset": "record:source:1",
          "output-image-dataset": "record:output:4",
        }),
        gallerySelectionRecordIds: Object.freeze(["record:output:4"]),
      }),
      panelState: Object.freeze({
        runAdvancedDetailsOpen: true,
      }),
      updatedAt: "2026-04-04T00:00:00.000Z",
    }));

    const restored = service.load(scope);
    expect(restored).toBeDefined();
    expect(restored?.scope.systemAssetId).toBe("asset:system:image");
    expect(restored?.selection.activePreviewRole).toBe("output");
    expect(restored?.selection.selectedRecordIds["output-image-dataset"]).toBe("record:output:4");
    expect(restored?.panelState.runAdvancedDetailsOpen).toBeTrue();
  });

  it("ignores malformed or version-mismatched persisted payloads", () => {
    const storage = new MemoryStorage();
    const service = new SystemRuntimeWindowSessionPersistenceService(storage);
    const launch = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "studio-system",
      draftId: "draft-1",
      systemAssetId: "asset:system:image",
    });
    const scope = service.resolveScope({ launch });
    const key = service.resolveStorageKey(scope);
    storage.setItem(key, JSON.stringify({
      schemaVersion: "0.9.0",
      scope,
    }));

    const restored = service.load(scope);
    expect(restored).toBeUndefined();
  });
});

