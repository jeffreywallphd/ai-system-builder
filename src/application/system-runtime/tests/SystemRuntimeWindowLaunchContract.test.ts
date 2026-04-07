import { describe, expect, it } from "bun:test";
import {
  createSystemRuntimeWindowLaunchContract,
  parseSystemRuntimeWindowLaunchContract,
  serializeSystemRuntimeWindowLaunchContract,
} from "../SystemRuntimeWindowLaunchContract";

describe("SystemRuntimeWindowLaunchContract", () => {
  it("creates a normalized runtime window launch contract", () => {
    const contract = createSystemRuntimeWindowLaunchContract({
      contractVersion: "ai-loom.runtime-window-launch.v1",
      launchId: "runtime-window:launch-1",
      createdAt: "2026-04-03T10:00:00.000Z",
      launchTarget: {
        targetKind: "standalone-system",
        systemAssetId: "asset:system:image",
        pageBindingId: "system-page:image-manipulation",
      },
      resolution: {
        studioId: "system-studio",
        draftId: "draft-1",
        systemAssetId: "asset:system:image",
      },
      runtimeContextPayload: {
        source: "system-studio",
      },
      datasetBindings: [
        {
          bindingId: "output-image-dataset",
          datasetBindingId: "output-image-dataset",
          datasetAssetId: "asset:dataset:image-output",
          sharingScope: "shared",
          metadata: {
            role: "output",
          },
        },
      ],
      initialSelection: {
        selectedDatasetBindingId: "output-image-dataset",
        activePreviewRole: "output",
        selectedRecordIds: {
          "output-image-dataset": "record-1",
        },
      },
      launchMode: "interactive",
      windowIntent: {
        intent: "runtime-editor",
        focus: "foreground",
      },
      expectedResult: {
        expectedResult: "execution-summary",
        metadata: {
          channel: "studio",
        },
      },
    });

    expect(contract.launchTarget.pageBindingId).toBe("system-page:image-manipulation");
    expect(contract.initialSelection.selectedRecordIds["output-image-dataset"]).toBe("record-1");
    expect(contract.expectedResult.expectedResult).toBe("execution-summary");
  });

  it("rejects invalid storage references in dataset bindings", () => {
    expect(() => createSystemRuntimeWindowLaunchContract({
      contractVersion: "ai-loom.runtime-window-launch.v1",
      launchId: "runtime-window:launch-invalid",
      createdAt: "2026-04-03T10:00:00.000Z",
      launchTarget: {
        targetKind: "standalone-system",
        systemAssetId: "asset:system:image",
        pageBindingId: "system-page:image-manipulation",
      },
      resolution: {
        studioId: "system-studio",
        draftId: "draft-1",
        systemAssetId: "asset:system:image",
      },
      runtimeContextPayload: {},
      datasetBindings: [
        {
          bindingId: "output-image-dataset",
          datasetBindingId: "output-image-dataset",
          datasetAssetId: "asset:dataset:image-output",
          storageInstanceRef: "C:\\raw\\path",
          sharingScope: "shared",
          metadata: {},
        },
      ],
      initialSelection: {},
      launchMode: "interactive",
      windowIntent: {
        intent: "runtime-editor",
        focus: "foreground",
      },
      expectedResult: {
        expectedResult: "execution-summary",
        metadata: {},
      },
    })).toThrow("must use the storage-instance:// scheme");
  });

  it("serializes and parses contracts for transport", () => {
    const basis = createSystemRuntimeWindowLaunchContract({
      contractVersion: "ai-loom.runtime-window-launch.v1",
      launchId: "runtime-window:launch-serialize",
      createdAt: "2026-04-03T10:00:00.000Z",
      launchTarget: {
        targetKind: "standalone-system",
        systemAssetId: "asset:system:image",
        pageBindingId: "system-page:image-manipulation",
      },
      resolution: {
        studioId: "system-studio",
        draftId: "draft-1",
        systemAssetId: "asset:system:image",
      },
      runtimeContextPayload: {},
      datasetBindings: [],
      initialSelection: {},
      launchMode: "interactive",
      windowIntent: {
        intent: "runtime-editor",
        focus: "foreground",
      },
      expectedResult: {
        expectedResult: "execution-summary",
        metadata: {},
      },
    });

    const serialized = serializeSystemRuntimeWindowLaunchContract(basis);
    const parsed = parseSystemRuntimeWindowLaunchContract(serialized);
    expect(parsed?.launchId).toBe("runtime-window:launch-serialize");
    expect(parsed?.launchTarget.systemAssetId).toBe("asset:system:image");
  });
});
