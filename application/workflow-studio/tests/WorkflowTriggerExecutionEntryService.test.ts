import { describe, expect, it } from "bun:test";
import { WorkflowExecutionTriggerSourceKinds } from "../WorkflowExecutionAlignmentContracts";
import { applyTriggerExecutionEntryToContext, normalizeWorkflowExecutionTriggerEntry } from "../WorkflowTriggerExecutionEntryService";

describe("WorkflowTriggerExecutionEntryService", () => {
  it("normalizes trigger entry activation defaults by source kind", () => {
    expect(normalizeWorkflowExecutionTriggerEntry({
      sourceKind: WorkflowExecutionTriggerSourceKinds.manualUser,
      triggerId: "manual-1",
    }).activationType).toBe("manual");
    expect(normalizeWorkflowExecutionTriggerEntry({
      sourceKind: WorkflowExecutionTriggerSourceKinds.temporal,
      triggerId: "temporal-1",
    }).activationType).toBe("temporal");
    expect(normalizeWorkflowExecutionTriggerEntry({
      sourceKind: WorkflowExecutionTriggerSourceKinds.stateData,
      triggerId: "state-1",
    }).activationType).toBe("state-data");
  });

  it("adds trigger entry metadata and activation payload to execution context", () => {
    const context = applyTriggerExecutionEntryToContext({
      context: {
        inputValues: {
          prompt: "hello",
        },
      },
      entry: {
        sourceKind: WorkflowExecutionTriggerSourceKinds.stateData,
        triggerId: "trigger-state",
        triggerType: "system-event",
        payload: {
          customerId: "customer-99",
        },
        contextReferences: {
          workflowAssetId: "asset:workflow:1",
        },
        bindingMetadata: {
          bindingId: "binding.ui.selection",
        },
      },
    });

    expect(context?.triggerActivation).toEqual({
      triggerId: "trigger-state",
      sourceKind: WorkflowExecutionTriggerSourceKinds.stateData,
      triggerType: "system-event",
      activationType: "state-data",
      payload: {
        customerId: "customer-99",
      },
    });
    expect(context?.metadata).toEqual(expect.objectContaining({
      triggerEntry: {
        sourceKind: WorkflowExecutionTriggerSourceKinds.stateData,
        triggerId: "trigger-state",
        triggerType: "system-event",
        activationType: "state-data",
        contextReferences: {
          workflowAssetId: "asset:workflow:1",
        },
        bindingMetadata: {
          bindingId: "binding.ui.selection",
        },
      },
    }));
  });
});
