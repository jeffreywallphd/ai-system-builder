import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  createWorkflowEntity,
  createWorkflowAssetMetadata,
  createWorkflowStudioTaxonomy,
  deserializeWorkflowEntity,
  deserializeWorkflowDraft,
  deserializeWorkflowDraftDocument,
  classifyWorkflowDraftAssetReferences,
  isWorkflowLifecycleTransitionAllowed,
  mapWorkflowEntityFromPersistenceRecord,
  mapWorkflowEntityToPersistenceRecord,
  normalizeWorkflowDraft,
  serializeWorkflowEntity,
  serializeWorkflowDraft,
  serializeWorkflowDraftDocument,
  transitionWorkflowEntityLifecycle,
  validateWorkflowDraft,
  validateWorkflowEntity,
  WorkflowDraftAssetReferenceKinds,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftInputSourceTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepAssetKinds,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowLifecycleStates,
  WorkflowValidationIssueCodes,
  WorkflowStudioIdentity,
} from "../WorkflowStudioDomain";

describe("WorkflowStudioDomain", () => {
  it("creates a core workflow entity with stable identity, lifecycle metadata, and draft linkage", () => {
    const createdAt = new Date("2026-03-29T13:00:00.000Z");
    const entity = createWorkflowEntity({
      id: " workflow-entity-1 ",
      name: "  Automation Workflow  ",
      metadata: {
        summary: "  Canonical workflow draft holder  ",
        tags: ["core", "core", "workflow"],
      },
      draft: {
        triggers: [{
          id: "trigger-1",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        inputs: [{
          id: "input-1",
          type: "dataset",
          sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
          asset: { assetId: "asset:dataset-1", versionId: "asset:dataset-1:v1" },
        }],
        steps: [{ id: "step-1", type: "action", kind: WorkflowDraftStepKinds.action, order: 1 }],
        outputs: [{
          id: "output-1",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "/exports/workflow-output.json",
          },
        }],
      },
      now: createdAt,
    });

    expect(entity.id).toBe("workflow-entity-1");
    expect(entity.name).toBe("Automation Workflow");
    expect(entity.metadata.summary).toBe("Canonical workflow draft holder");
    expect(entity.metadata.tags).toEqual(["core", "workflow"]);
    expect(entity.lifecycleState).toBe(WorkflowLifecycleStates.draft);
    expect(entity.draftRevision).toBe(1);
    expect(entity.createdAt).toBe("2026-03-29T13:00:00.000Z");
    expect(entity.updatedAt).toBe("2026-03-29T13:00:00.000Z");
    expect(entity.draft.steps[0]?.id).toBe("step-1");
  });

  it("requires workflow entity identity and name", () => {
    expect(() => createWorkflowEntity({ id: " ", name: "Workflow" })).toThrow("Workflow entity id is required.");
    expect(() => createWorkflowEntity({ id: "workflow-1", name: " " })).toThrow("Workflow entity name is required.");
  });

  it("supports minimal canonical workflow draft with required sections", () => {
    const empty = createEmptyWorkflowDraft();
    const normalized = normalizeWorkflowDraft(empty);

    expect(normalized.triggers).toEqual([]);
    expect(normalized.inputs).toEqual([]);
    expect(normalized.steps).toEqual([]);
    expect(normalized.outputs).toEqual([]);
  });

  it("preserves and enforces explicit step ordering", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [
        { id: "step-b", type: "transform", kind: WorkflowDraftStepKinds.action, order: 2 },
        { id: "step-a", type: "load", kind: WorkflowDraftStepKinds.action, order: 1 },
      ],
      outputs: [],
    });

    expect(normalized.steps.map((step) => `${step.id}:${step.order}`)).toEqual([
      "step-a:1",
      "step-b:2",
    ]);
    expect(normalized.steps.map((step) => step.kind)).toEqual([
      WorkflowDraftStepKinds.action,
      WorkflowDraftStepKinds.action,
    ]);

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [
        { id: "step-a", type: "load", kind: WorkflowDraftStepKinds.action, order: 1 },
        { id: "step-b", type: "transform", kind: WorkflowDraftStepKinds.action, order: 1 },
      ],
      outputs: [],
    })).toThrow("Workflow draft step order '1' is duplicated.");
  });

  it("round-trips canonical workflow draft serialization and deserialization", () => {
    const draft = normalizeWorkflowDraft({
      triggers: [{
        id: "trigger-manual",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userManual,
        title: "Manual Start",
        config: {
          requiresConfirmation: true,
        },
      }],
      inputs: [{
        id: "input-query",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        title: "Query Dataset",
        asset: { assetId: "asset:dataset-query", versionId: "asset:dataset-query:v2" },
      }],
      steps: [{ id: "step-run", type: "run-tool", kind: WorkflowDraftStepKinds.action, order: 1, dependsOnStepIds: [] }],
      outputs: [{
        id: "output-result",
        type: "workflow-output",
        outputType: WorkflowDraftOutputTypes.record,
        format: WorkflowDraftOutputFormats.json,
        destination: {
          type: WorkflowDraftOutputDestinationTypes.systemEntry,
          target: "crm/customers",
        },
      }],
    });

    const serialized = serializeWorkflowDraft(draft);
    const rehydrated = deserializeWorkflowDraft(serialized);

    expect(rehydrated).toEqual(draft);
  });

  it("round-trips workflow draft persistence document serialization without data loss", () => {
    const draft = normalizeWorkflowDraft({
      triggers: [],
      inputs: [{
        id: "input-dataset",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        asset: { assetId: "asset:dataset-customers", versionId: "asset:dataset-customers:v1" },
      }],
      steps: [{
        id: "step-agent",
        type: WorkflowDraftStepTypes.agentAssistant,
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
        assetRef: {
          assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
          asset: { assetId: "asset:assistant-reviewer", versionId: "asset:assistant-reviewer:v2" },
        },
      }],
      outputs: [],
    });

    const serialized = serializeWorkflowDraftDocument(draft);
    const parsed = deserializeWorkflowDraftDocument(serialized);

    expect(parsed).toEqual(draft);
  });

  it("maps workflow entities to/from persistence records and preserves canonical fields", () => {
    const entity = createWorkflowEntity({
      id: "workflow-entity-serialization",
      name: "Workflow Entity Serialization",
      metadata: { summary: "Persists metadata", tags: ["workflow", "persisted"] },
      lifecycleState: WorkflowLifecycleStates.saved,
      draftRevision: 3,
      draft: {
        triggers: [{ id: "trigger-manual", kind: "user", type: "manual", config: {} }],
        inputs: [{
          id: "input-dataset",
          type: "dataset",
          sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
          asset: { assetId: "asset:dataset-export", versionId: "asset:dataset-export:v5" },
        }],
        steps: [{
          id: "step-agent",
          type: WorkflowDraftStepTypes.agentAssistant,
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 1,
          assetRef: {
            assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
            asset: { assetId: "asset:assistant-exporter", versionId: "asset:assistant-exporter:v1" },
          },
        }],
        outputs: [{
          id: "output-entity",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.record,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-agent",
          destination: { type: WorkflowDraftOutputDestinationTypes.systemEntry, target: "records/outbound" },
        }],
      },
      now: new Date("2026-03-29T18:00:00.000Z"),
    });
    const updated = Object.freeze({
      ...entity,
      updatedAt: "2026-03-29T18:10:00.000Z",
    });

    const record = mapWorkflowEntityToPersistenceRecord(updated);
    const rehydrated = mapWorkflowEntityFromPersistenceRecord(record);

    expect(rehydrated).toEqual(updated);
  });

  it("round-trips workflow entities through serialized documents", () => {
    const entity = createWorkflowEntity({
      id: "workflow-entity-doc-roundtrip",
      name: "Workflow Document Roundtrip",
      lifecycleState: WorkflowLifecycleStates.saved,
      draft: {
        triggers: [{ id: "trigger-manual", kind: "user", type: "manual", config: {} }],
        inputs: [],
        steps: [{ id: "step-1", type: "action", kind: WorkflowDraftStepKinds.action, order: 1 }],
        outputs: [],
      },
      now: new Date("2026-03-29T19:00:00.000Z"),
    });

    const serialized = serializeWorkflowEntity(entity);
    const rehydrated = deserializeWorkflowEntity(serialized);

    expect(rehydrated).toEqual(entity);
  });

  it("accepts canonical trigger entries for user, temporal, and state trigger kinds", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [
        {
          id: "trigger-user",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userButtonClick,
          config: {
            buttonId: "run-now",
            requiresConfirmation: true,
            allowedRoles: ["editor", "editor", "owner"],
          },
        },
        {
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalRecurring,
          config: {
            every: 6,
            unit: "hours",
            timezone: "America/New_York",
          },
        },
        {
          id: "trigger-state",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateAssetStateChanged,
          config: {
            asset: { assetId: "asset:dataset-training", versionId: "asset:dataset-training:v3" },
            stateKey: "status",
            stateValue: "ready",
          },
        },
      ],
      inputs: [],
      steps: [],
      outputs: [],
    });

    expect(normalized.triggers).toHaveLength(3);
    expect(normalized.triggers[0]).toMatchObject({
      kind: "user",
      type: "button-click",
      config: {
        buttonId: "run-now",
        requiresConfirmation: true,
        allowedRoles: ["editor", "owner"],
      },
    });
    expect(normalized.triggers[1]).toMatchObject({
      kind: "temporal",
      type: "recurring",
      config: { every: 6, unit: "hours", timezone: "America/New_York" },
    });
    expect(normalized.triggers[2]).toMatchObject({
      kind: "state",
      type: "asset-state-changed",
      config: {
        asset: { assetId: "asset:dataset-training", versionId: "asset:dataset-training:v3" },
        stateKey: "status",
        stateValue: "ready",
      },
    });
  });

  it("rejects invalid trigger kind/type/config combinations", () => {
    expect(() => normalizeWorkflowDraft({
      triggers: [{
        id: "trigger-invalid-kind",
        kind: "temporal" as "temporal",
        type: WorkflowDraftTriggerTypes.userManual,
        config: {},
      }],
      inputs: [],
      steps: [],
      outputs: [],
    })).toThrow("not valid for kind 'temporal'");

    expect(() => normalizeWorkflowDraft({
      triggers: [{
        id: "trigger-invalid-temporal-config",
        kind: WorkflowDraftTriggerKinds.temporal,
        type: WorkflowDraftTriggerTypes.temporalSchedule,
        config: {},
      }],
      inputs: [],
      steps: [],
      outputs: [],
    })).toThrow("requires config.cronExpression");

    expect(() => normalizeWorkflowDraft({
      triggers: [{
        id: "trigger-invalid-state-config",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: { eventName: " " },
      }],
      inputs: [],
      steps: [],
      outputs: [],
    })).toThrow("requires config.eventName");
  });

  it("accepts one or more canonical workflow inputs with dataset-backed asset references", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [
        {
          id: "input-dataset",
          type: "dataset",
          sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
          required: true,
          valueType: "object",
          asset: { assetId: "asset:dataset-customers", versionId: "asset:dataset-customers:v4" },
          format: "jsonl",
          selection: {
            split: "train",
            query: "region = 'east'",
            fields: ["name", "email", "name"],
            limit: 500,
          },
        },
        {
          id: "input-runtime",
          type: "parameter",
          sourceType: WorkflowDraftInputSourceTypes.runtimeParameter,
          parameterKey: "customerSegment",
          valueType: "string",
          defaultValue: "enterprise",
        },
      ],
      steps: [],
      outputs: [],
    });

    expect(normalized.inputs).toHaveLength(2);
    expect(normalized.inputs[0]).toMatchObject({
      sourceType: "dataset-asset",
      asset: { assetId: "asset:dataset-customers", versionId: "asset:dataset-customers:v4" },
      selection: { split: "train", query: "region = 'east'", fields: ["name", "email"], limit: 500 },
    });
    expect(normalized.inputs[1]).toMatchObject({
      sourceType: "runtime-parameter",
      parameterKey: "customerSegment",
      defaultValue: "enterprise",
    });
    expect(normalized.inputs[0]?.sourceType === WorkflowDraftInputSourceTypes.datasetAsset
      ? normalized.inputs[0].asset.taxonomy
      : undefined).toEqual({
      structuralKind: "atomic",
      semanticRole: "dataset",
      behaviorKind: "none",
    });
  });

  it("rejects dataset input taxonomy mismatches against canonical taxonomy expectations", () => {
    const result = validateWorkflowDraft({
      triggers: [],
      inputs: [{
        id: "input-dataset",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        asset: {
          assetId: "asset:dataset-customers",
          taxonomy: { structuralKind: "atomic", semanticRole: "tool", behaviorKind: "deterministic" },
        },
      }],
      steps: [],
      outputs: [],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.inputMalformed)).toBeTrue();
  });

  it("rejects malformed workflow input structures", () => {
    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [{
        id: "input-invalid-source",
        type: "dataset",
        sourceType: "file-upload" as "dataset-asset",
        asset: { assetId: "asset:dataset-1" },
      }],
      steps: [],
      outputs: [],
    })).toThrow("source type 'file-upload' is not supported");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [{
        id: "input-invalid-dataset-format",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        asset: { assetId: "asset:dataset-1" },
        format: "yaml" as "json",
      }],
      steps: [],
      outputs: [],
    })).toThrow("format 'yaml' is not supported");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [{
        id: "input-invalid-runtime-parameter",
        type: "parameter",
        sourceType: WorkflowDraftInputSourceTypes.runtimeParameter,
        parameterKey: " ",
      }],
      steps: [],
      outputs: [],
    })).toThrow("parameterKey is required");
  });

  it("supports canonical base step model with identity, ordering, type classification, and config payload", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-control-1",
        type: "branch",
        kind: WorkflowDraftStepKinds.controlFlow,
        title: "Branch on quality score",
        description: "Routes to review or publish",
        order: 1,
        config: {
          predicate: "qualityScore >= 0.9",
          truePath: "publish",
          falsePath: "review",
        },
      }],
      outputs: [],
    });

    expect(normalized.steps[0]).toMatchObject({
      id: "step-control-1",
      type: "branch",
      kind: WorkflowDraftStepKinds.controlFlow,
      order: 1,
      config: {
        predicate: "qualityScore >= 0.9",
        truePath: "publish",
        falsePath: "review",
      },
    });
  });

  it("accepts built-in control-flow step variants for if/then branching and loop iteration", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [
        {
          id: "step-branch",
          type: WorkflowDraftBuiltInStepTypes.ifThen,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            conditionExpression: "qualityScore >= 0.9",
            thenStepIds: ["step-publish", "step-notify"],
            elseStepIds: ["step-review"],
          },
        },
        {
          id: "step-loop",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          config: {
            iterationMode: "collection",
            collectionInputKey: "documents",
            itemAlias: "document",
            bodyStepIds: ["step-summarize"],
            maxIterations: 100,
          },
        },
      ],
      outputs: [],
    });

    expect(normalized.steps[0]).toMatchObject({
      id: "step-branch",
      kind: WorkflowDraftStepKinds.controlFlow,
      type: WorkflowDraftBuiltInStepTypes.ifThen,
      config: {
        conditionExpression: "qualityScore >= 0.9",
        thenStepIds: ["step-publish", "step-notify"],
        elseStepIds: ["step-review"],
      },
    });
    expect(normalized.steps[1]).toMatchObject({
      id: "step-loop",
      kind: WorkflowDraftStepKinds.controlFlow,
      type: WorkflowDraftBuiltInStepTypes.loopIteration,
      config: {
        iterationMode: "collection",
        collectionInputKey: "documents",
        itemAlias: "document",
        bodyStepIds: ["step-summarize"],
        maxIterations: 100,
      },
    });
  });

  it("supports agent-assistant asset-backed workflow steps with canonical asset references", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [
        {
          id: "step-agent-1",
          type: WorkflowDraftStepTypes.agentAssistant,
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 1,
          assetRef: {
            assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
            asset: { assetId: "asset:assistant-summarizer", versionId: "asset:assistant-summarizer:v3" },
          },
        },
        {
          id: "step-control-2",
          type: "guard",
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          dependsOnStepIds: ["step-agent-1"],
        },
      ],
      outputs: [],
    });

    expect(normalized.steps).toHaveLength(2);
    expect(normalized.steps[0]).toMatchObject({
      id: "step-agent-1",
      kind: WorkflowDraftStepKinds.assetBacked,
      type: WorkflowDraftStepTypes.agentAssistant,
      assetRef: {
        assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
        asset: { assetId: "asset:assistant-summarizer", versionId: "asset:assistant-summarizer:v3" },
      },
    });
    expect(normalized.steps[1]).toMatchObject({
      id: "step-control-2",
      kind: WorkflowDraftStepKinds.controlFlow,
      order: 2,
      dependsOnStepIds: ["step-agent-1"],
    });
    const first = normalized.steps[0];
    expect(first?.assetRef?.asset.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "agent",
      behaviorKind: "autonomous",
    });
  });

  it("rejects agent-assistant step taxonomy mismatches against canonical taxonomy expectations", () => {
    const result = validateWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-agent-1",
        type: WorkflowDraftStepTypes.agentAssistant,
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
        assetRef: {
          assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
          asset: {
            assetId: "asset:assistant-summarizer",
            taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
          },
        },
      }],
      outputs: [],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepMalformed)).toBeTrue();
  });

  it("rejects malformed base and asset-backed step structures", () => {
    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-invalid-kind",
        type: "noop",
        kind: "asset-link" as "action",
        order: 1,
      }],
      outputs: [],
    })).toThrow("step kind 'asset-link' is not supported");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-missing-asset-ref",
        type: WorkflowDraftStepTypes.agentAssistant,
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
      }],
      outputs: [],
    })).toThrow("asset-backed step requires assetRef");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-invalid-agent-type",
        type: "agent",
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
        assetRef: {
          assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
          asset: { assetId: "asset:assistant-1" },
        },
      }],
      outputs: [],
    })).toThrow("requires type 'agent-assistant'");
  });

  it("classifies dataset inputs and agent-assistant steps with canonical taxonomy expectations", () => {
    const draft = normalizeWorkflowDraft({
      triggers: [],
      inputs: [{
        id: "input-dataset",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        asset: { assetId: "asset:dataset-curated", versionId: "asset:dataset-curated:v2" },
      }],
      steps: [{
        id: "step-agent",
        type: WorkflowDraftStepTypes.agentAssistant,
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
        assetRef: {
          assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
          asset: { assetId: "asset:assistant-evaluator", versionId: "asset:assistant-evaluator:v3" },
        },
      }],
      outputs: [],
    });

    const classifications = classifyWorkflowDraftAssetReferences(draft);
    expect(classifications.map((entry) => entry.kind)).toEqual([
      WorkflowDraftAssetReferenceKinds.datasetInput,
      WorkflowDraftAssetReferenceKinds.agentAssistantStep,
    ]);
    expect(classifications.every((entry) => entry.taxonomyMatched)).toBeTrue();
    expect(classifications[0]?.expectedTaxonomy.semanticRole).toBe("dataset");
    expect(classifications[1]?.expectedTaxonomy.semanticRole).toBe("agent");
  });

  it("rejects malformed built-in control-flow step structures", () => {
    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-invalid-if-then",
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        kind: WorkflowDraftStepKinds.controlFlow,
        order: 1,
      }],
      outputs: [],
    })).toThrow("requires config");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-invalid-loop",
        type: WorkflowDraftBuiltInStepTypes.loopIteration,
        kind: WorkflowDraftStepKinds.controlFlow,
        order: 1,
        config: {
          iterationMode: "range",
          bodyStepIds: ["step-body"],
        },
      }],
      outputs: [],
    })).toThrow("range mode requires config.range");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{
        id: "step-invalid-kind-for-built-in",
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        kind: WorkflowDraftStepKinds.action,
        order: 1,
        config: {
          conditionExpression: "x > 0",
          thenStepIds: ["step-next"],
        },
      }],
      outputs: [],
    })).toThrow("requires kind 'control-flow'");
  });

  it("accepts canonical output entries with type, format, and destination", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [{ id: "step-run", type: "run-tool", kind: WorkflowDraftStepKinds.action, order: 1 }],
      outputs: [{
        id: "output-primary",
        type: "workflow-output",
        outputType: WorkflowDraftOutputTypes.document,
        format: WorkflowDraftOutputFormats.markdown,
        sourceStepId: "step-run",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.webViewer,
          target: "session-panel",
          options: { tab: "preview" },
        },
      }],
    });

    expect(normalized.outputs[0]).toMatchObject({
      id: "output-primary",
      outputType: WorkflowDraftOutputTypes.document,
      format: WorkflowDraftOutputFormats.markdown,
      sourceStepId: "step-run",
      destination: {
        type: WorkflowDraftOutputDestinationTypes.webViewer,
        target: "session-panel",
        options: { tab: "preview" },
      },
    });
  });

  it("supports multiple outputs in the canonical workflow draft", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [],
      outputs: [
        {
          id: "output-file",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.html,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "/exports/report.html",
          },
        },
        {
          id: "output-system",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.record,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.systemEntry,
            target: "warehouse/reports",
          },
        },
      ],
    });

    expect(normalized.outputs).toHaveLength(2);
    expect(normalized.outputs.map((output) => output.id)).toEqual(["output-file", "output-system"]);
  });

  it("rejects malformed workflow output structures", () => {
    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [],
      outputs: [{
        id: "output-invalid-type",
        type: "workflow-output",
        outputType: " ",
        format: WorkflowDraftOutputFormats.json,
        destination: {
          type: WorkflowDraftOutputDestinationTypes.fileExport,
          target: "/exports/result.json",
        },
      }],
    })).toThrow("output outputType is required");

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [],
      outputs: [{
        id: "output-missing-destination-target",
        type: "workflow-output",
        outputType: WorkflowDraftOutputTypes.document,
        format: WorkflowDraftOutputFormats.json,
        destination: {
          type: WorkflowDraftOutputDestinationTypes.fileExport,
          target: " ",
        },
      }],
    })).toThrow("destination target is required");
  });

  it("validates a canonical workflow draft successfully", () => {
    const result = validateWorkflowDraft({
      triggers: [{
        id: "trigger-manual",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userManual,
        config: {},
      }],
      inputs: [{
        id: "input-dataset",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        asset: { assetId: "asset:dataset-customers", versionId: "asset:dataset-customers:v1" },
      }],
      steps: [
        { id: "step-load", type: "load", kind: WorkflowDraftStepKinds.action, order: 1 },
        {
          id: "step-loop",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          dependsOnStepIds: ["step-load"],
          config: {
            iterationMode: "collection",
            collectionInputKey: "input-dataset",
            bodyStepIds: ["step-load"],
          },
        },
      ],
      outputs: [{
        id: "output-1",
        type: "workflow-output",
        outputType: WorkflowDraftOutputTypes.record,
        format: WorkflowDraftOutputFormats.json,
        sourceStepId: "step-loop",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.systemEntry,
          target: "records/customers",
        },
      }],
    });

    expect(result.valid).toBeTrue();
    expect(result.issues).toEqual([]);
  });

  it("returns structured validation issues for malformed trigger/input/step/output and cross-section references", () => {
    const result = validateWorkflowDraft({
      triggers: [{
        id: "trigger-invalid",
        kind: WorkflowDraftTriggerKinds.temporal,
        type: WorkflowDraftTriggerTypes.temporalSchedule,
        config: {},
      }],
      inputs: [{
        id: "input-dataset",
        type: "dataset",
        sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
        asset: { assetId: "dataset-without-canonical-prefix" },
      }],
      steps: [
        { id: "step-1", type: "action", kind: WorkflowDraftStepKinds.action, order: 1, dependsOnStepIds: ["step-2"] },
        { id: "step-2", type: "action", kind: WorkflowDraftStepKinds.action, order: 3, dependsOnStepIds: ["step-1"] },
        {
          id: "step-agent",
          type: WorkflowDraftStepTypes.agentAssistant,
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 4,
          assetRef: {
            assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
            asset: { assetId: "assistant-without-prefix" },
          },
        },
      ],
      outputs: [{
        id: "output-1",
        type: "workflow-output",
        outputType: WorkflowDraftOutputTypes.record,
        format: WorkflowDraftOutputFormats.json,
        sourceStepId: "step-unknown",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.fileExport,
          target: "/tmp/export.json",
        },
      }],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.triggerMalformed)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.inputDatasetAssetMalformed)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepOrderNonContiguous)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepDependencyCycle)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepAssetReferenceMalformed)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.outputSourceStepMissing)).toBeTrue();
    expect(result.issues.every((issue) => typeof issue.code === "string" && typeof issue.section === "string")).toBeTrue();
  });

  it("validates lifecycle states and executable readiness on canonical workflow entities", () => {
    const readyEntity = createWorkflowEntity({
      id: "workflow-ready",
      name: "Workflow Ready",
      lifecycleState: WorkflowLifecycleStates.executable,
      draft: {
        triggers: [],
        inputs: [],
        steps: [{ id: "step-1", type: "action", kind: WorkflowDraftStepKinds.action, order: 1 }],
        outputs: [],
      },
    });

    expect(validateWorkflowEntity(readyEntity).valid).toBeTrue();

    const notReady = createWorkflowEntity({
      id: "workflow-not-ready",
      name: "Workflow Not Ready",
      lifecycleState: WorkflowLifecycleStates.saved,
      draft: {
        triggers: [],
        inputs: [],
        steps: [{
          id: "step-loop",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            iterationMode: "collection",
            collectionInputKey: "input-missing",
            bodyStepIds: ["step-loop-body"],
          },
        }],
        outputs: [],
      },
    });

    const executableCandidate = Object.freeze({
      ...notReady,
      lifecycleState: WorkflowLifecycleStates.executable,
    });
    const validation = validateWorkflowEntity(executableCandidate);
    expect(validation.valid).toBeFalse();
    expect(validation.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.loopCollectionInputMissing)).toBeTrue();
    expect(validation.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.lifecycleExecutableNotReady)).toBeTrue();
  });

  it("enforces canonical workflow lifecycle transitions", () => {
    const base = createWorkflowEntity({
      id: "workflow-lifecycle",
      name: "Workflow Lifecycle",
      lifecycleState: WorkflowLifecycleStates.draft,
      draft: {
        triggers: [],
        inputs: [],
        steps: [{ id: "step-1", type: "action", kind: WorkflowDraftStepKinds.action, order: 1 }],
        outputs: [],
      },
    });

    expect(isWorkflowLifecycleTransitionAllowed(WorkflowLifecycleStates.draft, WorkflowLifecycleStates.saved)).toBeTrue();
    expect(isWorkflowLifecycleTransitionAllowed(WorkflowLifecycleStates.draft, WorkflowLifecycleStates.executable)).toBeFalse();
    expect(isWorkflowLifecycleTransitionAllowed(WorkflowLifecycleStates.executable, WorkflowLifecycleStates.draft)).toBeFalse();

    const saved = transitionWorkflowEntityLifecycle(base, WorkflowLifecycleStates.saved, new Date("2026-03-29T15:00:00.000Z"));
    expect(saved.lifecycleState).toBe(WorkflowLifecycleStates.saved);

    const executable = transitionWorkflowEntityLifecycle(saved, WorkflowLifecycleStates.executable, new Date("2026-03-29T15:01:00.000Z"));
    expect(executable.lifecycleState).toBe(WorkflowLifecycleStates.executable);

    expect(() => transitionWorkflowEntityLifecycle(base, WorkflowLifecycleStates.executable)).toThrow("cannot transition");
    expect(() => transitionWorkflowEntityLifecycle(executable, WorkflowLifecycleStates.draft)).toThrow("cannot transition");
  });

  it("rejects executable lifecycle creation when workflow readiness validation fails", () => {
    expect(() => createWorkflowEntity({
      id: "workflow-executable-invalid",
      name: "Workflow Executable Invalid",
      lifecycleState: WorkflowLifecycleStates.executable,
      draft: {
        triggers: [],
        inputs: [],
        steps: [{
          id: "step-loop",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            iterationMode: "collection",
            bodyStepIds: ["step-body"],
          },
        }],
        outputs: [],
      },
    })).toThrow("requires a valid canonical workflow draft");
  });

  it("creates composite workflow taxonomy with deterministic default behavior", () => {
    const taxonomy = createWorkflowStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("composite");
    expect(taxonomy.semanticRole).toBe("workflow");
    expect(taxonomy.behaviorKind).toBe("deterministic");
  });

  it("supports valid workflow orchestrator behavior kinds", () => {
    expect(createWorkflowStudioTaxonomy("deterministic").behaviorKind).toBe("deterministic");
    expect(createWorkflowStudioTaxonomy("conditional").behaviorKind).toBe("conditional");
    expect(createWorkflowStudioTaxonomy("iterative").behaviorKind).toBe("iterative");
  });

  it("builds workflow metadata with composite taxonomy and generated provenance defaults", () => {
    const metadata = createWorkflowAssetMetadata({
      title: "Workflow Draft",
      summary: "Workflow orchestrator asset",
      tags: ["studio-shell"],
      creatorId: "author-1",
      behaviorKind: "conditional",
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
    });

    expect(metadata.tags).toEqual(["workflow", "studio-shell"]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(WorkflowStudioIdentity.studioType);
    expect(metadata.provenance?.creatorId).toBe("author-1");
  });
});
