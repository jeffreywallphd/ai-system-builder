import { describe, expect, it } from "bun:test";
import {
  WorkflowOutputBindingIntents,
  WorkflowOutputBindingWriteModes,
  WorkflowOutputTargetTypes,
  createWorkflowOutputBindingDescriptor,
  suggestIntentForTargetType,
  suggestWriteModeForTargetType,
} from "../WorkflowOutputBindingDomain";

describe("WorkflowOutputBindingDomain", () => {
  it("creates versioned output binding descriptors with lineage, payload, and persistence metadata", () => {
    const descriptor = createWorkflowOutputBindingDescriptor({
      bindingId: "binding.output.primary",
      outputId: "output.images",
      target: {
        targetType: WorkflowOutputTargetTypes.outputDataset,
        targetId: "target:dataset:output",
        datasetInstanceId: "instance:output",
      },
      intent: WorkflowOutputBindingIntents.publishCurrentResult,
      writeMode: WorkflowOutputBindingWriteModes.upsert,
      records: [{
        recordId: "record:1",
        imageAssetRefStableId: "generated-output:image:1",
        tags: ["hero", " hero ", "primary"],
        value: { image: "generated-output:image:1" },
      }],
      lineage: {
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v1",
        workflowRunId: "run:1",
        sourceDatasetAssetId: "asset:dataset:input",
        sourceDatasetInstanceId: "instance:input",
      },
      persistence: {
        systemId: "system:image",
        datasetInstanceId: "instance:output",
        durable: true,
      },
    });

    expect(descriptor.contractVersion).toBe("1.0.0");
    expect(descriptor.records[0]?.tags).toEqual(["hero", "primary"]);
    expect(descriptor.persistence.datasetInstanceId).toBe("instance:output");
    expect(descriptor.lineage.sourceRecordIds).toEqual([]);
    expect(descriptor.lineage.outputRelationship.relationshipType).toBe("workflow-output-binding");
  });

  it("maps canonical target types to default intent/write semantics while remaining extensible", () => {
    expect(suggestIntentForTargetType(WorkflowOutputTargetTypes.outputDataset)).toBe(
      WorkflowOutputBindingIntents.publishCurrentResult,
    );
    expect(suggestWriteModeForTargetType(WorkflowOutputTargetTypes.outputDataset)).toBe(
      WorkflowOutputBindingWriteModes.upsert,
    );

    expect(suggestIntentForTargetType(WorkflowOutputTargetTypes.historyDataset)).toBe(
      WorkflowOutputBindingIntents.appendRunHistory,
    );
    expect(suggestWriteModeForTargetType(WorkflowOutputTargetTypes.historyDataset)).toBe(
      WorkflowOutputBindingWriteModes.append,
    );

    expect(suggestIntentForTargetType(WorkflowOutputTargetTypes.comparisonDataset)).toBe(
      WorkflowOutputBindingIntents.appendComparisonGroup,
    );
    expect(suggestWriteModeForTargetType(WorkflowOutputTargetTypes.comparisonDataset)).toBe(
      WorkflowOutputBindingWriteModes.append,
    );

    expect(suggestIntentForTargetType("future-target")).toBe(WorkflowOutputBindingIntents.publishCurrentResult);
  });
});
