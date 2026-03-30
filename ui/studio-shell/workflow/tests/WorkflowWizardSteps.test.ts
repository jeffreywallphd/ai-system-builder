import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftDelayWaitModes,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftLoopIterationModes,
  WorkflowDraftManualInteractionModes,
  WorkflowDraftStepTypes,
  createEmptyWorkflowDraft,
  validateWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowStep,
  buildWorkflowStepAgentAssistantSelectionPayload,
  buildWorkflowStepTypeDefinitionKey,
  clearWorkflowStepAgentAssetSelection,
  loadAgentAssistantAssetCandidates,
  moveWorkflowStepDown,
  moveWorkflowStepUp,
  removeWorkflowStep,
  resolveWorkflowStepTypeDefinition,
  setWorkflowStepAgentAssetSelection,
  setWorkflowStepDelayConfig,
  setWorkflowStepIfThenConfig,
  setWorkflowStepLoopConfig,
  setWorkflowStepManualApprovalConfig,
  setWorkflowStepType,
  workflowStepTypeDefinitions,
} from "../WorkflowWizardSteps";

function findDefinition(type: string): string {
  const definition = workflowStepTypeDefinitions.find((entry) => entry.type === type);
  if (!definition) {
    throw new Error(`Missing step definition for '${type}'.`);
  }
  return buildWorkflowStepTypeDefinitionKey(definition);
}

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

  it("supports selecting built-in step types and updating type-specific configs", () => {
    const withStep = addWorkflowStep(createEmptyWorkflowDraft()).draft;
    const stepId = withStep.steps[0]?.id as string;

    const ifThen = setWorkflowStepType(withStep, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.ifThen));
    expect(ifThen.changed).toBeTrue();
    expect(ifThen.draft.steps[0]?.type).toBe(WorkflowDraftBuiltInStepTypes.ifThen);
    expect(resolveWorkflowStepTypeDefinition(ifThen.draft.steps[0]!).selectionKind).toBe("built-in");

    const configuredIf = setWorkflowStepIfThenConfig(ifThen.draft, stepId, {
      conditionExpression: "score > 0.8",
      thenLabel: "approve",
      elseLabel: "review",
    });
    expect((configuredIf.draft.steps[0]?.config as { conditionExpression?: string }).conditionExpression).toBe("score > 0.8");

    const loop = setWorkflowStepType(configuredIf.draft, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.loopIteration));
    const configuredLoop = setWorkflowStepLoopConfig(loop.draft, stepId, { repeatCount: 3 });
    expect((configuredLoop.draft.steps[0]?.config as { repeatCount?: number }).repeatCount).toBe(3);

    const delay = setWorkflowStepType(configuredLoop.draft, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.delayWait));
    const configuredDelay = setWorkflowStepDelayConfig(delay.draft, stepId, {
      mode: WorkflowDraftDelayWaitModes.duration,
      durationSeconds: 45,
    });
    expect((configuredDelay.draft.steps[0]?.config as { durationSeconds?: number }).durationSeconds).toBe(45);

    const manual = setWorkflowStepType(configuredDelay.draft, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.manualApproval));
    expect(manual.draft.steps[0]?.type).toBe(WorkflowDraftBuiltInStepTypes.manualApproval);
    expect(validateWorkflowDraft(manual.draft).valid).toBeTrue();
  });

  it("supports richer built-in configuration editing for if/loop/delay/manual steps", () => {
    const withStep = addWorkflowStep(createEmptyWorkflowDraft()).draft;
    const stepId = withStep.steps[0]?.id as string;

    const asIfThen = setWorkflowStepType(withStep, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.ifThen)).draft;
    const configuredIfThen = setWorkflowStepIfThenConfig(asIfThen, stepId, {
      conditionExpression: "score > 0.9",
      thenLabel: "approve-path",
      thenStepIds: Object.freeze(["step-2", "step-3"]),
      elseLabel: "reject-path",
      elseStepIds: Object.freeze(["step-4"]),
    }).draft.steps[0]?.config as {
      thenStepIds?: ReadonlyArray<string>;
      elseStepIds?: ReadonlyArray<string>;
    };
    expect(configuredIfThen.thenStepIds).toEqual(["step-2", "step-3"]);
    expect(configuredIfThen.elseStepIds).toEqual(["step-4"]);

    const asLoop = setWorkflowStepType(asIfThen, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.loopIteration)).draft;
    const loopDraft = setWorkflowStepLoopConfig(asLoop, stepId, {
      mode: WorkflowDraftLoopIterationModes.collection,
      collectionInputKey: "input-datasets",
      itemAlias: "row",
      bodyStepIds: Object.freeze(["step-a", "step-b"]),
      maxIterations: 5,
      loopConditionExpression: "row.valid === true",
      loopLabel: "Loop rows",
    }).draft;
    const loopConfig = loopDraft.steps[0]?.config as {
      mode?: string;
      collectionInputKey?: string;
      itemAlias?: string;
      bodyStepIds?: ReadonlyArray<string>;
      maxIterations?: number;
      loopConditionExpression?: string;
    };
    expect(loopConfig.mode).toBe("collection");
    expect(loopConfig.collectionInputKey).toBe("input-datasets");
    expect(loopConfig.itemAlias).toBe("row");
    expect(loopConfig.bodyStepIds).toEqual(["step-a", "step-b"]);
    expect(loopConfig.maxIterations).toBe(5);
    expect(loopConfig.loopConditionExpression).toBe("row.valid === true");

    const asDelay = setWorkflowStepType(loopDraft, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.delayWait)).draft;
    const delayDraft = setWorkflowStepDelayConfig(asDelay, stepId, {
      mode: WorkflowDraftDelayWaitModes.untilTime,
      waitUntil: "2026-04-02T15:45:00.000Z",
      timezone: "America/New_York",
      note: "Await reviewer availability",
    }).draft;
    const delayConfig = delayDraft.steps[0]?.config as {
      mode?: string;
      waitUntil?: string;
      until?: { readonly timezone?: string };
      note?: string;
    };
    expect(delayConfig.mode).toBe("until-time");
    expect(delayConfig.waitUntil).toBe("2026-04-02T15:45:00.000Z");
    expect(delayConfig.until?.timezone).toBe("America/New_York");
    expect(delayConfig.note).toBe("Await reviewer availability");

    const asManual = setWorkflowStepType(delayDraft, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.manualApproval)).draft;
    const manualDraft = setWorkflowStepManualApprovalConfig(asManual, stepId, {
      prompt: "Review this workflow output",
      interactionMode: WorkflowDraftManualInteractionModes.review,
      continueLabel: "continue-review",
      continueStepIds: Object.freeze(["step-next"]),
      requiredApproverRoles: Object.freeze(["ops", "qa"]),
      timeoutSeconds: 120,
      onTimeout: "continue",
      allowSelfApproval: true,
    }).draft;
    const manualConfig = manualDraft.steps[0]?.config as {
      prompt?: string;
      interactionMode?: string;
      outcomes?: { readonly continue?: { readonly label?: string; readonly stepIds?: ReadonlyArray<string> } };
      requiredApproverRoles?: ReadonlyArray<string>;
      timeoutSeconds?: number;
      onTimeout?: string;
      allowSelfApproval?: boolean;
    };
    expect(manualConfig.prompt).toBe("Review this workflow output");
    expect(manualConfig.interactionMode).toBe("review");
    expect(manualConfig.outcomes?.continue?.label).toBe("continue-review");
    expect(manualConfig.outcomes?.continue?.stepIds).toEqual(["step-next"]);
    expect(manualConfig.requiredApproverRoles).toEqual(["ops", "qa"]);
    expect(manualConfig.timeoutSeconds).toBe(120);
    expect(manualConfig.onTimeout).toBe("continue");
    expect(manualConfig.allowSelfApproval).toBeTrue();
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
    expect(firstAssigned.draft.steps[0]?.config).toEqual({});

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
    expect(cleared.draft.steps[0]?.kind).toBe("asset-backed");
    expect(cleared.draft.steps[1]?.assetRef?.asset.assetId).toBe("asset:agent-alpha");
  });

  it("cleans stale config and asset references when switching step types", () => {
    const added = addWorkflowStep(createEmptyWorkflowDraft()).draft;
    const stepId = added.steps[0]?.id as string;

    const withAsset = setWorkflowStepAgentAssetSelection(added, stepId, {
      assetId: "asset:agent-a",
      versionId: "asset:agent-a:v1",
    }).draft;
    expect(withAsset.steps[0]?.type).toBe(WorkflowDraftStepTypes.agentAssistant);

    const asIf = setWorkflowStepType(withAsset, stepId, findDefinition(WorkflowDraftBuiltInStepTypes.ifThen)).draft;
    expect(asIf.steps[0]?.assetRef).toBeUndefined();
    expect(asIf.steps[0]?.type).toBe(WorkflowDraftBuiltInStepTypes.ifThen);

    const backToAsset = setWorkflowStepType(asIf, stepId, findDefinition(WorkflowDraftStepTypes.agentAssistant)).draft;
    expect(backToAsset.steps[0]?.type).toBe(WorkflowDraftStepTypes.agentAssistant);
    expect(backToAsset.steps[0]?.config).toBeUndefined();
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

  it("builds a step-compatible payload from selector asset choices", () => {
    const payload = buildWorkflowStepAgentAssistantSelectionPayload({
      assetId: "asset:agent-step-payload",
      versionId: "asset:agent-step-payload:v1",
      name: "Step Payload Agent",
    });

    expect(payload.assetRef.assetKind).toBe("agent-assistant");
    expect(payload.assetRef.asset.assetId).toBe("asset:agent-step-payload");
    expect(payload.assetRef.asset.versionId).toBe("asset:agent-step-payload:v1");
    expect(payload.config).toEqual({});
  });

  it("rejects non-canonical agent identities to prevent invalid step asset references", () => {
    const baseDraft = addWorkflowStep(createEmptyWorkflowDraft()).draft;
    const stepId = baseDraft.steps[0]?.id as string;

    const invalidSet = setWorkflowStepAgentAssetSelection(baseDraft, stepId, {
      assetId: "agent-non-canonical",
      versionId: "version-non-canonical",
    });
    expect(invalidSet.changed).toBe(false);
    expect(invalidSet.draft.steps[0]?.assetRef).toBeUndefined();

    expect(() => buildWorkflowStepAgentAssistantSelectionPayload({
      assetId: "agent-invalid",
      versionId: "version-invalid",
    })).toThrow("canonical 'asset:' identity");
  });
});
