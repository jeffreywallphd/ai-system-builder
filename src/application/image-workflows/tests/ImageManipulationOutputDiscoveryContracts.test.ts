import { describe, expect, it } from "bun:test";
import {
  createImageManipulationOutputCollectionFailure,
  ImageManipulationCollectedExecutionStatuses,
  ImageManipulationOutputDiscoveryContractsSchemaVersion,
  ImageManipulationOutputPersistenceStatuses,
  parseImageManipulationCollectedExecutionResult,
  parseImageManipulationOutputDiscoverySnapshot,
  validateImageManipulationCollectedExecutionResult,
  validateImageManipulationOutputDiscoverySnapshot,
  type ImageManipulationCollectedExecutionResult,
  type ImageManipulationOutputDiscoverySnapshot,
} from "../ports";

function createDiscoverySnapshot(): ImageManipulationOutputDiscoverySnapshot {
  return {
    schemaVersion: ImageManipulationOutputDiscoveryContractsSchemaVersion,
    discoveryId: "discovery:run-1",
    executionJobId: "job:run-1",
    runId: "run-1",
    workspaceId: "workspace-alpha",
    backendFamily: "adapter.comfyui.image-manipulation",
    discoveredAt: "2026-04-08T19:00:00.000Z",
    outputs: [{
      descriptorId: "output-1",
      discoveredAt: "2026-04-08T19:00:00.000Z",
      outputRole: "primary",
      outputIndex: 0,
      outputGroupId: "group-primary",
      slotMatch: {
        status: "matched",
        outputId: "generated-image",
        expectedBackendField: "outputs.images[0]",
        logicalTargetReference: "dataset-instance://system-output-images",
      },
      media: {
        mediaKind: "image",
        mimeType: "image/png",
        extension: "png",
        byteSize: 1456789,
        width: 1024,
        height: 1024,
        hashSha256: "abc123",
      },
      temporaryReference: {
        kind: "backend-object-handle",
        backendFamily: "adapter.comfyui.image-manipulation",
        backendExecutionId: "comfy:run-1",
        objectHandle: "comfy-output://run-1/outputs/1",
      },
      sourceInputAssetReference: "asset://image/source-1",
    }],
    summary: {
      discoveredCount: 1,
      matchedSlotCount: 1,
      unmatchedSlotCount: 0,
    },
  };
}

function createCollectedResult(): ImageManipulationCollectedExecutionResult {
  const discovery = createDiscoverySnapshot();
  return {
    schemaVersion: ImageManipulationOutputDiscoveryContractsSchemaVersion,
    collectionId: "collection:run-1",
    discoveryId: discovery.discoveryId,
    executionJobId: discovery.executionJobId,
    runId: discovery.runId,
    workspaceId: discovery.workspaceId,
    collectedAt: "2026-04-08T19:00:05.000Z",
    status: ImageManipulationCollectedExecutionStatuses.collected,
    discoveredOutputs: discovery.outputs,
    records: [{
      descriptorId: "output-1",
      temporaryReference: {
        kind: "backend-object-handle",
        backendFamily: "adapter.comfyui.image-manipulation",
        backendExecutionId: "comfy:run-1",
        objectHandle: "comfy-output://run-1/outputs/1",
      },
      persistence: {
        status: ImageManipulationOutputPersistenceStatuses.persisted,
        logicalAsset: {
          assetId: "asset:image:generated-1",
          logicalAssetReference: "asset://image/generated-1",
          lineageRecordId: "lineage:run-1:output-1",
          persistedAt: "2026-04-08T19:00:07.000Z",
          previewAssetReference: "asset://image/generated-1:preview",
        },
      },
      previewCandidate: true,
    }],
    summary: {
      discoveredCount: 1,
      collectedCount: 1,
      persistedCount: 1,
      notPersistedCount: 0,
      failedCount: 0,
    },
  };
}

