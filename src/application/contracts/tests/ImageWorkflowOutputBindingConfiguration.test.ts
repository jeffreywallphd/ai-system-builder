import { describe, expect, it } from "bun:test";
import { createDatasetInstance } from "@domain/system-runtime/DatasetInstanceDomain";
import { createImageToImageWorkflowAsset } from "../ImageToImageWorkflowAsset";
import {
  createImageWorkflowOutputBindingConfiguration,
  createWorkflowOutputBindingDescriptorsFromAssetConfiguration,
} from "../ImageWorkflowOutputBindingConfiguration";
import { resolveWorkflowOutputBindingWritePlan } from "../../workflow-studio/WorkflowOutputBindingResolutionService";
import { materializeWorkflowOutputRecords } from "../../workflow-studio/WorkflowOutputRecordMaterializationService";
import type { SystemDatasetInstanceService } from "../../system-runtime/SystemDatasetInstanceService";

function createServiceStub(instances: Record<string, ReturnType<typeof createDatasetInstance>>): SystemDatasetInstanceService {
  return {
    getDatasetInstance: ({ instanceId }: { systemId: string; instanceId: string }) => instances[instanceId],
    ensureWorkflowOutputTargetInstance: async ({ targetType }: { targetType: string }) => {
      const mapped = Object.values(instances).find((entry) => entry.purpose?.includes(targetType.split("-")[0]));
      if (!mapped) {
        throw new Error("dataset-instance-not-found");
      }
      return mapped;
    },
  } as unknown as SystemDatasetInstanceService;
}

describe("ImageWorkflowOutputBindingConfiguration", () => {
  it("exposes explicit output binding declarations on image workflow assets", () => {
    const asset = createImageToImageWorkflowAsset();

    expect(asset.outputBindings.bindings.map((entry) => entry.targetType)).toEqual([
      "output-dataset",
      "history-dataset",
      "comparison-dataset",
    ]);
    expect(asset.outputBindings.bindings[2]?.groupBy).toContain("comparison");
  });

  it("stays compatible with runtime resolution and record materialization", async () => {
    const config = createImageWorkflowOutputBindingConfiguration({
      bindings: [
        { bindingId: "b.output", outputId: "images", targetType: "output-dataset", targetId: "target:output", datasetInstanceId: "instance:output" },
        { bindingId: "b.history", outputId: "images", targetType: "history-dataset", targetId: "target:history", datasetInstanceId: "instance:history", writeMode: "append" },
        { bindingId: "b.compare", outputId: "images", targetType: "comparison-dataset", targetId: "target:compare", datasetInstanceId: "instance:compare", groupBy: "set:a" },
      ],
    });

    const descriptors = createWorkflowOutputBindingDescriptorsFromAssetConfiguration({
      configuration: config,
      workflowRun: {
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v1",
        workflowRunId: "run:100",
      },
      persistence: { systemId: "system:1" },
      sourceContext: {
        sourceDatasetAssetId: "asset:dataset:source",
        sourceDatasetInstanceId: "instance:source",
        sourceRecordIds: ["record:1"],
      },
    });

    const service = createServiceStub({
      "instance:output": createDatasetInstance({ instanceId: "instance:output", systemId: "system:1", datasetAssetId: "asset:dataset:output", role: "output-store", lifecycleStatus: "ready", runtimeStatus: "idle" }),
      "instance:history": createDatasetInstance({ instanceId: "instance:history", systemId: "system:1", datasetAssetId: "asset:dataset:history", role: "output-store", lifecycleStatus: "ready", runtimeStatus: "idle" }),
      "instance:compare": createDatasetInstance({ instanceId: "instance:compare", systemId: "system:1", datasetAssetId: "asset:dataset:compare", role: "output-store", lifecycleStatus: "ready", runtimeStatus: "idle" }),
    });

    const writePlan = await resolveWorkflowOutputBindingWritePlan({
      systemId: "system:1",
      bindings: descriptors,
      datasetInstanceService: service,
    });

    expect(writePlan.ready).toBeTrue();

    const materialized = materializeWorkflowOutputRecords({
      writePlan: writePlan.plan,
      workflowRun: {
        runId: "run:100",
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v1",
      },
      producedImages: [{
        outputId: "images",
        assetRef: { kind: "generated-output", outputId: "out:1", stableId: "stable:1" },
        width: 256,
        height: 256,
        format: "png",
      }],
    });

    expect(materialized.records).toHaveLength(3);
    expect(materialized.records.every((record) => Boolean((record.record.metadata.lineage as Record<string, unknown>).bindingTarget))).toBeTrue();
  });
});

