import { describe, expect, it } from "bun:test";
import { createImageCrossStudioHandoffContract } from "../../../domain/studio-handoff/ImageStudioHandoffContract";
import { ImageStudioReferenceResolver, ImageStudioReferenceResolutionIssueCodes } from "../ImageStudioReferenceResolver";

function createContract() {
  return createImageCrossStudioHandoffContract({
    contractVersion: "1.0.0",
    handoffId: "handoff:image:resolver",
    sourceStudioType: "data-studio",
    sourceStudioId: "data-studio:default",
    targetStudioType: "system-studio",
    targetStudioId: "system-studio:default",
    primaryAsset: { assetId: "asset:dataset:input", versionId: "asset:dataset:input:v1" },
    referencedAssets: [{ assetId: "asset:workflow:image", versionId: "asset:workflow:image:v2" }],
    datasetInstances: [{
      referenceId: "input-store",
      instanceId: "instance:input",
      dataset: { assetId: "asset:dataset:input", versionId: "asset:dataset:input:v1" },
      role: "input",
      schemaIntentId: "media-input",
    }],
    workflow: {
      workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v2" },
      bindingId: "binding:main",
    },
    systemBinding: {
      system: { assetId: "asset:system:image", versionId: "asset:system:image:v3" },
      workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v2" }, bindingId: "binding:main" },
      datasets: [{
        referenceId: "output-store",
        instanceId: "instance:output",
        dataset: { assetId: "asset:dataset:output", versionId: "asset:dataset:output:v1" },
        role: "output",
        schemaIntentId: "media-output",
      }],
    },
    runtimeInput: {
      context: { selectedImages: [], parameters: {}, datasets: [], runtime: {} },
      workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v2" }, bindingId: "binding:main" },
      systemBinding: {
        system: { assetId: "asset:system:image", versionId: "asset:system:image:v3" },
        workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v2" }, bindingId: "binding:main" },
        datasets: [],
      },
      trace: {
        handoffId: "handoff:image:resolver",
        traceId: "trace:image:resolver",
        sourceStudioType: "system-studio",
        sourceStudioId: "system-studio:default",
      },
    },
    events: [],
    persistedRelationships: [],
  });
}

describe("ImageStudioReferenceResolver", () => {
  it("resolves canonical image-slice identities across assets, datasets, workflow binding, and runtime stores", async () => {
    const resolver = new ImageStudioReferenceResolver({
      resolveAsset: (reference) => ({ assetId: reference.assetId, versionId: reference.versionId, compatible: true }),
      resolveDatasetInstance: (reference) => ({
        instanceId: reference.instanceId,
        datasetAssetId: reference.dataset.assetId,
        datasetVersionId: reference.dataset.versionId,
        schemaIntentId: reference.schemaIntentId,
        compatible: true,
      }),
      resolveWorkflowBinding: () => ({ bindingId: "binding:main", compatible: true }),
    });

    const result = await resolver.resolve(createContract());
    expect(result.ok).toBeTrue();
    expect(result.issues).toEqual([]);
    expect(result.resolved?.runtimeOwnedStores.map((entry) => entry.referenceId)).toEqual(["output-store"]);
  });

  it("surfaces missing, ambiguous, and incompatible resolution issues with inspectable paths", async () => {
    const resolver = new ImageStudioReferenceResolver({
      resolveAsset: (reference) => {
        if (reference.assetId === "asset:dataset:input") {
          return undefined;
        }
        if (reference.assetId === "asset:workflow:image") {
          return {
            assetId: reference.assetId,
            versionId: reference.versionId,
            compatible: true,
            candidates: ["asset:workflow:image@v2", "asset:workflow:image@v2-copy"],
          };
        }
        return { assetId: reference.assetId, versionId: reference.versionId, compatible: false };
      },
      resolveDatasetInstance: (reference) => ({
        instanceId: `${reference.instanceId}:other`,
        datasetAssetId: reference.dataset.assetId,
        datasetVersionId: reference.dataset.versionId,
        compatible: true,
      }),
      resolveWorkflowBinding: () => ({ bindingId: "binding:main", compatible: false }),
    });

    const result = await resolver.resolve(createContract());
    expect(result.ok).toBeFalse();
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      ImageStudioReferenceResolutionIssueCodes.missing,
      ImageStudioReferenceResolutionIssueCodes.ambiguous,
      ImageStudioReferenceResolutionIssueCodes.incompatible,
      ImageStudioReferenceResolutionIssueCodes.broken,
    ]));
    expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "primaryAsset",
      "workflow.workflow",
      "workflow.bindingId",
      "datasetInstances[0]",
    ]));
  });
});
