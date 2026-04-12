import { describe, expect, it } from "bun:test";
import { createImageCrossStudioHandoffContract } from "../ImageStudioHandoffContract";

describe("ImageStudioHandoffContract", () => {
  it("creates a normalized cross-studio image handoff contract with runtime and lineage fields", () => {
    const contract = createImageCrossStudioHandoffContract({
      contractVersion: "1.0.0",
      handoffId: "handoff:image:1",
      sourceStudioType: "data-studio",
      sourceStudioId: "data-studio:default",
      targetStudioType: "system-studio",
      targetStudioId: "system-studio:default",
      primaryAsset: { assetId: "asset:dataset:image-input", versionId: "asset:dataset:image-input:v1" },
      referencedAssets: [
        { assetId: "asset:dataset:image-input", versionId: "asset:dataset:image-input:v1" },
        { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
        { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
      ],
      datasetInstances: [
        {
          referenceId: "input-store",
          instanceId: "instance:input-store",
          dataset: { assetId: "asset:dataset:image-input", versionId: "asset:dataset:image-input:v1" },
          role: "input",
          schemaIntentId: "media-input",
        },
      ],
      workflow: {
        workflow: { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
        bindingId: "binding:primary",
      },
      systemBinding: {
        system: { assetId: "asset:system:reference-image", versionId: "asset:system:reference-image:v5" },
        workflow: {
          workflow: { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
          bindingId: "binding:primary",
        },
        datasets: [
          {
            referenceId: "output-store",
            instanceId: "instance:output-store",
            dataset: { assetId: "asset:dataset:image-output", versionId: "asset:dataset:image-output:v2" },
            role: "output",
            schemaIntentId: "media-output",
          },
        ],
      },
      runtimeInput: {
        context: {
          selectedImages: [{ selectionId: "selected-image-1", imageId: "image:1", assetRef: { assetId: "asset:image:1" } }],
          parameters: { instruction: "make it warm" },
          datasets: [{ referenceId: "output-store", instanceId: "instance:output-store", datasetAssetId: "asset:dataset:image-output" }],
          runtime: { sourceStudio: "system-studio" },
        },
        workflow: {
          workflow: { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
          bindingId: "binding:primary",
        },
        systemBinding: {
          system: { assetId: "asset:system:reference-image", versionId: "asset:system:reference-image:v5" },
          workflow: {
            workflow: { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
            bindingId: "binding:primary",
          },
          datasets: [
            {
              referenceId: "output-store",
              instanceId: "instance:output-store",
              dataset: { assetId: "asset:dataset:image-output", versionId: "asset:dataset:image-output:v2" },
              role: "output",
            },
          ],
        },
        trace: {
          handoffId: "handoff:image:1",
          traceId: "trace:image:1",
          sourceStudioType: "system-studio",
          sourceStudioId: "system-studio:default",
        },
      },
      runtimeOutput: {
        runId: "run:image:1",
        status: "succeeded",
        outputs: [{ outputId: "output:1", image: { assetId: "asset:image:result-1", versionId: "asset:image:result-1:v1" }, targetDatasetReferenceId: "output-store" }],
        issues: [],
        trace: {
          handoffId: "handoff:image:1",
          traceId: "trace:image:1",
          workflowAssetId: "asset:workflow:image-to-image",
          workflowVersionId: "asset:workflow:image-to-image:v3",
          systemAssetId: "asset:system:reference-image",
          systemVersionId: "asset:system:reference-image:v5",
        },
      },
      events: [
        {
          eventId: "event:1",
          eventType: "runtime-completed",
          occurredAt: "2026-04-02T00:00:00.000Z",
          traceId: "trace:image:1",
          handoffId: "handoff:image:1",
          payload: { runId: "run:image:1" },
        },
      ],
      persistedRelationships: [
        {
          relationshipId: "rel:1",
          relationshipType: "runtime-output-link",
          sourceRef: { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
          targetRef: { assetId: "asset:image:result-1", versionId: "asset:image:result-1:v1" },
          datasetInstanceRef: {
            referenceId: "output-store",
            instanceId: "instance:output-store",
            dataset: { assetId: "asset:dataset:image-output", versionId: "asset:dataset:image-output:v2" },
            role: "output",
          },
          workflowRef: {
            workflow: { assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v3" },
            bindingId: "binding:primary",
          },
          systemRef: { assetId: "asset:system:reference-image", versionId: "asset:system:reference-image:v5" },
          traceId: "trace:image:1",
          handoffId: "handoff:image:1",
          createdAt: "2026-04-02T00:00:01.000Z",
          metadata: { source: "runtime" },
        },
      ],
    });

    expect(contract.referencedAssets).toHaveLength(2);
    expect(contract.runtimeInput.trace.traceId).toBe("trace:image:1");
    expect(contract.runtimeOutput?.outputs[0]?.targetDatasetReferenceId).toBe("output-store");
    expect(contract.persistedRelationships[0]?.traceId).toBe("trace:image:1");
  });

  it("rejects duplicate dataset reference identities", () => {
    expect(() => createImageCrossStudioHandoffContract({
      contractVersion: "1.0.0",
      handoffId: "handoff:image:dup",
      sourceStudioType: "data-studio",
      sourceStudioId: "data-studio:default",
      targetStudioType: "workflow-studio",
      targetStudioId: "workflow-studio:default",
      primaryAsset: { assetId: "asset:dataset:image-input", versionId: "asset:dataset:image-input:v1" },
      referencedAssets: [],
      datasetInstances: [
        {
          referenceId: "output-store",
          instanceId: "instance:1",
          dataset: { assetId: "asset:dataset:image-output", versionId: "asset:dataset:image-output:v1" },
          role: "output",
        },
        {
          referenceId: "output-store",
          instanceId: "instance:2",
          dataset: { assetId: "asset:dataset:image-output", versionId: "asset:dataset:image-output:v1" },
          role: "output",
        },
      ],
      workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" } },
      systemBinding: {
        system: { assetId: "asset:system:image", versionId: "asset:system:image:v1" },
        workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" } },
        datasets: [],
      },
      runtimeInput: {
        context: { selectedImages: [], parameters: {}, datasets: [], runtime: {} },
        workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" } },
        systemBinding: {
          system: { assetId: "asset:system:image", versionId: "asset:system:image:v1" },
          workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" } },
          datasets: [],
        },
        trace: {
          handoffId: "handoff:image:dup",
          traceId: "trace:image:dup",
          sourceStudioType: "workflow-studio",
          sourceStudioId: "workflow-studio:default",
        },
      },
      events: [],
      persistedRelationships: [],
    })).toThrow("Duplicate dataset instance reference 'output-store'.");
  });
});
