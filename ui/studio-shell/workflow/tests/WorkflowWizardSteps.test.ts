import { describe, expect, it } from "bun:test";
import { createEmptyWorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowStep,
  clearWorkflowStepAgentAssetSelection,
  loadAgentAssistantAssetCandidates,
  moveWorkflowStepDown,
  moveWorkflowStepUp,
  removeWorkflowStep,
  setWorkflowStepAgentAssetSelection,
} from "../WorkflowWizardSteps";

describe("WorkflowWizardSteps", () => {
  it("adds, removes, and reorders steps while preserving stable step ids", () => {
    const baseDraft = createEmptyWorkflowDraft();
    const first = addWorkflowStep(baseDraft);
    const second = addWorkflowStep(first.draft);
    const third = addWorkflowStep(second.draft);

    expect(third.draft.steps.map((step) => step.id)).toEqual([first.stepId, second.stepId, third.stepId]);
    expect(third.draft.steps.map((step) => step.order)).toEqual([1, 2, 3]);

    const movedUp = moveWorkflowStepUp(third.draft, third.stepId);
    expect(movedUp.changed).toBe(true);
    expect(movedUp.draft.steps.map((step) => step.id)).toEqual([first.stepId, third.stepId, second.stepId]);
    expect(movedUp.draft.steps.map((step) => step.order)).toEqual([1, 2, 3]);

    const movedDown = moveWorkflowStepDown(movedUp.draft, first.stepId);
    expect(movedDown.changed).toBe(true);
    expect(movedDown.draft.steps.map((step) => step.id)).toEqual([third.stepId, first.stepId, second.stepId]);

    const removed = removeWorkflowStep(movedDown.draft, first.stepId);
    expect(removed.changed).toBe(true);
    expect(removed.draft.steps.map((step) => step.id)).toEqual([third.stepId, second.stepId]);
    expect(removed.draft.steps.map((step) => step.order)).toEqual([1, 2]);
  });

  it("supports selecting, replacing, and clearing agent/assistant assets per step", () => {
    const baseDraft = addWorkflowStep(addWorkflowStep(createEmptyWorkflowDraft()).draft).draft;
    const firstStepId = baseDraft.steps[0]?.id as string;
    const secondStepId = baseDraft.steps[1]?.id as string;

    const firstAssigned = setWorkflowStepAgentAssetSelection(baseDraft, firstStepId, {
      assetId: "asset:agent-alpha",
      versionId: "asset:agent-alpha:v1",
      name: "Agent Alpha",
    });
    expect(firstAssigned.changed).toBe(true);
    expect(firstAssigned.draft.steps[0]?.assetRef?.asset.assetId).toBe("asset:agent-alpha");
    expect(firstAssigned.draft.steps[0]?.kind).toBe("asset-backed");

    const replaced = setWorkflowStepAgentAssetSelection(firstAssigned.draft, firstStepId, {
      assetId: "asset:agent-beta",
      versionId: "asset:agent-beta:v2",
      name: "Agent Beta",
    });
    expect(replaced.changed).toBe(true);
    expect(replaced.draft.steps[0]?.assetRef?.asset.assetId).toBe("asset:agent-beta");
    expect(replaced.draft.steps[0]?.assetRef?.asset.versionId).toBe("asset:agent-beta:v2");

    const secondAssigned = setWorkflowStepAgentAssetSelection(replaced.draft, secondStepId, {
      assetId: "asset:agent-alpha",
      versionId: "asset:agent-alpha:v1",
    });
    expect(secondAssigned.changed).toBe(true);
    expect(secondAssigned.draft.steps[1]?.assetRef?.asset.assetId).toBe("asset:agent-alpha");

    const cleared = clearWorkflowStepAgentAssetSelection(secondAssigned.draft, firstStepId);
    expect(cleared.changed).toBe(true);
    expect(cleared.draft.steps[0]?.assetRef).toBeUndefined();
    expect(cleared.draft.steps[0]?.kind).toBe("action");
    expect(cleared.draft.steps[1]?.assetRef?.asset.assetId).toBe("asset:agent-alpha");
  });

  it("queries the registry with canonical agent/assistant taxonomy filters", async () => {
    const calls: Array<{ readonly kind: "filter" | "search"; readonly keyword?: string }> = [];
    const service = {
      async filterAssets(filters: {
        readonly structuralKinds?: ReadonlyArray<string>;
        readonly semanticRoles?: ReadonlyArray<string>;
        readonly behaviorKinds?: ReadonlyArray<string>;
        readonly limit?: number;
      }) {
        calls.push({ kind: "filter" });
        expect(filters.structuralKinds).toEqual(["composite"]);
        expect(filters.semanticRoles).toEqual(["agent"]);
        expect(filters.behaviorKinds).toEqual(["autonomous"]);
        return {
          ok: true,
          data: Object.freeze([
            Object.freeze({
              assetId: "asset:agent-one",
              versionId: "asset:agent-one:v1",
              name: "Agent One",
            }),
          ]),
        };
      },
      async searchAssets(query: {
        readonly keyword: string;
        readonly structuralKinds?: ReadonlyArray<string>;
        readonly semanticRoles?: ReadonlyArray<string>;
        readonly behaviorKinds?: ReadonlyArray<string>;
        readonly limit?: number;
      }) {
        calls.push({ kind: "search", keyword: query.keyword });
        expect(query.structuralKinds).toEqual(["composite"]);
        expect(query.semanticRoles).toEqual(["agent"]);
        expect(query.behaviorKinds).toEqual(["autonomous"]);
        return {
          ok: true,
          data: Object.freeze([
            Object.freeze({
              assetId: "asset:agent-two",
              versionId: "asset:agent-two:v3",
              name: "Agent Two",
            }),
          ]),
        };
      },
    };

    const filtered = await loadAgentAssistantAssetCandidates(service, "");
    expect(filtered.error).toBeUndefined();
    expect(filtered.assets.map((asset) => asset.assetId)).toEqual(["asset:agent-one"]);

    const searched = await loadAgentAssistantAssetCandidates(service, "agent two");
    expect(searched.error).toBeUndefined();
    expect(searched.assets.map((asset) => asset.assetId)).toEqual(["asset:agent-two"]);

    expect(calls).toEqual([
      { kind: "filter" },
      { kind: "search", keyword: "agent two" },
    ]);
  });
});
