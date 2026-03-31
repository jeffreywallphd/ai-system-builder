import { describe, expect, it } from "bun:test";
import { AssetDraftLifecycleStatuses } from "../../../../domain/studio-shell/StudioShellDomain";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";

describe("StudioShellBackendApi", () => {
  it("projects the same validation issue structure for atomic model/dataset/tool drafts", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const drafts: Array<{ studioId: string; semanticRole: "model" | "dataset" | "tool"; behaviorKind: "none" | "conditional" }> = [
      { studioId: "studio-models", semanticRole: "model", behaviorKind: "none" },
      { studioId: "studio-datasets", semanticRole: "dataset", behaviorKind: "none" },
      { studioId: "studio-tools", semanticRole: "tool", behaviorKind: "conditional" },
    ];

    for (const entry of drafts) {
      const initialized = await api.initializeStudio(entry.studioId, entry.studioId);
      const sessionId = initialized.data!.activeSessionId!;
      await api.createDraft({
        studioId: entry.studioId,
        sessionId,
        content: "{}",
        metadata: {
          title: `${entry.semanticRole}-draft`,
          tags: [entry.semanticRole],
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: entry.semanticRole,
            behaviorKind: entry.behaviorKind,
          },
          contract: {
            version: "1.0.0",
            input: { kind: "json-schema" },
            output: { kind: "json-schema" },
          },
          provenance: {
            sourceType: "generated",
            sourceLabel: `${entry.semanticRole}-studio`,
          },
        },
        dependencies: [],
      });

      const snapshot = await api.loadSnapshot(entry.studioId);
      const codes = (snapshot.data?.validationIssues ?? []).map((issue) => issue.code).sort();
      expect(codes).toEqual(["lifecycle-not-publish-ready", "version-history-empty"]);
    }
  });

  it("builds a bounded snapshot and validation issue projection for active draft surfaces", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const initialized = await api.initializeStudio("studio-shell-test", "Studio Shell Test");
    expect(initialized.ok).toBeTrue();
    expect(initialized.data?.activeSessionId).toBeDefined();

    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    await api.createDraft({
      studioId: "studio-shell-test",
      sessionId: sessionId!,
      content: "draft-body",
      metadata: {
        title: "Draft",
        tags: ["shell"],
      },
      dependencies: [{ assetId: "asset:seed" }],
    });

    const snapshot = await api.loadSnapshot("studio-shell-test");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.content).toBe("draft-body");
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "taxonomy-missing")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "contract-missing")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "provenance-missing")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "dependency-version-unpinned")).toBeTrue();
    expect(snapshot.data?.validationIssues.some((issue) => issue.code === "lifecycle-not-publish-ready")).toBeTrue();
  });

  it("maps publish gating and lifecycle failures as typed API errors", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-shell-lifecycle", "Lifecycle Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const created = await api.createDraft({
      studioId: "studio-shell-lifecycle",
      sessionId,
      content: "body",
      metadata: { title: "Draft", tags: [] },
    });
    const draftId = created.data!.draft!.draftId;

    const invalidPublish = await api.publishVersion({
      studioId: "studio-shell-lifecycle",
      sessionId,
      draftId,
    });
    expect(invalidPublish.ok).toBeFalse();
    expect(invalidPublish.error?.code).toBe("invalid-lifecycle-transition");

    const transitioned = await api.transitionLifecycle({
      studioId: "studio-shell-lifecycle",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(transitioned.ok).toBeTrue();

    const published = await api.publishVersion({
      studioId: "studio-shell-lifecycle",
      sessionId,
      draftId,
    });
    expect(published.ok).toBeTrue();
    expect((published.data?.versions.length ?? 0) > 0).toBeTrue();
  });

  it("supports composite workflow drafts over the same shared validation/lifecycle/publish seams", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const created = await api.createDraft({
      studioId: "studio-workflows",
      sessionId,
      content: "{\"workflowSpec\":{\"steps\":[]}}",
      metadata: {
        title: "workflow-draft",
        tags: ["workflow", "composite"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "workflow-studio",
        },
      },
      dependencies: [],
    });

    expect(created.ok).toBeTrue();
    expect(created.data?.validationIssues.some((issue) => issue.code === "composite-dependency-recommended")).toBeTrue();

    const draftId = created.data!.draft!.draftId;
    await api.updateDependencies({
      studioId: "studio-workflows",
      sessionId,
      draftId,
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    const validated = await api.transitionLifecycle({
      studioId: "studio-workflows",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await api.publishVersion({
      studioId: "studio-workflows",
      sessionId,
      draftId,
      versionId: "asset:studio-workflows:v1",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
  });

  it("supports composite context-bundle drafts over the same shared validation/lifecycle/publish seams", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-context-bundles", "Context Bundle Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const created = await api.createDraft({
      studioId: "studio-context-bundles",
      sessionId,
      content: "{\"contextBundleSpec\":{\"packageRefs\":[],\"recipeRefs\":[]}}",
      metadata: {
        title: "context-bundle-draft",
        tags: ["context-bundle", "composite"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "context-bundle",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "text" },
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "context-bundle-studio",
        },
      },
      dependencies: [],
    });

    expect(created.ok).toBeTrue();
    expect(created.data?.validationIssues.some((issue) => issue.code === "composite-dependency-recommended")).toBeTrue();

    const draftId = created.data!.draft!.draftId;
    await api.updateDependencies({
      studioId: "studio-context-bundles",
      sessionId,
      draftId,
      dependencies: [{ assetId: "asset:context-recipe", versionId: "asset:context-recipe:v1" }],
    });

    const validated = await api.transitionLifecycle({
      studioId: "studio-context-bundles",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await api.publishVersion({
      studioId: "studio-context-bundles",
      sessionId,
      draftId,
      versionId: "asset:studio-context-bundles:v1",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
  });

  it("supports system drafts over the same shared validation/lifecycle/publish seams", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-systems", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const created = await api.createDraft({
      studioId: "studio-systems",
      sessionId,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[]}}",
      metadata: {
        title: "system-draft",
        tags: ["system", "system-composition"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "system-studio",
        },
      },
      dependencies: [{ assetId: "asset:system-child", versionId: "asset:system-child:v1" }],
    });

    expect(created.ok).toBeTrue();
    expect(created.data?.validationIssues.some((issue) => issue.code === "composite-dependency-recommended")).toBeFalse();

    const draftId = created.data!.draft!.draftId;
    const validated = await api.transitionLifecycle({
      studioId: "studio-systems",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await api.publishVersion({
      studioId: "studio-systems",
      sessionId,
      draftId,
      versionId: "asset:studio-systems:v1",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
  });

  it("blocks manual workflow launch when execution readiness validation fails", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const run = await api.runWorkflowDraft({
      studioId: "studio-workflows",
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

    expect(run.ok).toBeTrue();
    expect(run.data?.launchStatus).toBe("blocked");
    expect(run.data?.execution.state).toBe("failed");
    expect(run.data?.execution.launchAccepted).toBeFalse();
    expect(run.data?.execution.failure?.kind).toBe("validation-failure");
    expect(run.data?.validation.ready).toBeFalse();
    expect((run.data?.validation.blockingIssueCount ?? 0) > 0).toBeTrue();
    expect(run.data?.validation.issues.some((issue) => issue.code === "trigger-malformed")).toBeTrue();
  });

  it("assesses workflow execution readiness without launching runtime execution", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const blocked = await api.assessWorkflowExecutionReadiness({
      studioId: "studio-workflows",
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

    expect(blocked.ok).toBeTrue();
    expect(blocked.data?.ready).toBeFalse();
    expect((blocked.data?.blockingIssueCount ?? 0) > 0).toBeTrue();
    expect(blocked.data?.issues.some((issue) => issue.code === "trigger-malformed")).toBeTrue();

    const ready = await api.assessWorkflowExecutionReadiness({
      studioId: "studio-workflows",
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

    expect(ready.ok).toBeTrue();
    expect(ready.data?.ready).toBeTrue();
    expect(ready.data?.blockingIssueCount).toBe(0);
  });

  it("launches manual workflow execution when validation and translation pass", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const run = await api.runWorkflowDraft({
      studioId: "studio-workflows",
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
        outputs: [{
          id: "output-1",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.webViewer,
            target: "preview",
            options: {
              title: "Viewer",
            },
          },
        }],
      }),
      inputValues: {
        prompt: "hello",
      },
    });

    expect(run.ok).toBeTrue();
    expect(run.data?.launchStatus).toBe("launched");
    expect(run.data?.execution.state).toBe("completed");
    expect(run.data?.execution.launchAccepted).toBeTrue();
    expect(run.data?.validation.ready).toBeTrue();
    expect(run.data?.planSummary?.stepCount).toBe(1);
    expect(run.data?.runtime?.status === "completed" || run.data?.runtime?.status === "paused").toBeTrue();
    expect((run.data?.runtime?.outputDelivery?.deliveredCount ?? 0) >= 1).toBeTrue();
    expect(run.data?.runtime?.outputDelivery?.results[0]).toEqual(expect.objectContaining({
      outputId: "output-1",
      destinationType: WorkflowDraftOutputDestinationTypes.webViewer,
      target: "preview",
      status: "delivered",
    }));
  });

  it("supports trigger-aware entry for temporal and state workflow activations", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const temporalRun = await api.runWorkflowDraft({
      studioId: "studio-workflows",
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
          config: {
            runAt: "2027-01-01T00:00:00.000Z",
          },
        }],
        inputs: [{
          id: "input-key",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "key",
          required: true,
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: "action",
          order: 1,
        }],
      }),
      triggerEntry: {
        sourceKind: "temporal",
        triggerId: "trigger-temporal",
      },
    });
    expect(temporalRun.ok).toBeTrue();
    expect(temporalRun.data?.launchStatus).toBe("blocked");
    expect(temporalRun.data?.execution.failure?.kind).toBe("validation-failure");
    expect(temporalRun.data?.validation.issues.some((issue) => issue.code === "input-resolution-required-missing")).toBeTrue();

    const stateRun = await api.runWorkflowDraft({
      studioId: "studio-workflows",
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-state",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: {
            sourceType: "system",
            eventCategory: "system-state-changed",
            eventName: "customer-updated",
          },
        }],
        inputs: [{
          id: "input-customer-id",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "customerId",
          required: true,
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: "action",
          order: 1,
        }],
      }),
      triggerEntry: {
        sourceKind: "state-data",
        triggerId: "trigger-state",
        payload: {
          customerId: "customer-7",
        },
      },
    });

    expect(stateRun.ok).toBeTrue();
    expect(stateRun.data?.launchStatus).toBe("launched");
    expect(stateRun.data?.execution.state).toBe("completed");
    expect(stateRun.data?.validation.ready).toBeTrue();
  });

  it("reports output-delivery runtime failures with structured execution failure metadata", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const run = await api.runWorkflowDraft({
      studioId: "studio-workflows",
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
        outputs: [{
          id: "output-file",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "workspace-file",
            options: {
              deliveryMode: "workspace-file",
            },
          },
        }],
      }),
    });

    expect(run.ok).toBeTrue();
    expect(run.data?.launchStatus).toBe("failed");
    expect(run.data?.execution.state).toBe("failed");
    expect(run.data?.execution.failure?.kind).toBe("output-delivery-failure");
    expect(run.data?.runtime?.status).toBe("failed");
    expect((run.data?.runtime?.outputDelivery?.failedCount ?? 0) > 0).toBeTrue();
  });

  it("surfaces version-aware dependency mismatch validation for composite drafts", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());

    const atomicInit = await api.initializeStudio("studio-models", "Model Studio");
    const atomicSessionId = atomicInit.data!.activeSessionId!;
    const atomicDraft = await api.createDraft({
      studioId: "studio-models",
      sessionId: atomicSessionId,
      content: "{}",
      metadata: {
        title: "model-draft",
        tags: ["model"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "model",
          behaviorKind: "none",
        },
        contract: { version: "1.0.0", input: { kind: "json-schema" }, output: { kind: "json-schema" } },
        provenance: { sourceType: "generated", sourceLabel: "model-studio" },
      },
    });
    const atomicDraftId = atomicDraft.data!.draft!.draftId;
    await api.transitionLifecycle({
      studioId: "studio-models",
      sessionId: atomicSessionId,
      draftId: atomicDraftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await api.publishVersion({
      studioId: "studio-models",
      sessionId: atomicSessionId,
      draftId: atomicDraftId,
      versionId: "asset:model:v1",
    });

    const compositeInit = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const compositeSessionId = compositeInit.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-workflows",
      sessionId: compositeSessionId,
      content: "{\"workflowSpec\":{\"steps\":[]}}",
      metadata: {
        title: "workflow-draft",
        tags: ["workflow"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "workflow-studio",
        },
      },
      dependencies: [{ assetId: "asset:dataset", versionId: "asset:model:v1" }],
    });

    expect(created.ok).toBeTrue();
    expect(created.data?.validationIssues.some((issue) => issue.code === "dependency-asset-version-mismatch")).toBeTrue();
  });

});
