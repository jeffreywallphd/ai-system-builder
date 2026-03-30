import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { WorkflowStudioApplicationService } from "../WorkflowStudioApplicationService";
import {
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowStudioIdentity,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { this.studios.set(studio.id, studio); return studio; }
  async getStudio(studioId: string): Promise<Studio | undefined> { return this.studios.get(studioId); }
  async saveSession(session: AssetSession): Promise<AssetSession> { this.sessions.set(session.id, session); return session; }
  async getSession(sessionId: string): Promise<AssetSession | undefined> { return this.sessions.get(sessionId); }
  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> { return [...this.sessions.values()].filter((entry) => entry.studioId === studioId); }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { this.drafts.set(draft.id, draft); return draft; }
  async getDraft(draftId: string): Promise<AssetDraft | undefined> { return this.drafts.get(draftId); }
  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId); }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> { return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId); }
}

describe("WorkflowStudioApplicationService", () => {
  it("authors workflow drafts with composite workflow taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow Orchestrator Draft",
      content: serializeWorkflowDraft(createEmptyWorkflowDraft()),
      creatorId: "author-1",
      tags: ["orchestrator"],
      behaviorKind: "iterative",
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    expect(ensure.studio.id).toBe(WorkflowStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("composite");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("workflow");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("iterative");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.contract?.parameters.find((parameter) => parameter.id === "workflowMode")?.defaultValue).toBe("iterative");
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual(["workflow", "orchestrator"]);
  });

  it("reuses shared lifecycle/version flow when publishing workflow drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow Draft",
      content: "{}",
      dependencies: [{ assetId: "asset:tool-chain", versionId: "asset:tool-chain:v1" }],
    });

    const published = await service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("workflow-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["workflow-version-1"]);
  });

  it("blocks publish when workflow draft taxonomy semantic role drifts outside composite workflow expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow",
      content: "{}",
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    await studioShell.updateAssetDraft({
      studioId: WorkflowStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "composite", semanticRole: "tool-chain", behaviorKind: "deterministic" },
      },
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-invalid",
    })).rejects.toThrow("taxonomy-semantic-role-mismatch");
  });

  it("blocks publish when workflow draft dependencies are unpinned", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow",
      content: "{}",
      dependencies: [{ assetId: "asset:model" }],
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-unpinned",
    })).rejects.toThrow("dependency-version-unpinned");
  });

  it("blocks publish when canonical workflow draft content fails domain validation", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow",
      content: JSON.stringify({
        triggers: [
          {
            id: "trigger-temporal",
            kind: "temporal",
            type: "schedule",
            config: {},
          },
        ],
        inputs: [],
        steps: [],
        outputs: [],
      }),
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-invalid-content",
    })).rejects.toThrow("Workflow draft content is malformed");
  });

  it("blocks publish when workflow asset references violate canonical taxonomy expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createWorkflowDraft({
      sessionId: ensure.session.id,
      title: "Workflow taxonomy mismatch",
      content: JSON.stringify({
        triggers: [],
        inputs: [{
          id: "input-dataset",
          type: "dataset",
          sourceType: "dataset-asset",
          asset: {
            assetId: "asset:dataset-customers",
            taxonomy: {
              structuralKind: "atomic",
              semanticRole: "tool",
              behaviorKind: "deterministic",
            },
          },
        }],
        steps: [],
        outputs: [],
      }),
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    await expect(service.publishWorkflowDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "workflow-version-taxonomy-mismatch",
    })).rejects.toThrow("input-malformed");
  });

  it("maps canonical workflow draft content into deterministic execution planning elements", () => {
    const repository = new InMemoryStudioShellRepository();
    const studioShell = new DefaultStudioShellApplicationService(repository, () => "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const content = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        },
        {
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalRecurring,
          config: {
            every: 2,
            unit: "hours",
          },
        },
      ],
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: "action",
          order: 1,
        },
        {
          id: "step-2",
          type: "if-then",
          kind: "control-flow",
          order: 2,
          config: {
            conditionExpression: "inputs.ok",
            thenStepIds: ["step-3"],
          },
        },
        {
          id: "step-3",
          type: "manual-approval",
          kind: "control-flow",
          order: 3,
          config: {
            prompt: "Approve",
            interactionMode: "approval",
            outcomes: {
              approve: {
                stepIds: ["step-4"],
              },
            },
          },
        },
        {
          id: "step-4",
          type: "action",
          kind: "action",
          order: 4,
        },
      ],
      outputs: [
        {
          id: "output-file",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "file-download",
          },
        },
      ],
    });

    const firstPlan = service.planWorkflowDraftExecution({ content });
    const secondPlan = service.planWorkflowDraftExecution({ content });

    expect(firstPlan.schemaVersion).toBe("ai-loom.workflow-draft-execution-plan.v1");
    expect(firstPlan.triggers.map((trigger) => trigger.triggerId)).toEqual([
      "trigger-manual",
      "trigger-temporal",
    ]);
    expect(firstPlan.triggers.map((trigger) => trigger.runtimeKind)).toEqual(["manual", "temporal"]);
    expect(firstPlan.elements.map((entry) => entry.elementType)).toEqual([
      "action-step",
      "built-in.if-then",
      "built-in.manual-approval",
      "action-step",
    ]);
    expect(firstPlan.outputs).toMatchObject([
      {
        outputId: "output-file",
        order: 1,
        destination: {
          type: WorkflowDraftOutputDestinationTypes.fileExport,
        },
      },
    ]);
    expect(firstPlan).toEqual(secondPlan);
  });

  it("rejects workflow execution planning for malformed or invalid canonical draft content", () => {
    const repository = new InMemoryStudioShellRepository();
    const studioShell = new DefaultStudioShellApplicationService(repository, () => "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    expect(() => service.planWorkflowDraftExecution({
      content: "{invalid-json}",
    })).toThrow("Workflow draft content is malformed");

    expect(() => service.planWorkflowDraftExecution({
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        steps: [
          {
            id: "step-manual",
            type: "manual-approval",
            kind: "control-flow",
            order: 2,
            config: {
              prompt: "Approve",
              interactionMode: "approval",
              outcomes: {
                approve: {
                  stepIds: ["step-action"],
                },
              },
            },
          },
          {
            id: "step-action",
            type: "action",
            kind: "action",
            order: 1,
          },
        ],
      }),
    })).toThrow("built-in-step-reference-order-invalid");
  });

  it("executes planned built-in workflow steps through runtime with deterministic outputs", async () => {
    const repository = new InMemoryStudioShellRepository();
    const studioShell = new DefaultStudioShellApplicationService(repository, () => "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const result = await service.executeWorkflowDraft({
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        steps: [
          {
            id: "step-if",
            type: "if-then",
            kind: "control-flow",
            order: 1,
            config: {
              conditionExpression: "inputs.score > 0.5",
              thenStepIds: ["step-approve"],
              elseStepIds: ["step-reject"],
            },
          },
          {
            id: "step-approve",
            type: "manual-approval",
            kind: "control-flow",
            order: 2,
            config: {
              prompt: "Approve release",
              interactionMode: "approval",
              outcomes: {
                approve: {
                  stepIds: ["step-delay"],
                },
              },
            },
          },
          {
            id: "step-reject",
            type: "action",
            kind: "action",
            order: 3,
          },
          {
            id: "step-delay",
            type: "delay-wait",
            kind: "control-flow",
            order: 4,
            config: {
              durationSeconds: 1,
            },
          },
        ],
      }),
      inputs: {
        score: 0.9,
      },
      manualDecisionsByStepId: {
        "step-approve": {
          outcome: "approve",
        },
      },
    });

    expect(result.status).toBe("completed");
    expect(result.traces.filter((entry) => entry.status === "completed").map((entry) => entry.stepId)).toEqual([
      "step-if",
      "step-approve",
      "step-delay",
    ]);
    expect(result.traces.some((entry) => entry.stepId === "step-reject" && entry.status === "skipped")).toBeTrue();
  });

  it("blocks manual run when canonical pre-execution validation fails", async () => {
    const repository = new InMemoryStudioShellRepository();
    const studioShell = new DefaultStudioShellApplicationService(repository, () => "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const result = await service.runWorkflowDraftManual({
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
          config: {},
        }],
        steps: [],
      }),
    });

    expect(result.launchStatus).toBe("blocked");
    expect(result.validation.ready).toBeFalse();
    expect(result.validation.blockingIssues.length).toBeGreaterThan(0);
  });

  it("launches manual run when canonical pre-execution validation succeeds", async () => {
    const repository = new InMemoryStudioShellRepository();
    const studioShell = new DefaultStudioShellApplicationService(repository, () => "generated");
    const service = new WorkflowStudioApplicationService(studioShell);

    const result = await service.runWorkflowDraftManual({
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: "action",
          order: 1,
        }],
      }),
    });

    expect(result.launchStatus).toBe("launched");
    expect(result.validation.ready).toBeTrue();
    expect(result.runtimeResult?.status === "completed" || result.runtimeResult?.status === "paused").toBeTrue();
  });
});
