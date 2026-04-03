import { describe, expect, it } from "bun:test";
import { createDatasetInstance } from "../../../domain/system-runtime/DatasetInstanceDomain";
import {
  createWorkflowOutputBindingDescriptor,
  WorkflowOutputBindingIntents,
  WorkflowOutputBindingWriteModes,
  WorkflowOutputTargetTypes,
} from "../../../domain/workflow-studio/WorkflowOutputBindingDomain";
import type { SystemDatasetInstanceService } from "../../system-runtime/SystemDatasetInstanceService";
import { resolveWorkflowOutputBindingWritePlan } from "../WorkflowOutputBindingResolutionService";

function createServiceStub(input: {
  readonly instances?: Record<string, ReturnType<typeof createDatasetInstance>>;
  readonly ensuredInstance?: ReturnType<typeof createDatasetInstance>;
}): SystemDatasetInstanceService {
  return {
    getDatasetInstance: ({ instanceId }: { systemId: string; instanceId: string }) => input.instances?.[instanceId],
    ensureWorkflowOutputTargetInstance: async () => {
      if (!input.ensuredInstance) {
        throw new Error("dataset-instance-not-found");
      }
      return input.ensuredInstance;
    },
  } as unknown as SystemDatasetInstanceService;
}

describe("resolveWorkflowOutputBindingWritePlan", () => {
  it("resolves declared bindings into concrete dataset target write plans", async () => {
    const descriptor = createWorkflowOutputBindingDescriptor({
      bindingId: "binding:output",
      outputId: "images",
      intent: WorkflowOutputBindingIntents.publishCurrentResult,
      writeMode: WorkflowOutputBindingWriteModes.upsert,
      target: {
        targetType: WorkflowOutputTargetTypes.outputDataset,
        targetId: "output-target",
      },
      lineage: {
        workflowAssetId: "asset:workflow:image-edit",
        workflowRunId: "run:42",
      },
      persistence: {
        systemId: "system:1",
        datasetInstanceId: "instance:output",
      },
    });

    const instance = createDatasetInstance({
      instanceId: "instance:output",
      systemId: "system:1",
      datasetAssetId: "asset:dataset:output",
      role: "output-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
    });

    const result = await resolveWorkflowOutputBindingWritePlan({
      systemId: "system:1",
      bindings: [descriptor],
      datasetInstanceService: createServiceStub({ ensuredInstance: instance }),
    });

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.plan[0]).toEqual(expect.objectContaining({
      bindingId: "binding:output",
      outputId: "images",
      target: expect.objectContaining({
        datasetInstanceId: "instance:output",
        datasetAssetId: "asset:dataset:output",
      }),
      targetSemantics: expect.objectContaining({ appendBehavior: "upsert-preferred" }),
    }));
  });

  it("fails resolution for missing explicit instances and incompatible linkage", async () => {
    const missing = createWorkflowOutputBindingDescriptor({
      bindingId: "binding:missing",
      outputId: "images",
      intent: WorkflowOutputBindingIntents.publishCurrentResult,
      writeMode: WorkflowOutputBindingWriteModes.upsert,
      target: {
        targetType: WorkflowOutputTargetTypes.outputDataset,
        targetId: "missing-target",
        datasetInstanceId: "instance:missing",
      },
      lineage: {
        workflowAssetId: "asset:workflow:image-edit",
        workflowRunId: "run:42",
      },
      persistence: {
        systemId: "system:1",
        datasetInstanceId: "instance:missing",
      },
    });

    const mismatch = createWorkflowOutputBindingDescriptor({
      bindingId: "binding:mismatch",
      outputId: "images",
      intent: WorkflowOutputBindingIntents.publishCurrentResult,
      writeMode: WorkflowOutputBindingWriteModes.upsert,
      target: {
        targetType: WorkflowOutputTargetTypes.outputDataset,
        targetId: "mismatch-target",
        datasetInstanceId: "instance:mismatch",
        datasetAssetId: "asset:dataset:expected",
      },
      lineage: {
        workflowAssetId: "asset:workflow:image-edit",
        workflowRunId: "run:42",
      },
      persistence: {
        systemId: "system:1",
        datasetInstanceId: "instance:mismatch",
      },
    });

    const mismatchInstance = createDatasetInstance({
      instanceId: "instance:mismatch",
      systemId: "system:1",
      datasetAssetId: "asset:dataset:actual",
      role: "output-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
    });

    const result = await resolveWorkflowOutputBindingWritePlan({
      systemId: "system:1",
      bindings: [missing, mismatch],
      datasetInstanceService: createServiceStub({
        instances: {
          "instance:mismatch": mismatchInstance,
        },
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.plan).toHaveLength(0);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dataset-instance-not-found", bindingId: "binding:missing" }),
      expect.objectContaining({ code: "dataset-asset-mismatch", bindingId: "binding:mismatch" }),
    ]));
  });

  it("requires grouping metadata for comparison dataset targets", async () => {
    const comparison = createWorkflowOutputBindingDescriptor({
      bindingId: "binding:compare",
      outputId: "images",
      intent: WorkflowOutputBindingIntents.appendComparisonGroup,
      writeMode: WorkflowOutputBindingWriteModes.append,
      target: {
        targetType: WorkflowOutputTargetTypes.comparisonDataset,
        targetId: "compare-target",
      },
      lineage: {
        workflowAssetId: "asset:workflow:image-edit",
        workflowRunId: "run:42",
      },
      persistence: {
        systemId: "system:1",
        datasetInstanceId: "instance:comparison",
      },
    });

    const result = await resolveWorkflowOutputBindingWritePlan({
      systemId: "system:1",
      bindings: [comparison],
      datasetInstanceService: createServiceStub({}),
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "target-grouping-required",
        bindingId: "binding:compare",
      }),
    ]);
  });

  it("keeps comparison grouping metadata explicit in resolved plans", async () => {
    const comparison = createWorkflowOutputBindingDescriptor({
      bindingId: "binding:comparison",
      outputId: "images",
      intent: WorkflowOutputBindingIntents.appendComparisonGroup,
      writeMode: WorkflowOutputBindingWriteModes.append,
      target: {
        targetType: WorkflowOutputTargetTypes.comparisonDataset,
        targetId: "comparison-target",
        groupBy: "comparison-set:batch-a",
      },
      lineage: {
        workflowAssetId: "asset:workflow:image-edit",
        workflowRunId: "run:99",
      },
      persistence: {
        systemId: "system:1",
        datasetInstanceId: "instance:comparison",
      },
    });

    const instance = createDatasetInstance({
      instanceId: "instance:comparison",
      systemId: "system:1",
      datasetAssetId: "asset:dataset:comparison",
      role: "output-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
    });

    const result = await resolveWorkflowOutputBindingWritePlan({
      systemId: "system:1",
      bindings: [comparison],
      datasetInstanceService: createServiceStub({ ensuredInstance: instance }),
    });

    expect(result.ready).toBe(true);
    expect(result.plan[0]).toEqual(expect.objectContaining({
      target: expect.objectContaining({ groupBy: "comparison-set:batch-a" }),
      targetSemantics: expect.objectContaining({
        comparisonGrouping: "required",
        appendBehavior: "append-only",
      }),
    }));
  });

});
