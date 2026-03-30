import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { AssetDraftLifecycleStatuses } from "../../../../domain/studio-shell/StudioShellDomain";
import { DefaultStudioShellApplicationService } from "../../../../application/studio-shell/DefaultStudioShellApplicationService";
import { StudioShellBackendApi } from "../../../api/studio-shell/StudioShellBackendApi";
import { SqliteStudioShellRepository } from "../SqliteStudioShellRepository";
import {
  WorkflowDraftTriggerTypes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteStudioShellRepository", () => {
  it("round-trips studio shell aggregates across persistence and rehydration", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-"));
    createdRoots.push(root);
    const repository = new SqliteStudioShellRepository(path.join(root, "studio-shell.sqlite"));
    const idQueue = ["session-1", "draft-1"];
    const service = new DefaultStudioShellApplicationService(repository, () => idQueue.shift() ?? "generated");

    await service.initializeStudio({ studioId: "studio-roundtrip", name: "Roundtrip" });
    const created = await service.createAssetDraft({
      studioId: "studio-roundtrip",
      sessionId: "session-1",
      content: "draft-v1",
      metadata: {
        title: "  Draft Roundtrip  ",
        tags: ["authoring", "authoring"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
        provenance: {
          creatorId: "creator-1",
          sourceType: "derived",
          upstreamAssets: [{ assetId: "asset:seed", versionId: "asset:seed:v1", relationship: "DERIVED_FROM" }],
        },
      },
      dependencies: [
        { assetId: "asset:dependency", versionId: "asset:dependency:v1" },
        { assetId: "asset:dependency", versionId: "asset:dependency:v1" },
      ],
    });

    await service.transitionAssetDraftLifecycle({
      studioId: "studio-roundtrip",
      sessionId: "session-1",
      draftId: created.draft.id,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    await service.publishAssetDraftVersion({
      studioId: "studio-roundtrip",
      sessionId: "session-1",
      draftId: created.draft.id,
      versionId: "asset:studio-roundtrip:v1",
    });

    const loadedDraft = await repository.getDraft(created.draft.id);
    const loadedStudio = await repository.getStudio("studio-roundtrip");
    const loadedSession = await repository.getSession("session-1");
    const versions = await repository.listAssetVersionsByAssetId(created.draft.assetId);

    expect(loadedStudio?.id).toBe("studio-roundtrip");
    expect(loadedSession?.currentDraftId).toBe(created.draft.id);
    expect(loadedDraft?.metadata.title).toBe("Draft Roundtrip");
    expect(loadedDraft?.dependencies).toEqual([{ assetId: "asset:dependency", versionId: "asset:dependency:v1" }]);
    expect(loadedDraft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(loadedDraft?.publishedVersionIds).toEqual(["asset:studio-roundtrip:v1"]);
    expect(versions.map((entry) => entry.versionId)).toEqual(["asset:studio-roundtrip:v1"]);

    repository.dispose();
  });

  it("supports backend snapshot and version history after repository reload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "studio-shell.sqlite");

    {
      const repository = new SqliteStudioShellRepository(databasePath);
      const idQueue = ["session-1", "draft-1"];
      const service = new DefaultStudioShellApplicationService(repository, () => idQueue.shift() ?? "generated");

      await service.initializeStudio({ studioId: "studio-reload", name: "Reload" });
      await service.createAssetDraft({
        studioId: "studio-reload",
        sessionId: "session-1",
        content: "initial",
        metadata: { title: "Reload Draft", tags: ["reload"] },
      });

      repository.dispose();
    }

    const repository = new SqliteStudioShellRepository(databasePath);
    const api = new StudioShellBackendApi(repository);

    const snapshot = await api.loadSnapshot("studio-reload");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.content).toBe("initial");
    expect(snapshot.data?.validationIssues.some((entry) => entry.code === "taxonomy-missing")).toBeTrue();

    repository.dispose();
  });

  it("persists and rehydrates workflow built-in steps in canonical draft content across reload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-builtins-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-builtins.sqlite");

    const builtInDraftContent = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-if",
          type: WorkflowDraftBuiltInStepTypes.ifThen,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            conditionExpression: "inputs.score > 0.8",
            thenStepIds: ["step-loop"],
            elseStepIds: ["step-manual"],
          },
        },
        {
          id: "step-loop",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          config: {
            repeatCount: 2,
            bodyStepIds: ["step-delay"],
          },
        },
        {
          id: "step-delay",
          type: WorkflowDraftBuiltInStepTypes.delayWait,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 3,
          config: {
            durationSeconds: 5,
          },
        },
        {
          id: "step-manual",
          type: WorkflowDraftBuiltInStepTypes.manualApproval,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 4,
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
      ],
    });

    let draftId = "";
    {
      const repository = new SqliteStudioShellRepository(databasePath);
      const service = new DefaultStudioShellApplicationService(repository, () => "generated");
      await service.initializeStudio({ studioId: "studio-workflows", name: "Workflow Studio" });
      const created = await service.createAssetDraft({
        studioId: "studio-workflows",
        sessionId: "generated",
        content: builtInDraftContent,
        metadata: {
          title: "Built-in workflow draft",
          taxonomy: {
            structuralKind: "composite",
            semanticRole: "workflow",
            behaviorKind: "conditional",
          },
        },
      });
      draftId = created.draft.id;
      repository.dispose();
    }

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopened = await reopenedRepository.getDraft(draftId);
    const canonical = deserializeWorkflowDraft(reopened?.content ?? "{}");
    expect(canonical.steps.map((step) => step.type)).toEqual([
      WorkflowDraftBuiltInStepTypes.ifThen,
      WorkflowDraftBuiltInStepTypes.loopIteration,
      WorkflowDraftBuiltInStepTypes.delayWait,
      WorkflowDraftBuiltInStepTypes.manualApproval,
    ]);
    expect(canonical.steps.map((step) => step.order)).toEqual([1, 2, 3, 4]);
    expect((canonical.steps[0]?.config as { conditionExpression?: string }).conditionExpression).toBe("inputs.score > 0.8");
    expect((canonical.steps[3]?.config as { prompt?: string }).prompt).toBe("Approve release");
    reopenedRepository.dispose();
  });

  it("persists and rehydrates workflow triggers in canonical draft content across reload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-triggers-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-triggers.sqlite");

    const triggerDraftContent = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {
            invocationScope: "workflow-start",
          },
        },
        {
          id: "trigger-schedule",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
          config: {
            scheduleMode: "cron",
            cronExpression: "0 9 * * *",
            timezone: "America/New_York",
          },
        },
        {
          id: "trigger-state",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateAssetStateChanged,
          config: {
            sourceType: "asset",
            eventCategory: "asset-updated",
            subject: "asset",
            asset: {
              assetId: "asset:dataset-source",
            },
            stateKey: "status",
            stateValue: "ready",
          },
        },
      ],
    });

    let draftId = "";
    {
      const repository = new SqliteStudioShellRepository(databasePath);
      const service = new DefaultStudioShellApplicationService(repository, () => "generated");
      await service.initializeStudio({ studioId: "studio-workflows", name: "Workflow Studio" });
      const created = await service.createAssetDraft({
        studioId: "studio-workflows",
        sessionId: "generated",
        content: triggerDraftContent,
        metadata: {
          title: "Workflow trigger draft",
          taxonomy: {
            structuralKind: "composite",
            semanticRole: "workflow",
            behaviorKind: "conditional",
          },
        },
      });
      draftId = created.draft.id;
      repository.dispose();
    }

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopened = await reopenedRepository.getDraft(draftId);
    const canonical = deserializeWorkflowDraft(reopened?.content ?? "{}");
    expect(canonical.triggers.map((trigger) => trigger.id)).toEqual([
      "trigger-manual",
      "trigger-schedule",
      "trigger-state",
    ]);
    expect(canonical.triggers.map((trigger) => trigger.type)).toEqual([
      WorkflowDraftTriggerTypes.userManual,
      WorkflowDraftTriggerTypes.temporalSchedule,
      WorkflowDraftTriggerTypes.stateAssetStateChanged,
    ]);
    expect(canonical.triggers[1]?.config).toEqual(expect.objectContaining({
      cronExpression: "0 9 * * *",
      timezone: "America/New_York",
    }));
    expect(canonical.triggers[2]?.config).toEqual(expect.objectContaining({
      asset: {
        assetId: "asset:dataset-source",
      },
      stateKey: "status",
      stateValue: "ready",
    }));
    reopenedRepository.dispose();
  });
});
