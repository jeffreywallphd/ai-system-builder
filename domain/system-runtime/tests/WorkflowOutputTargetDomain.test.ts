import { describe, expect, it } from "bun:test";
import {
  WorkflowOutputTargetTypes,
  getWorkflowOutputTargetDefinition,
  listWorkflowOutputTargetDefinitions,
  resolveWorkflowOutputTargetPurpose,
} from "../WorkflowOutputTargetDomain";

describe("WorkflowOutputTargetDomain", () => {
  it("defines canonical image workflow target types for output/history/comparison semantics", () => {
    const definitions = listWorkflowOutputTargetDefinitions();

    expect(definitions.map((entry) => entry.targetType)).toEqual([
      WorkflowOutputTargetTypes.outputDataset,
      WorkflowOutputTargetTypes.historyDataset,
      WorkflowOutputTargetTypes.comparisonDataset,
    ]);
    expect(getWorkflowOutputTargetDefinition(WorkflowOutputTargetTypes.outputDataset)?.defaultPurpose).toBe("workflow-output-images");
    expect(getWorkflowOutputTargetDefinition(WorkflowOutputTargetTypes.historyDataset)?.defaultPurpose).toBe("workflow-output-history-images");
    expect(getWorkflowOutputTargetDefinition(WorkflowOutputTargetTypes.comparisonDataset)?.comparisonGrouping).toBe("required");
  });

  it("resolves explicit purpose overrides while preserving composable defaults", () => {
    expect(resolveWorkflowOutputTargetPurpose({
      targetType: WorkflowOutputTargetTypes.historyDataset,
    })).toBe("workflow-output-history-images");

    expect(resolveWorkflowOutputTargetPurpose({
      targetType: WorkflowOutputTargetTypes.historyDataset,
      purpose: "custom-history-purpose",
    })).toBe("custom-history-purpose");

    expect(() => resolveWorkflowOutputTargetPurpose({
      targetType: "future-target",
    })).toThrow("not supported");
  });
});