describe("ImageManipulationOutputDiscoveryContracts", () => {
  it("validates output discovery snapshots with temporary backend references and slot matches", () => {
    const parsed = validateImageManipulationOutputDiscoverySnapshot(createDiscoverySnapshot());
    expect(parsed.outputs).toHaveLength(1);
    expect(parsed.outputs[0]?.temporaryReference.objectHandle).toBe("comfy-output://run-1/outputs/1");
    expect(parsed.outputs[0]?.slotMatch?.outputId).toBe("generated-image");
    expect(Object.isFrozen(parsed)).toBeTrue();
  });

  it("rejects raw filesystem path leakage in temporary backend references", () => {
    const invalid = createDiscoverySnapshot();
    invalid.outputs = [{
      ...invalid.outputs[0]!,
      temporaryReference: {
        ...invalid.outputs[0]!.temporaryReference,
        objectHandle: "C:\\comfy\\outputs\\image.png",
      },
    }];

    expect(() => validateImageManipulationOutputDiscoverySnapshot(invalid)).toThrow(
      "Temporary backend references cannot contain raw filesystem paths.",
    );
  });

  it("validates collected execution results and keeps temporary references separate from logical assets", () => {
    const parsed = validateImageManipulationCollectedExecutionResult(createCollectedResult());
    expect(parsed.records[0]?.temporaryReference.kind).toBe("backend-object-handle");
    expect(parsed.records[0]?.persistence.status).toBe("persisted");
    if (parsed.records[0]?.persistence.status === "persisted") {
      expect(parsed.records[0].persistence.logicalAsset.assetId).toBe("asset:image:generated-1");
    }
  });

  it("rejects mismatched collection summaries and unsupported schema versions", () => {
    const invalid = createCollectedResult();
    invalid.summary = {
      ...invalid.summary,
      persistedCount: 0,
    };
    expect(() => validateImageManipulationCollectedExecutionResult(invalid)).toThrow(
      "Collection summary.persistedCount must equal persisted record count.",
    );

    expect(() => parseImageManipulationCollectedExecutionResult({
      schemaVersion: "0.9.0",
      collectionId: "collection:run-1",
    })).toThrow("unsupported-image-manipulation-collected-result-schema-version:0.9.0");
  });

  it("requires normalized collectionFailure for partially-collected and failed statuses", () => {
    const partial = createCollectedResult();
    partial.status = ImageManipulationCollectedExecutionStatuses.partiallyCollected;
    partial.summary = {
      ...partial.summary,
      failedCount: 1,
      persistedCount: 0,
    };
    partial.records = [{
      ...partial.records[0]!,
      persistence: {
        status: ImageManipulationOutputPersistenceStatuses.failed,
        errorCode: "persist-failed",
        message: "Failed to persist output.",
        retryable: true,
      },
    }];
    partial.collectionFailure = createImageManipulationOutputCollectionFailure({
      failedAt: "2026-04-08T19:00:06.000Z",
      rawMessage: "Partial output persistence failure",
      partialProgressObserved: true,
      partialOutputCount: 1,
    });

    const parsedPartial = validateImageManipulationCollectedExecutionResult(partial);
    expect(parsedPartial.collectionFailure?.category).toBe("output");

    const failed = createCollectedResult();
    failed.status = ImageManipulationCollectedExecutionStatuses.failed;
    failed.summary = {
      ...failed.summary,
      failedCount: 1,
      persistedCount: 0,
    };
    failed.records = [{
      ...failed.records[0]!,
      persistence: {
        status: ImageManipulationOutputPersistenceStatuses.failed,
        errorCode: "collect-failed",
        message: "Output retrieval failed.",
        retryable: true,
      },
    }];

    expect(() => validateImageManipulationCollectedExecutionResult(failed)).toThrow(
      "Failed collected execution result requires collectionFailure.",
    );
  });

  it("parses schema-versioned discovery and collection records", () => {
    const discovery = parseImageManipulationOutputDiscoverySnapshot(createDiscoverySnapshot());
    const collected = parseImageManipulationCollectedExecutionResult(createCollectedResult());

    expect(discovery?.schemaVersion).toBe(ImageManipulationOutputDiscoveryContractsSchemaVersion);
    expect(collected?.schemaVersion).toBe(ImageManipulationOutputDiscoveryContractsSchemaVersion);
  });
});
