import { describe, expect, it } from "bun:test";
import { createComfyImageManipulationDefaultConfig } from "@application/system-studio/ComfyImageManipulationPropertySchema";
import { ImageManipulationSystemTemplate } from "@application/system-studio/ImageManipulationSystemTemplate";
import { createImageManipulationRuntimeWindowLaunchContract } from "@application/system-runtime/SystemRuntimeWindowLaunchResolver";
import { serializeSystemRuntimeWindowLaunchContract } from "@application/system-runtime/SystemRuntimeWindowLaunchContract";
import { parseLaunchContractFromSearch } from "../../components/studio-shell/SystemRuntimeWindowHost";
import { SystemRuntimeWindowHydrationService } from "../SystemRuntimeWindowHydrationService";
import {
  RuntimeWindowSessionPersistenceVersion,
  SystemRuntimeWindowSessionPersistenceService,
} from "../SystemRuntimeWindowSessionPersistenceService";
import { SystemRuntimeWindowRestoreService } from "../SystemRuntimeWindowRestoreService";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("System runtime window lifecycle", () => {
  it("normalizes launch payload and parses runtime-window query launch data", () => {
    const launchContract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-lifecycle-1",
      sessionId: "session-1",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
    });
    const query = `?runtimeWindowLaunch=${encodeURIComponent(serializeSystemRuntimeWindowLaunchContract(launchContract))}`;
    const parsed = parseLaunchContractFromSearch(query);

    expect(parsed.issue).toBeUndefined();
    expect(parsed.launchContract?.windowIntent.reuseWindowKey).toBe("system-studio:system-page:image-manipulation");
    expect(parsed.launchContract?.datasetBindings.map((entry) => entry.bindingId)).toEqual([
      "input-image-dataset",
      "output-image-dataset",
      "reference-image-dataset",
    ]);
  });

  it("hydrates runtime defaults with dataset/storage bindings and run-ready property state", () => {
    const launchContract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-lifecycle-2",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
    });
    const hydration = new SystemRuntimeWindowHydrationService().hydrate({ launchContract });

    expect(hydration.ok).toBeTrue();
    expect(hydration.state).toBeDefined();
    expect(hydration.state?.resolvedWorkflowTemplate.workflowTemplateAssetId).toBe(
      ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
    );
    expect(hydration.state?.datasetBindings.map((entry) => entry.bindingId)).toEqual([
      "input-image-dataset",
      "output-image-dataset",
      "reference-image-dataset",
    ]);
    expect(hydration.state?.storageInstances.length).toBe(3);
    expect(hydration.state?.storageInstances.every((entry) => entry.sharingScope === "shared")).toBeTrue();
    expect(hydration.state?.propertySchema.presetId).toBe("balanced-default");
    expect(hydration.state?.propertySchema.defaults).toBeDefined();
  });

  it("restores persisted runtime session overrides into reopened launch contracts", () => {
    const storage = new MemoryStorage();
    const persistence = new SystemRuntimeWindowSessionPersistenceService(storage);
    const launchContract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-lifecycle-3",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
    });
    const scope = persistence.resolveScope({ launch: launchContract });
    persistence.save(Object.freeze({
      schemaVersion: RuntimeWindowSessionPersistenceVersion,
      scope,
      launch: Object.freeze({
        launchId: "runtime-window:previous",
        runtimeSessionId: "runtime-session-1",
      }),
      resolvedPage: Object.freeze({
        systemAssetId: launchContract.launchTarget.systemAssetId,
        pageBindingId: launchContract.launchTarget.pageBindingId,
        datasetBindingIds: Object.freeze(["input-image-dataset", "output-image-dataset", "reference-image-dataset"]),
      }),
      property: Object.freeze({
        presetId: "balanced-default",
        config: createComfyImageManipulationDefaultConfig(),
      }),
      selection: Object.freeze({
        selectedDatasetBindingId: "output-image-dataset",
        activePreviewRole: "output" as const,
        selectedRecordIds: Object.freeze({
          "output-image-dataset": "record-output-4",
        }),
        gallerySelectionRecordIds: Object.freeze(["record-output-4"]),
      }),
      panelState: Object.freeze({
        runAdvancedDetailsOpen: true,
      }),
      updatedAt: "2026-04-04T00:00:00.000Z",
    }));

    const restoreService = new SystemRuntimeWindowRestoreService(new SystemRuntimeWindowHydrationService(), persistence);
    const reopenRequest = restoreService.buildReopenRequest(Object.freeze({ launchContract }));
    const restored = restoreService.restore({ launchContract: reopenRequest.launchContract });

    expect(reopenRequest.launchContract.resolution.sessionId).toBe("runtime-session-1");
    expect(reopenRequest.launchContract.initialSelection.activePreviewRole).toBe("output");
    expect(restored.persistedSession?.selection.selectedRecordIds["output-image-dataset"]).toBe("record-output-4");
    expect(restored.state?.initialSelection.selectedRecordIds["output-image-dataset"]).toBe("record-output-4");
  });

  it("degrades gracefully when persisted references are stale or launch data is invalid", () => {
    const storage = new MemoryStorage();
    const persistence = new SystemRuntimeWindowSessionPersistenceService(storage);
    const launchContract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-lifecycle-4",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
    });
    const scope = persistence.resolveScope({ launch: launchContract });
    persistence.save(Object.freeze({
      schemaVersion: RuntimeWindowSessionPersistenceVersion,
      scope,
      launch: Object.freeze({
        launchId: "runtime-window:previous",
      }),
      resolvedPage: Object.freeze({
        systemAssetId: launchContract.launchTarget.systemAssetId,
        pageBindingId: launchContract.launchTarget.pageBindingId,
        datasetBindingIds: Object.freeze(["stale-binding"]),
      }),
      property: Object.freeze({
        presetId: "balanced-default",
        config: createComfyImageManipulationDefaultConfig(),
      }),
      selection: Object.freeze({
        selectedDatasetBindingId: "stale-binding",
        activePreviewRole: "output" as const,
        selectedRecordIds: Object.freeze({
          "stale-binding": "record-stale-1",
          "output-image-dataset": "record-output-7",
        }),
        gallerySelectionRecordIds: Object.freeze(["record-stale-1"]),
      }),
      panelState: Object.freeze({
        runAdvancedDetailsOpen: false,
      }),
      updatedAt: "2026-04-04T00:00:00.000Z",
    }));

    const restoreService = new SystemRuntimeWindowRestoreService(new SystemRuntimeWindowHydrationService(), persistence);
    const restored = restoreService.restore({ launchContract });
    const invalidLaunch = parseLaunchContractFromSearch("?runtimeWindowLaunch=%7Bbroken");

    expect(restored.ok).toBeTrue();
    expect(restored.state).toBeDefined();
    expect(restored.persistedSession?.selection.selectedDatasetBindingId).toBeUndefined();
    expect(restored.persistedSession?.selection.selectedRecordIds["stale-binding"]).toBeUndefined();
    expect(restored.issues.some((issue) => issue.code === "runtime-window.restore.selection-binding-stale")).toBeTrue();
    expect(restored.issues.some((issue) => issue.code === "runtime-window.restore.selected-dataset-binding-stale")).toBeTrue();
    expect(invalidLaunch.launchContract).toBeUndefined();
    expect(invalidLaunch.issue).toBe("runtime-window.launch-contract.invalid");
  });
});

