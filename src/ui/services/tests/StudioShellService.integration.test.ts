import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { DesktopStudioShellBridge } from "../../../electron/shared/DesktopContracts";
import { StudioShellBackendApi } from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import { SystemStudioBackendApi } from "@infrastructure/api/system-studio/SystemStudioBackendApi";
import { SystemRuntimeBackendApi } from "@infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import { SqliteStudioShellRepository } from "@infrastructure/filesystem/studio-shell/SqliteStudioShellRepository";
import { SqliteSystemRuntimeExecutionStore } from "@infrastructure/filesystem/system-runtime/SqliteSystemRuntimeExecutionStore";
import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { InMemoryWorkflowPersistenceRepository } from "@infrastructure/workflows/InMemoryWorkflowPersistenceRepository";
import { AssetDraftLifecycleStatuses } from "@domain/studio-shell/StudioShellDomain";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import { StudioShellService } from "../StudioShellService";
import { CompositionAssetContractResolver } from "@application/contracts/CompositionAssetContractResolver";
import { InMemoryWorkflowRunSummaryRepository } from "@infrastructure/workflows/InMemoryWorkflowRunSummaryRepository";
import {
  createWorkflowRunDetailRecord,
  createWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
} from "@domain/workflow-studio/WorkflowRunHistoryDomain";

const createdRoots: string[] = [];

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function unsupportedSystemOperation() {
  return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
}

function installBridge(
  api: StudioShellBackendApi,
  systemApi?: SystemStudioBackendApi,
  runtimeApi?: SystemRuntimeBackendApi,
): void {
  const bridge: DesktopStudioShellBridge = {
    initializeStudio(studioId: string, name: string) {
      return api.initializeStudio(studioId, name).then((response) => JSON.stringify(response));
    },
    loadSnapshot(studioId: string) {
      return api.loadSnapshot(studioId).then((response) => JSON.stringify(response));
    },
    startSession(studioId: string) {
      return api.startSession(studioId).then((response) => JSON.stringify(response));
    },
    createDraft(requestJson: string) {
      return api.createDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateDraft(requestJson: string) {
      return api.updateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateDependencies(requestJson: string) {
      return api.updateDependencies(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    transitionLifecycle(requestJson: string) {
      return api.transitionLifecycle(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    publishVersion(requestJson: string) {
      return api.publishVersion(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    validateDraft(requestJson: string) {
      return api.validateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listImageWorkflowDefinitions(requestJson: string) {
      return api.listImageWorkflowDefinitions(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getImageWorkflowDefinition(requestJson: string) {
      return api.getImageWorkflowDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getPersistedWorkflow(workflowId: string) {
      return api.getPersistedWorkflow(workflowId).then((response) => JSON.stringify(response));
    },
    duplicatePersistedWorkflow(requestJson: string) {
      return api.duplicatePersistedWorkflow(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    assessWorkflowExecutionReadiness(requestJson: string) {
      return api.assessWorkflowExecutionReadiness(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    runWorkflowDraft(requestJson: string) {
      return api.runWorkflowDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    assessDataStudioExecutionReadiness(requestJson: string) {
      return api.assessDataStudioExecutionReadiness(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    runDataStudioPipeline(requestJson: string) {
      return api.runDataStudioPipeline(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listDataStudioPipelines(requestJson: string) {
      return api.listDataStudioPipelines(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    loadDataStudioPipeline(requestJson: string) {
      return api.loadDataStudioPipeline(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listWorkflowRuns(requestJson: string) {
      return api.listWorkflowRuns(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getWorkflowRunDetail(runId: string) {
      return api.getWorkflowRunDetail(runId).then((response) => JSON.stringify(response));
    },
    startWorkflowRunRerun(requestJson: string) {
      return api.startWorkflowRunRerun(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listSystemChildComponents(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.listChildComponents(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    addSystemChildComponent(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.addChildComponent(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    removeSystemChildComponent(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.removeChildComponent(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    reorderSystemChildComponent(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.reorderChildComponent(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateSystemInterfaces(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.updateInterfaces(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateSystemParameters(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.updateParameters(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateSystemExecutionMetadata(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.updateExecutionMetadata(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    saveSystemDefinition(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.saveSystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    loadSystemDefinition(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.loadSystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    duplicateSystemDefinition(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.duplicateSystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    modifySystemDefinition(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.modifySystemDefinition(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getSystemCompatibilityInsights(requestJson: string) {
      if (!systemApi) {
        return unsupportedSystemOperation();
      }
      return systemApi.getCompatibilityInsights(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    startSystemExecution(requestJson: string) {
      if (!runtimeApi) {
        return unsupportedSystemOperation();
      }
      return runtimeApi.startExecution(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getSystemExecutionStatus(executionId: string) {
      if (!runtimeApi) {
        return unsupportedSystemOperation();
      }
      return runtimeApi.getExecutionStatus(executionId).then((response) => JSON.stringify(response));
    },
    getSystemExecutionTrace(requestJson: string) {
      if (!runtimeApi) {
        return unsupportedSystemOperation();
      }
      return runtimeApi.getExecutionTrace(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getSystemExecutionResult(executionId: string) {
      if (!runtimeApi) {
        return unsupportedSystemOperation();
      }
      return runtimeApi.getExecutionResult(executionId).then((response) => JSON.stringify(response));
    },
    ingestReferenceImageUpload(requestJson: string) {
      return api.ingestReferenceImageUpload(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    persistReferenceImageOutputs(requestJson: string) {
      return api.persistReferenceImageOutputs(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listReferenceImageOutputs(requestJson: string) {
      return api.listReferenceImageOutputs(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getReferenceImageOutput(requestJson: string) {
      return api.getReferenceImageOutput(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listReferenceImageDatasetItems(requestJson: string) {
      return api.listReferenceImageDatasetItems(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    getReferenceImageDatasetItem(requestJson: string) {
      return api.getReferenceImageDatasetItem(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listReferenceImageRunHistory(requestJson: string) {
      return api.listReferenceImageRunHistory(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    chainReferenceImageDatasetItemToInput(requestJson: string) {
      return api.chainReferenceImageDatasetItemToInput(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    launchRuntimeWindow(_requestJson: string) {
      return Promise.resolve(JSON.stringify({
        ok: false,
        error: {
          code: "unsupported",
          message: "runtime-window-launch-not-configured",
        },
      }));
    },
  };

  (globalThis as { window?: Window }).window = {
    aiLoomDesktop: {
      studioShell: bridge,
    },
  } as Window;

}

interface StudioLifecycleScenario {
  readonly studioId: string;
  readonly studioName: string;
  readonly semanticRole: "workflow" | "context-bundle" | "dataset-pipeline" | "training-recipe" | "tool-chain";
  readonly behaviorKind: "none" | "deterministic" | "conditional" | "iterative";
  readonly content: string;
  readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId: string }>;
}

async function runLifecycleScenario(
  service: StudioShellService,
  contractResolver: CompositionAssetContractResolver,
  scenario: StudioLifecycleScenario,
  options: {
    readonly expectResolvableDependencies?: boolean;
  } = {},
): Promise<{
  readonly draftId: string;
  readonly versionId: string;
}> {
  const initialized = await service.initializeStudio(scenario.studioId, scenario.studioName);
  expect(initialized.ok).toBeTrue();
  const sessionId = initialized.data?.activeSessionId;
  expect(sessionId).toBeDefined();

  const created = await service.createDraft({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    content: scenario.content,
    metadata: {
      title: `${scenario.semanticRole}-asset`,
      tags: [scenario.semanticRole, "studio-shell", "composite"],
      taxonomy: {
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      },
      contract: contractResolver.resolveContractForTaxonomy({
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }),
      provenance: {
        sourceType: "generated",
        sourceLabel: `${scenario.semanticRole}-studio`,
      },
    },
    dependencies: scenario.dependencies,
  });
  expect(created.ok).toBeTrue();
  expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();
  expect(created.data?.validationIssues.some((entry) => entry.code === "version-history-empty")).toBeTrue();
  expect(created.data?.validationIssues.some((entry) => entry.code === "composite-dependency-recommended")).toBeFalse();

  const draftId = created.data?.draft?.draftId;
  expect(draftId).toBeDefined();

  const updated = await service.updateDraft({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    draftId: draftId!,
    content: `${scenario.content}\n`,
    metadataPatch: {
      summary: `${scenario.studioName} cross-studio consistency`,
    },
  });
  expect(updated.ok).toBeTrue();
  expect(updated.data?.draft?.revision).toBe(2);

  const validated = await service.transitionLifecycle({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    draftId: draftId!,
    targetStatus: AssetDraftLifecycleStatuses.validated,
  });
  expect(validated.ok).toBeTrue();
  expect(validated.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.validated);

  const versionId = `asset:${scenario.studioId}:v1`;
  const published = await service.publishVersion({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    draftId: draftId!,
    versionId,
    versionLabel: "v1",
    createdBy: "composite-author",
  });
  expect(published.ok).toBeTrue();
  expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
  expect(published.data?.versions.map((entry) => entry.versionId)).toEqual([versionId]);
  expect(published.data?.draft?.metadata.taxonomy).toEqual({
    structuralKind: "composite",
    semanticRole: scenario.semanticRole,
    behaviorKind: scenario.behaviorKind,
  });
  expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
    structuralKind: "composite",
    semanticRole: scenario.semanticRole,
    behaviorKind: scenario.behaviorKind,
  }));

  const issues = await service.validateDraft(scenario.studioId, draftId!);
  expect(issues.ok).toBeTrue();
  if (options.expectResolvableDependencies !== false) {
    expect(issues.data?.some((entry) => entry.code === "dependency-version-not-found")).toBeFalse();
    expect(issues.data?.some((entry) => entry.code === "composite-dependency-semantic-role-disallowed")).toBeFalse();
  }
  expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();

  return Object.freeze({
    draftId: draftId!,
    versionId,
  });
}

describe("StudioShellService integration", () => {
  it("lists and reads authoritative image workflow definitions through service -> bridge -> backend", async () => {
    const backendApi = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    installBridge(backendApi);

    const service = new StudioShellService();
    const listed = await service.listImageWorkflowDefinitions({
      workspaceId: "workspace-alpha",
      actorUserId: "user-author",
    });
    expect(listed.ok).toBeTrue();
    expect((listed.data?.items.length ?? 0) > 0).toBeTrue();

    const workflowId = listed.data?.items[0]?.workflowId;
    expect(workflowId).toBeDefined();
    const detail = await service.getImageWorkflowDefinition({
      workspaceId: "workspace-alpha",
      actorUserId: "user-author",
      workflowId: workflowId!,
    });
    expect(detail.ok).toBeTrue();
    expect(detail.data?.workflowId).toBe(workflowId);
    expect(detail.data?.version.versionTag).toBeDefined();
  });

  it("lists workflow run summaries and loads run detail through the studio-shell bridge", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const summary = createWorkflowRunSummaryRecord({
      runId: "run:workflow-service-1",
      status: WorkflowRunStatuses.completed,
      triggerSource: WorkflowRunTriggerSources.manual,
      workflow: {
        workflowId: "asset:workflow-service",
        workflowName: "Service Workflow",
      },
      correlation: {
        executionRunId: "run:workflow-service-1",
      },
      timestamps: {
        startedAt: "2026-03-31T13:00:00.000Z",
        endedAt: "2026-03-31T13:00:03.000Z",
        updatedAt: "2026-03-31T13:00:03.000Z",
      },
    });
    await workflowRunRepository.upsertDetail(createWorkflowRunDetailRecord({
      runId: summary.runId,
      summary,
      executionContext: {
        resolvedTriggerContext: {
          triggerSource: "manual",
        },
      },
      outputs: {
        outputAssetIds: ["asset:service-output"],
        outputCount: 1,
        outputValues: {
          status: "completed",
        },
      },
    }));

    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-runs-service-"));
    createdRoots.push(root);
    const backendApi = new StudioShellBackendApi(
      new SqliteStudioShellRepository(path.join(root, "studio-shell.sqlite")),
      undefined,
      workflowRunRepository,
    );
    installBridge(backendApi);

    const service = new StudioShellService();
    const listed = await service.listWorkflowRuns({
      workflowId: "asset:workflow-service",
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.[0]?.runId).toBe("run:workflow-service-1");

    const detail = await service.getWorkflowRunDetail("run:workflow-service-1");
    expect(detail.ok).toBeTrue();
    expect(detail.data?.outputs?.outputCount).toBe(1);
    expect(detail.data?.executionContext?.resolvedTriggerContext).toEqual({
      triggerSource: "manual",
    });
  });

  it("starts workflow rerun from historical context through service -> bridge -> backend and records lineage", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const studioRepository = new InMemoryStudioShellRepository();
    const backendApi = new StudioShellBackendApi(
      studioRepository,
      workflowPersistenceRepository,
      workflowRunRepository,
    );
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-rerun-history", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await service.createDraft({
      studioId: "studio-rerun-history",
      sessionId,
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
      metadata: {
        title: "service-rerun-workflow",
        tags: ["workflow", "rerun"],
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
    });
    const workflowId = created.data!.draft!.assetId;

    await workflowRunRepository.upsertDetail(createWorkflowRunDetailRecord({
      runId: "run:service-rerun-source",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:service-rerun-source",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: {
          workflowId,
          workflowName: "service-rerun-workflow",
        },
        correlation: {
          executionRunId: "run:service-rerun-source",
        },
        timestamps: {
          startedAt: "2026-03-31T15:00:00.000Z",
          endedAt: "2026-03-31T15:00:02.000Z",
          updatedAt: "2026-03-31T15:00:02.000Z",
        },
      }),
      executionContext: {
        executionInput: {
          parameters: {
            inputValues: {
              prompt: "historical",
            },
          },
          executionMetadata: {
            actorId: "user:integration",
          },
        },
        resolvedTriggerContext: {
          triggerSource: "manual",
        },
      },
    }));

    const launched = await service.startWorkflowRunRerun({
      sourceRunId: "run:service-rerun-source",
      mode: "as-is",
    });

    expect(launched.ok).toBeTrue();
    expect(launched.data?.mode).toBe("as-is");
    expect(launched.data?.sourceRunId).toBe("run:service-rerun-source");

    const rerunDetail = await service.getWorkflowRunDetail(launched.data!.runId);
    expect(rerunDetail.ok).toBeTrue();
    expect(rerunDetail.data?.summary.parentRunId).toBe("run:service-rerun-source");
    expect(rerunDetail.data?.summary.rerunMode).toBe("as-is");
    expect(rerunDetail.data?.executionContext?.executionInput).toEqual(expect.objectContaining({
      parameters: expect.objectContaining({
        parentRunId: "run:service-rerun-source",
        rerunMode: "as-is",
      }),
    }));
  });

  it("supports edited rerun overrides through service flow with traceable edited lineage", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const studioRepository = new InMemoryStudioShellRepository();
    const backendApi = new StudioShellBackendApi(
      studioRepository,
      workflowPersistenceRepository,
      workflowRunRepository,
    );
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-rerun-edit", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await service.createDraft({
      studioId: "studio-rerun-edit",
      sessionId,
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
      metadata: {
        title: "service-edit-rerun-workflow",
        tags: ["workflow", "rerun"],
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
    });
    const workflowId = created.data!.draft!.assetId;

    await workflowRunRepository.upsertDetail(createWorkflowRunDetailRecord({
      runId: "run:service-edit-source",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:service-edit-source",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: {
          workflowId,
          workflowName: "service-edit-rerun-workflow",
        },
        correlation: {
          executionRunId: "run:service-edit-source",
        },
        timestamps: {
          startedAt: "2026-03-31T16:00:00.000Z",
          endedAt: "2026-03-31T16:00:02.000Z",
          updatedAt: "2026-03-31T16:00:02.000Z",
        },
      }),
      executionContext: {
        executionInput: {
          parameters: {
            inputValues: {
              prompt: "original",
            },
          },
          propertyOverrides: {
            stepA: {
              timeoutMs: 1000,
            },
          },
        },
      },
    }));

    const launched = await service.startWorkflowRunRerun({
      sourceRunId: "run:service-edit-source",
      mode: "edited",
      rerunReason: "Changed prompt and timeout",
      overrides: {
        parameters: {
          inputValues: {
            prompt: "edited",
          },
        },
        propertyOverrides: {
          stepA: {
            timeoutMs: 2000,
          },
        },
      },
    });

    expect(launched.ok).toBeTrue();
    expect(launched.data?.mode).toBe("edited");

    const rerunDetail = await service.getWorkflowRunDetail(launched.data!.runId);
    expect(rerunDetail.ok).toBeTrue();
    expect(rerunDetail.data?.summary.parentRunId).toBe("run:service-edit-source");
    expect(rerunDetail.data?.summary.rerunMode).toBe("edited");
    expect(rerunDetail.data?.summary.rerunReason).toBe("Changed prompt and timeout");
    expect(rerunDetail.data?.executionContext?.executionInput).toEqual(expect.objectContaining({
      parameters: expect.objectContaining({
        inputValues: {
          prompt: "edited",
        },
      }),
      propertyOverrides: expect.objectContaining({
        stepA: {
          timeoutMs: 2000,
        },
      }),
    }));
  });

  it("uses browser fallback backend when desktop bridge is unavailable", async () => {
    const service = new StudioShellService();
    const run = await service.runWorkflowDraft({
      studioId: `studio-browser-fallback-${Date.now().toString(36)}`,
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

    expect(run.ok).toBeTrue();
    expect(run.data?.launchStatus === "launched" || run.data?.launchStatus === "blocked").toBeTrue();
  });

  it("keeps model/dataset/tool/prompt-template/embedding-index/config-profile lifecycle and persisted contract-taxonomy behavior consistent across shared seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-atomic-studio-consistency-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "atomic-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const scenarios = [
      {
        studioId: "studio-models",
        name: "Model Studio",
        semanticRole: "model" as const,
        behaviorKind: "none" as const,
        content: "{\"modelSpec\":{\"provider\":\"local\",\"modelId\":\"mistral-7b\"}}",
        dependencies: [{ assetId: "asset:model-catalog", versionId: "asset:model-catalog:v1" }],
      },
      {
        studioId: "studio-datasets",
        name: "Dataset Studio",
        semanticRole: "dataset" as const,
        behaviorKind: "none" as const,
        content: "{\"datasetSpec\":{\"format\":\"jsonl\",\"schema\":{\"instruction\":\"string\"}}}",
        dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v3" }],
      },
      {
        studioId: "studio-tools",
        name: "Tool Studio",
        semanticRole: "tool" as const,
        behaviorKind: "conditional" as const,
        content: "{\"toolSpec\":{\"providerKind\":\"mcp\",\"serverId\":\"search\",\"operationId\":\"query\"}}",
        dependencies: [{ assetId: "asset:mcp-catalog", versionId: "asset:mcp-catalog:v2" }],
      },
      {
        studioId: "studio-prompt-templates",
        name: "Prompt Template Studio",
        semanticRole: "prompt-template" as const,
        behaviorKind: "none" as const,
        content: "{\"promptTemplateSpec\":{\"format\":\"mustache\",\"template\":\"You are a helpful assistant for {{audience}}.\",\"variables\":[\"audience\"]}}",
        dependencies: [{ assetId: "asset:prompt-library", versionId: "asset:prompt-library:v1" }],
      },
      {
        studioId: "studio-embedding-indexes",
        name: "Embedding Index Studio",
        semanticRole: "embedding-index" as const,
        behaviorKind: "none" as const,
        content: "{\"embeddingIndexSpec\":{\"provider\":\"local\",\"indexAlgorithm\":\"hnsw\",\"distanceMetric\":\"cosine\"}}",
        dependencies: [{ assetId: "asset:embedding-corpus", versionId: "asset:embedding-corpus:v1" }],
      },
      {
        studioId: "studio-config-profiles",
        name: "Config Profile Studio",
        semanticRole: "config-profile" as const,
        behaviorKind: "none" as const,
        content: "{\"runtimeProfile\":{\"preferredRuntime\":\"python\",\"executionPolicy\":\"acyclic-only\",\"environment\":{\"mode\":\"local\"}}}",
        dependencies: [{ assetId: "asset:runtime-policy", versionId: "asset:runtime-policy:v2" }],
      },
    ];

    for (const scenario of scenarios) {
      const initialized = await service.initializeStudio(scenario.studioId, scenario.name);
      expect(initialized.ok).toBeTrue();
      const sessionId = initialized.data?.activeSessionId;
      expect(sessionId).toBeDefined();

      const created = await service.createDraft({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        content: scenario.content,
        metadata: {
          title: `${scenario.semanticRole}-asset`,
          tags: [scenario.semanticRole, "studio-shell"],
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind: scenario.behaviorKind,
          },
          contract: contractResolver.resolveContractForTaxonomy({
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind: scenario.behaviorKind,
          }),
          provenance: {
            sourceType: "generated",
            sourceLabel: `${scenario.semanticRole}-studio`,
          },
        },
        dependencies: scenario.dependencies,
      });
      expect(created.ok).toBeTrue();
      expect(created.data?.validationIssues).toContainEqual(expect.objectContaining({
        code: "lifecycle-not-publish-ready",
      }));
      expect(created.data?.validationIssues).toContainEqual(expect.objectContaining({
        code: "version-history-empty",
      }));

      const draftId = created.data?.draft?.draftId;
      expect(draftId).toBeDefined();

      const updated = await service.updateDraft({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        content: `${scenario.content}\n`,
        metadataPatch: {
          summary: `${scenario.name} consistency draft`,
        },
      });
      expect(updated.ok).toBeTrue();
      expect(updated.data?.draft?.revision).toBe(2);

      const dependencyUpdated = await service.updateDependencies({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        dependencies: scenario.dependencies,
      });
      expect(dependencyUpdated.ok).toBeTrue();
      expect(dependencyUpdated.data?.draft?.dependencies).toEqual(scenario.dependencies);

      const validated = await service.transitionLifecycle({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        targetStatus: AssetDraftLifecycleStatuses.validated,
      });
      expect(validated.ok).toBeTrue();
      expect(validated.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.validated);

      const published = await service.publishVersion({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        versionId: `asset:${scenario.studioId}:v1`,
        versionLabel: "v1",
        createdBy: "atomic-author",
      });
      expect(published.ok).toBeTrue();
      expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
      expect(published.data?.versions.map((entry) => entry.versionId)).toEqual([`asset:${scenario.studioId}:v1`]);
      expect(published.data?.draft?.metadata.taxonomy).toEqual({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      });
      expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }));

      const issues = await service.validateDraft(scenario.studioId, draftId!);
      expect(issues.ok).toBeTrue();
      expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
      expect(issues.data?.some((entry) => entry.code === "version-history-empty")).toBeFalse();
    }

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    for (const scenario of scenarios) {
      const snapshot = await service.loadSnapshot(scenario.studioId);
      expect(snapshot.ok).toBeTrue();
      expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
      expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      });
      expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }));
      expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual([`asset:${scenario.studioId}:v1`]);
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "version-history-empty")).toBeFalse();
    }

    reopenedRepository.dispose();
  });

  it("supports Tool Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-tool-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "tool-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-tools", "Tool Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-tools",
      sessionId: sessionId!,
      content: '{"toolSpec":{"providerKind":"mcp","serverId":"search","operationId":"web.search"}}',
      metadata: {
        title: "Tool Asset Draft",
        tags: ["tool", "studio-shell", "mcp"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "tool",
          behaviorKind: "conditional",
        },
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
          parameters: [{ id: "providerKind", required: true, defaultValue: "mcp-or-api" }],
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "tool-studio",
        },
      },
      dependencies: [],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-tools",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-tools",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-tools:v1",
      versionLabel: "v1",
      createdBy: "tool-author",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("tool");
    expect(published.data?.draft?.metadata.taxonomy?.behaviorKind).toBe("conditional");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-tools:v1"]);

    repository.dispose();
  });

  it("supports Workflow Studio composite orchestrator flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-workflows", "Workflow Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-workflows",
      sessionId: sessionId!,
      content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"Composite Workflow\"},\"executionPolicy\":\"acyclic-only\",\"nodes\":[],\"connections\":[]}}",
      metadata: {
        title: "Workflow Asset Draft",
        tags: ["workflow", "studio-shell", "composite"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "conditional",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "conditional",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "workflow-studio",
        },
      },
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v2" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();
    expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-workflows",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-workflows",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-workflows:v1",
      versionLabel: "v1",
      createdBy: "workflow-author",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    }));
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-workflows:v1"]);

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const snapshot = await service.loadSnapshot("studio-workflows");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    }));
    expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-workflows:v1"]);

    reopenedRepository.dispose();
  });

  it("supports Context Bundle Studio composite input-preparer flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-context-bundle-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "context-bundle-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-context-bundles", "Context Bundle Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-context-bundles",
      sessionId: sessionId!,
      content: "{\"contextBundleSpec\":{\"packageRefs\":[\"context-package:customer-profile\"],\"recipeRefs\":[\"context-recipe:retrieval-bounded\"],\"assemblyPolicy\":\"merge\"}}",
      metadata: {
        title: "Context Bundle Asset Draft",
        tags: ["context-bundle", "studio-shell", "composite", "input-preparer"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "context-bundle",
          behaviorKind: "deterministic",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "composite",
          semanticRole: "context-bundle",
          behaviorKind: "deterministic",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "context-bundle-studio",
        },
      },
      dependencies: [{ assetId: "asset:context-package", versionId: "asset:context-package:v2" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();
    expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-context-bundles",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-context-bundles",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-context-bundles:v1",
      versionLabel: "v1",
      createdBy: "context-author",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    });
    expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    }));
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-context-bundles:v1"]);

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const snapshot = await service.loadSnapshot("studio-context-bundles");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    });
    expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    }));
    expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-context-bundles:v1"]);

    reopenedRepository.dispose();
  });

  it("supports Training Recipe Studio composite flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-training-recipe-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "training-recipe-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-training-recipes", "Training Recipe Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-training-recipes",
      sessionId: sessionId!,
      content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v2\"],\"configProfileRef\":\"config-profile:runtime:v3\",\"executionKind\":\"local-gradient-training\",\"flow\":{\"epochs\":3,\"batchSize\":8}}}",
      metadata: {
        title: "Training Recipe Asset Draft",
        tags: ["training-recipe", "studio-shell", "composite", "model-training", "fine-tuning"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "training-recipe",
          behaviorKind: "deterministic",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "composite",
          semanticRole: "training-recipe",
          behaviorKind: "deterministic",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "training-recipe-studio",
        },
      },
      dependencies: [
        { assetId: "asset:base-model", versionId: "asset:base-model:v1" },
        { assetId: "asset:training-dataset", versionId: "asset:training-dataset:v2" },
        { assetId: "asset:runtime-config", versionId: "asset:runtime-config:v1" },
      ],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();
    expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-training-recipes",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-training-recipes",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-training-recipes:v1",
      versionLabel: "v1",
      createdBy: "training-author",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    });
    expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    }));
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-training-recipes:v1"]);

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const snapshot = await service.loadSnapshot("studio-training-recipes");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    });
    expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    }));
    expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-training-recipes:v1"]);

    reopenedRepository.dispose();
  });

  it("keeps workflow/context-bundle/dataset-pipeline/training-recipe/tool-chain composite lifecycle and persisted taxonomy-contract behavior consistent across shared seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-composite-studio-consistency-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "composite-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();

    const scenarios: ReadonlyArray<StudioLifecycleScenario> = [
      {
        studioId: "studio-workflows",
        studioName: "Workflow Studio",
        semanticRole: "workflow",
        behaviorKind: "conditional",
        content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"Cross Studio Workflow\"},\"nodes\":[],\"connections\":[]}}",
        dependencies: [{ assetId: "asset:seed-model", versionId: "asset:seed-model:v1" }],
      },
      {
        studioId: "studio-context-bundles",
        studioName: "Context Bundle Studio",
        semanticRole: "context-bundle",
        behaviorKind: "deterministic",
        content: "{\"contextBundleSpec\":{\"packageRefs\":[\"context-package:customer\"],\"recipeRefs\":[\"context-recipe:bounded\"],\"assemblyPolicy\":\"merge\"}}",
        dependencies: [{ assetId: "asset:seed-context", versionId: "asset:seed-context:v1" }],
      },
      {
        studioId: "studio-dataset-pipelines",
        studioName: "Dataset Pipeline Studio",
        semanticRole: "dataset-pipeline",
        behaviorKind: "deterministic",
        content: "{\"datasetPipelineSpec\":{\"sources\":[{\"datasetRef\":\"dataset-version:raw:v1\"}],\"steps\":[{\"id\":\"clean\",\"kind\":\"data-cleaning\"}]}}",
        dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v1" }],
      },
      {
        studioId: "studio-training-recipes",
        studioName: "Training Recipe Studio",
        semanticRole: "training-recipe",
        behaviorKind: "deterministic",
        content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v1\"],\"configProfileRef\":\"config-profile:runtime:v1\"}}",
        dependencies: [{ assetId: "asset:seed-training", versionId: "asset:seed-training:v1" }],
      },
      {
        studioId: "studio-tool-chains",
        studioName: "Tool Chain Studio",
        semanticRole: "tool-chain",
        behaviorKind: "deterministic",
        content: "{\"toolChainSpec\":{\"tools\":[{\"toolAssetRef\":\"tool:lookup:v1\"}],\"invocationSteps\":[{\"id\":\"lookup\",\"kind\":\"tool-invocation\"}]}}",
        dependencies: [{ assetId: "asset:seed-tool", versionId: "asset:seed-tool:v1" }],
      },
    ];

    for (const scenario of scenarios) {
      await runLifecycleScenario(service, contractResolver, scenario, {
        expectResolvableDependencies: false,
      });
    }

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    for (const scenario of scenarios) {
      const snapshot = await service.loadSnapshot(scenario.studioId);
      expect(snapshot.ok).toBeTrue();
      expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
      expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      });
      expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }));
      expect(snapshot.data?.draft?.dependencies).toEqual(scenario.dependencies);
      expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual([`asset:${scenario.studioId}:v1`]);
    }

    reopenedRepository.dispose();
  });

  it("supports composite-to-atomic dependency reuse with pinned version interop over real shell/api/sqlite seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-composite-atomic-interop-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "composite-atomic-interop.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();

    const atomicScenarios = [
      { studioId: "studio-models", studioName: "Model Studio", semanticRole: "model" as const, content: "{\"modelSpec\":{\"provider\":\"local\"}}" },
      { studioId: "studio-datasets", studioName: "Dataset Studio", semanticRole: "dataset" as const, content: "{\"datasetSpec\":{\"format\":\"jsonl\"}}" },
      { studioId: "studio-tools", studioName: "Tool Studio", semanticRole: "tool" as const, content: "{\"toolSpec\":{\"providerKind\":\"mcp\"}}", behaviorKind: "conditional" as const },
      { studioId: "studio-prompt-templates", studioName: "Prompt Template Studio", semanticRole: "prompt-template" as const, content: "{\"promptTemplateSpec\":{\"format\":\"mustache\"}}" },
      { studioId: "studio-embedding-indexes", studioName: "Embedding Index Studio", semanticRole: "embedding-index" as const, content: "{\"embeddingIndexSpec\":{\"indexAlgorithm\":\"hnsw\"}}" },
      { studioId: "studio-config-profiles", studioName: "Config Profile Studio", semanticRole: "config-profile" as const, content: "{\"runtimeProfile\":{\"preferredRuntime\":\"python\"}}" },
    ];

    const publishedAtomicVersions = new Map<string, { assetId: string; versionId: string }>();

    for (const scenario of atomicScenarios) {
      const initialized = await service.initializeStudio(scenario.studioId, scenario.studioName);
      expect(initialized.ok).toBeTrue();
      const sessionId = initialized.data?.activeSessionId;
      expect(sessionId).toBeDefined();

      const behaviorKind = scenario.behaviorKind ?? "none";
      const created = await service.createDraft({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        content: scenario.content,
        metadata: {
          title: `${scenario.semanticRole}-atomic`,
          tags: [scenario.semanticRole, "studio-shell", "atomic"],
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind,
          },
          contract: contractResolver.resolveContractForTaxonomy({
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind,
          }),
          provenance: {
            sourceType: "generated",
            sourceLabel: `${scenario.semanticRole}-studio`,
          },
        },
        dependencies: [{ assetId: `asset:${scenario.semanticRole}:seed`, versionId: `asset:${scenario.semanticRole}:seed:v1` }],
      });
      expect(created.ok).toBeTrue();
      const draftId = created.data?.draft?.draftId;
      expect(draftId).toBeDefined();
      const atomicAssetId = created.data?.draft?.assetId;
      expect(atomicAssetId).toBeDefined();

      const validated = await service.transitionLifecycle({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        targetStatus: AssetDraftLifecycleStatuses.validated,
      });
      expect(validated.ok).toBeTrue();

      const versionId = `asset:${scenario.studioId}:v1`;
      const published = await service.publishVersion({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        versionId,
        versionLabel: "v1",
        createdBy: "atomic-author",
      });
      expect(published.ok).toBeTrue();

      publishedAtomicVersions.set(scenario.semanticRole, {
        assetId: atomicAssetId!,
        versionId,
      });
    }

    const compositeScenarios: ReadonlyArray<StudioLifecycleScenario> = [
      {
        studioId: "studio-dataset-pipelines",
        studioName: "Dataset Pipeline Studio",
        semanticRole: "dataset-pipeline",
        behaviorKind: "deterministic",
        content: "{\"datasetPipelineSpec\":{\"sources\":[{\"datasetRef\":\"dataset-version:train:v1\"}],\"configProfileRef\":\"config-profile:runtime:v1\"}}",
        dependencies: [
          publishedAtomicVersions.get("dataset")!,
          publishedAtomicVersions.get("config-profile")!,
        ],
      },
      {
        studioId: "studio-training-recipes",
        studioName: "Training Recipe Studio",
        semanticRole: "training-recipe",
        behaviorKind: "deterministic",
        content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v1\"],\"configProfileRef\":\"config-profile:runtime:v1\"}}",
        dependencies: [
          publishedAtomicVersions.get("model")!,
          publishedAtomicVersions.get("dataset")!,
          publishedAtomicVersions.get("config-profile")!,
        ],
      },
      {
        studioId: "studio-tool-chains",
        studioName: "Tool Chain Studio",
        semanticRole: "tool-chain",
        behaviorKind: "deterministic",
        content: "{\"toolChainSpec\":{\"tools\":[{\"toolAssetRef\":\"tool:lookup:v1\"}],\"invocationSteps\":[{\"id\":\"lookup\",\"kind\":\"tool-invocation\"}]}}",
        dependencies: [publishedAtomicVersions.get("tool")!],
      },
      {
        studioId: "studio-context-bundles",
        studioName: "Context Bundle Studio",
        semanticRole: "context-bundle",
        behaviorKind: "deterministic",
        content: "{\"contextBundleSpec\":{\"packageRefs\":[],\"recipeRefs\":[\"context-recipe:retrieval:v1\"],\"assemblyPolicy\":\"merge\"}}",
        dependencies: [
          publishedAtomicVersions.get("prompt-template")!,
          publishedAtomicVersions.get("embedding-index")!,
          publishedAtomicVersions.get("dataset")!,
        ],
      },
      {
        studioId: "studio-workflows",
        studioName: "Workflow Studio",
        semanticRole: "workflow",
        behaviorKind: "conditional",
        content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"Interop Workflow\"},\"nodes\":[],\"connections\":[]}}",
        dependencies: [
          publishedAtomicVersions.get("model")!,
          publishedAtomicVersions.get("dataset")!,
          publishedAtomicVersions.get("tool")!,
          publishedAtomicVersions.get("prompt-template")!,
          publishedAtomicVersions.get("embedding-index")!,
          publishedAtomicVersions.get("config-profile")!,
        ],
      },
    ];

    for (const scenario of compositeScenarios) {
      const result = await runLifecycleScenario(service, contractResolver, scenario);
      const publishedVersion = await repository.getAssetVersion(result.versionId);
      expect(publishedVersion).toBeDefined();
      expect(publishedVersion?.upstreamVersionIds).toEqual(expect.arrayContaining(
        scenario.dependencies.map((entry) => entry.versionId),
      ));
    }

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    for (const scenario of compositeScenarios) {
      const snapshot = await service.loadSnapshot(scenario.studioId);
      expect(snapshot.ok).toBeTrue();
      expect(snapshot.data?.draft?.dependencies).toEqual(scenario.dependencies);
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "dependency-version-not-found")).toBeFalse();
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "dependency-asset-version-mismatch")).toBeFalse();
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "composite-dependency-semantic-role-disallowed")).toBeFalse();
    }

    reopenedRepository.dispose();
  });

  it("supports Dataset Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "dataset-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-datasets", "Dataset Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      content: '{"datasetSpec":{"format":"jsonl"}}',
      metadata: {
        title: "Dataset Asset Draft",
        tags: ["dataset", "studio-shell"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "dataset",
          behaviorKind: "none",
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "dataset-studio",
        },
      },
      dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v1" }],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-datasets:v1",
      versionLabel: "v1",
      createdBy: "dataset-curator",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("dataset");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-datasets:v1"]);

    repository.dispose();
  });

  it("supports Prompt Template Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-prompt-template-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "prompt-template-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-prompt-templates", "Prompt Template Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-prompt-templates",
      sessionId: sessionId!,
      content: '{"promptTemplateSpec":{"format":"mustache","template":"Write a summary for {{topic}}.","variables":["topic"]}}',
      metadata: {
        title: "Prompt Template Asset Draft",
        tags: ["prompt-template", "studio-shell"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "prompt-template",
          behaviorKind: "none",
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "prompt-template-studio",
        },
      },
      dependencies: [{ assetId: "asset:prompt-library", versionId: "asset:prompt-library:v1" }],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-prompt-templates",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-prompt-templates",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-prompt-templates:v1",
      versionLabel: "v1",
      createdBy: "prompt-author",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("prompt-template");
    expect(published.data?.draft?.metadata.taxonomy?.behaviorKind).toBe("none");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-prompt-templates:v1"]);

    repository.dispose();
  });

  it("supports System Studio style flow over the same shared shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "system-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-systems", "System Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-systems",
      sessionId: sessionId!,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[]}}",
      metadata: {
        title: "System Asset Draft",
        tags: ["system", "studio-shell", "system-composition"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "system-studio",
        },
      },
      dependencies: [{ assetId: "asset:system-child", versionId: "asset:system-child:v1" }],
    });
    expect(created.ok).toBeTrue();
    expect(created.data?.validationIssues.some((entry) => entry.code === "composite-dependency-recommended")).toBeFalse();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-systems",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-systems",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-systems:v1",
      versionLabel: "v1",
      createdBy: "system-author",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.structuralKind).toBe("system");
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("system");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-systems:v1"]);

    repository.dispose();
  });

  it("keeps System Studio end-to-end consistency across system child operations, contract projection, publish, and reload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-studio-consistency-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "system-studio-consistency.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    const systemBackendApi = new SystemStudioBackendApi(repository);
    installBridge(backendApi, systemBackendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();

    const modelStudio = await service.initializeStudio("studio-models", "Model Studio");
    expect(modelStudio.ok).toBeTrue();
    const modelCreated = await service.createDraft({
      studioId: "studio-models",
      sessionId: modelStudio.data!.activeSessionId,
      content: "{\"modelSpec\":{\"provider\":\"local\",\"modelId\":\"consistency-model\"}}",
      metadata: {
        title: "Consistency Model",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        contract: contractResolver.resolveContractForTaxonomy({ structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" }),
      },
      dependencies: [{ assetId: "asset:model-seed", versionId: "asset:model-seed:v1" }],
    });
    expect(modelCreated.ok).toBeTrue();
    await service.transitionLifecycle({
      studioId: "studio-models",
      sessionId: modelStudio.data!.activeSessionId,
      draftId: modelCreated.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await service.publishVersion({
      studioId: "studio-models",
      sessionId: modelStudio.data!.activeSessionId,
      draftId: modelCreated.data!.draft!.draftId,
      versionId: "asset:studio-models:consistency:v1",
      versionLabel: "v1",
      createdBy: "system-consistency",
    });

    const childStudio = await service.initializeStudio("studio-systems-child", "System Studio Child");
    expect(childStudio.ok).toBeTrue();
    const childDraft = await service.createDraft({
      studioId: "studio-systems-child",
      sessionId: childStudio.data!.activeSessionId,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[],\"inputs\":[],\"outputs\":[],\"parameters\":[],\"bindings\":[]}}",
      metadata: {
        title: "Nested Child System",
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        contract: contractResolver.resolveContractForTaxonomy({ structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" }),
      },
      dependencies: [],
    });
    expect(childDraft.ok).toBeTrue();
    await service.transitionLifecycle({
      studioId: "studio-systems-child",
      sessionId: childStudio.data!.activeSessionId,
      draftId: childDraft.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await service.publishVersion({
      studioId: "studio-systems-child",
      sessionId: childStudio.data!.activeSessionId,
      draftId: childDraft.data!.draft!.draftId,
      versionId: "asset:studio-systems-child:v1",
      versionLabel: "v1",
      createdBy: "system-consistency",
    });

    const systemStudio = await service.initializeStudio("studio-systems", "System Studio");
    expect(systemStudio.ok).toBeTrue();
    const systemSessionId = systemStudio.data!.activeSessionId;
    const created = await service.createDraft({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[],\"inputs\":[],\"outputs\":[],\"parameters\":[],\"bindings\":[]}}",
      metadata: {
        title: "System Consistency Root",
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        contract: contractResolver.resolveContractForTaxonomy({ structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" }),
      },
      dependencies: [],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data!.draft!.draftId;

    const addModel = await service.addSystemChildComponent({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      component: {
        componentKind: "atomic",
        assetId: modelCreated.data!.draft!.assetId,
        versionId: "asset:studio-models:consistency:v1",
        alias: "model-a",
      },
    });
    expect(addModel.ok).toBeTrue();
    const addChildSystem = await service.addSystemChildComponent({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      component: {
        componentKind: "system",
        assetId: childDraft.data!.draft!.assetId,
        versionId: "asset:studio-systems-child:v1",
        alias: "nested-a",
      },
    });
    expect(addChildSystem.ok).toBeTrue();

    const updatedInterfaces = await service.updateSystemInterfaces({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      inputs: [{ inputId: "prompt", valueType: "string", required: true }],
      outputs: [{ outputId: "answer", valueType: "string" }],
    });
    expect(updatedInterfaces.ok).toBeTrue();
    const updatedParameters = await service.updateSystemParameters({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      parameters: [{ parameterId: "temperature", valueType: "number", defaultValue: 0.2 }],
    });
    expect(updatedParameters.ok).toBeTrue();
    const updatedExecutionMetadata = await service.updateSystemExecutionMetadata({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      executionMetadata: {
        runtime: { environment: "python-3.11", requirements: ["numpy"] },
        orchestration: { mode: "queued", hints: ["retryable"] },
      },
    });
    expect(updatedExecutionMetadata.ok).toBeTrue();

    const list = await service.listSystemChildComponents({ studioId: "studio-systems", draftId });
    expect(list.ok).toBeTrue();
    expect(list.data?.map((entry) => entry.structuralKind)).toEqual(["atomic", "system"]);

    const compatibility = await service.getSystemCompatibilityInsights({ studioId: "studio-systems", draftId });
    expect(compatibility.ok).toBeTrue();
    expect(compatibility.data?.summary.status).toBe("clean");

    const validated = await service.transitionLifecycle({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();
    const published = await service.publishVersion({
      studioId: "studio-systems",
      sessionId: systemSessionId,
      draftId,
      versionId: "asset:studio-systems:consistency:v1",
      versionLabel: "v1",
      createdBy: "system-consistency",
    });
    expect(published.ok).toBeTrue();

    repository.dispose();
    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    const reopenedSystemApi = new SystemStudioBackendApi(reopenedRepository);
    installBridge(reopenedApi, reopenedSystemApi);

    const reloaded = await service.loadSnapshot("studio-systems");
    expect(reloaded.ok).toBeTrue();
    expect(reloaded.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(reloaded.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "system",
      semanticRole: "system",
      behaviorKind: "deterministic",
    });
    const reloadedSpec = JSON.parse(reloaded.data!.draft!.content) as {
      readonly systemSpec?: {
        readonly components?: ReadonlyArray<{ readonly componentKind: string }>;
        readonly inputs?: ReadonlyArray<{ readonly inputId: string }>;
        readonly outputs?: ReadonlyArray<{ readonly outputId: string }>;
        readonly parameters?: ReadonlyArray<{ readonly parameterId: string; readonly defaultValue?: unknown }>;
      };
    };
    expect(reloadedSpec.systemSpec?.components?.map((entry) => entry.componentKind)).toEqual(["atomic", "system"]);
    expect(reloadedSpec.systemSpec?.inputs?.map((entry) => entry.inputId)).toEqual(["prompt"]);
    expect(reloadedSpec.systemSpec?.outputs?.map((entry) => entry.outputId)).toEqual(["answer"]);
    expect(reloadedSpec.systemSpec?.parameters?.[0]).toEqual(expect.objectContaining({
      parameterId: "temperature",
      defaultValue: 0.2,
    }));
    expect(reloaded.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-systems:consistency:v1"]);

    reopenedRepository.dispose();
  });

  it("verifies atomic/composite/system interop with pinned dependencies and clean system compatibility insights", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-interop-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "system-interop.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    const systemBackendApi = new SystemStudioBackendApi(repository);
    installBridge(backendApi, systemBackendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();

    const atomicStudio = await service.initializeStudio("studio-models", "Model Studio");
    const atomicCreated = await service.createDraft({
      studioId: "studio-models",
      sessionId: atomicStudio.data!.activeSessionId,
      content: "{\"modelSpec\":{\"provider\":\"local\",\"modelId\":\"interop-model\"}}",
      metadata: {
        title: "Interop Model",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        contract: contractResolver.resolveContractForTaxonomy({ structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" }),
      },
      dependencies: [{ assetId: "asset:model-seed", versionId: "asset:model-seed:v1" }],
    });
    await service.transitionLifecycle({
      studioId: "studio-models",
      sessionId: atomicStudio.data!.activeSessionId,
      draftId: atomicCreated.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await service.publishVersion({
      studioId: "studio-models",
      sessionId: atomicStudio.data!.activeSessionId,
      draftId: atomicCreated.data!.draft!.draftId,
      versionId: "asset:studio-models:interop:v1",
      versionLabel: "v1",
      createdBy: "interop-author",
    });

    const composite = await runLifecycleScenario(service, contractResolver, {
      studioId: "studio-workflows",
      studioName: "Workflow Studio",
      semanticRole: "workflow",
      behaviorKind: "conditional",
      content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"interop-workflow\"},\"nodes\":[],\"connections\":[]}}",
      dependencies: [
        { assetId: atomicCreated.data!.draft!.assetId, versionId: "asset:studio-models:interop:v1" },
      ],
    });
    const compositeVersion = await repository.getAssetVersion(composite.versionId);
    expect(compositeVersion).toBeDefined();

    const childSystemStudio = await service.initializeStudio("studio-systems-interop-child", "System Interop Child");
    const childSystemCreated = await service.createDraft({
      studioId: "studio-systems-interop-child",
      sessionId: childSystemStudio.data!.activeSessionId,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[],\"inputs\":[],\"outputs\":[],\"parameters\":[],\"bindings\":[]}}",
      metadata: {
        title: "Interop Child System",
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        contract: contractResolver.resolveContractForTaxonomy({ structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" }),
      },
      dependencies: [],
    });
    await service.transitionLifecycle({
      studioId: "studio-systems-interop-child",
      sessionId: childSystemStudio.data!.activeSessionId,
      draftId: childSystemCreated.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await service.publishVersion({
      studioId: "studio-systems-interop-child",
      sessionId: childSystemStudio.data!.activeSessionId,
      draftId: childSystemCreated.data!.draft!.draftId,
      versionId: "asset:studio-systems-interop-child:v1",
      versionLabel: "v1",
      createdBy: "interop-author",
    });

    const systemStudio = await service.initializeStudio("studio-systems-interop", "System Interop");
    const systemSessionId = systemStudio.data!.activeSessionId;
    const systemCreated = await service.createDraft({
      studioId: "studio-systems-interop",
      sessionId: systemSessionId,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[],\"inputs\":[],\"outputs\":[],\"parameters\":[],\"bindings\":[]}}",
      metadata: {
        title: "Interop Root System",
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      },
      dependencies: [],
    });
    const systemDraftId = systemCreated.data!.draft!.draftId;
    const rootAssetId = systemCreated.data!.draft!.assetId;

    await service.addSystemChildComponent({
      studioId: "studio-systems-interop",
      sessionId: systemSessionId,
      draftId: systemDraftId,
      component: {
        componentKind: "atomic",
        assetId: atomicCreated.data!.draft!.assetId,
        versionId: "asset:studio-models:interop:v1",
        alias: "model",
      },
    });
    await service.addSystemChildComponent({
      studioId: "studio-systems-interop",
      sessionId: systemSessionId,
      draftId: systemDraftId,
      component: {
        componentKind: "composite",
        assetId: compositeVersion!.assetId.value,
        versionId: composite.versionId,
        alias: "workflow",
      },
    });
    await service.addSystemChildComponent({
      studioId: "studio-systems-interop",
      sessionId: systemSessionId,
      draftId: systemDraftId,
      component: {
        componentKind: "system",
        assetId: childSystemCreated.data!.draft!.assetId,
        versionId: "asset:studio-systems-interop-child:v1",
        alias: "nested",
      },
    });

    const listed = await service.listSystemChildComponents({ studioId: "studio-systems-interop", draftId: systemDraftId });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.map((entry) => entry.structuralKind)).toEqual(["atomic", "composite", "system"]);

    const insights = await service.getSystemCompatibilityInsights({ studioId: "studio-systems-interop", draftId: systemDraftId });
    expect(insights.ok).toBeTrue();
    expect(insights.data?.summary.status).toBe("clean");
    expect(insights.data?.summary.totalIssueCount).toBe(0);

    await service.transitionLifecycle({
      studioId: "studio-systems-interop",
      sessionId: systemSessionId,
      draftId: systemDraftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    const published = await service.publishVersion({
      studioId: "studio-systems-interop",
      sessionId: systemSessionId,
      draftId: systemDraftId,
      versionId: "asset:studio-systems-interop:v1",
      versionLabel: "v1",
      createdBy: "interop-author",
    });
    expect(published.ok).toBeTrue();

    const systemVersion = await repository.getAssetVersion("asset:studio-systems-interop:v1");
    expect(systemVersion).toBeDefined();
    expect(systemVersion?.assetId.value).toBe(rootAssetId);
    expect(systemVersion?.upstreamVersionIds).toEqual(expect.arrayContaining([
      "asset:studio-models:interop:v1",
      composite.versionId,
      "asset:studio-systems-interop-child:v1",
    ]));

    repository.dispose();
    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    const reopenedSystemApi = new SystemStudioBackendApi(reopenedRepository);
    installBridge(reopenedApi, reopenedSystemApi);

    const snapshot = await service.loadSnapshot("studio-systems-interop");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.dependencies).toEqual(expect.arrayContaining([
      { assetId: atomicCreated.data!.draft!.assetId, versionId: "asset:studio-models:interop:v1" },
      { assetId: compositeVersion!.assetId.value, versionId: composite.versionId },
      { assetId: childSystemCreated.data!.draft!.assetId, versionId: "asset:studio-systems-interop-child:v1" },
    ]));
    expect(snapshot.data?.validationIssues.some((entry) => entry.code === "dependency-version-not-found")).toBeFalse();
    expect(snapshot.data?.validationIssues.some((entry) => entry.code === "dependency-asset-version-mismatch")).toBeFalse();
    expect(snapshot.data?.validationIssues.some((entry) => entry.code === "system-child-reference-missing")).toBeFalse();

    reopenedRepository.dispose();
  });

  it("executes the Studio Shell vertical flow through bridge -> backend -> application -> sqlite persistence", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "studio-shell.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-shell-main", "Studio Shell");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      content: "{\"prompt\":\"first\"}",
      metadata: {
        title: "Studio Shell Draft",
        tags: ["studio-shell"],
      },
      dependencies: [{ assetId: "asset:seed" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();

    const updated = await service.updateDraft({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      content: "{\"prompt\":\"publishable\"}",
      metadataPatch: {
        title: "Studio Shell Draft v2",
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
          creatorId: "author-1",
          sourceType: "generated",
        },
      },
    });
    expect(updated.ok).toBeTrue();

    const dependencies = await service.updateDependencies({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      dependencies: [{ assetId: "asset:seed", versionId: "asset:seed:v1" }],
    });
    expect(dependencies.ok).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-shell-main:v1",
      versionLabel: "v1",
      createdBy: "author-1",
      upstreamVersionIds: ["asset:seed:v1"],
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-shell-main:v1"]);
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.draft?.lastPublishedVersionId).toBe("asset:studio-shell-main:v1");

    const issues = await service.validateDraft("studio-shell-main", draftId!);
    expect(issues.ok).toBeTrue();
    expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
    expect(issues.data?.some((entry) => entry.code === "version-history-empty")).toBeFalse();

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const reloadedSnapshot = await service.loadSnapshot("studio-shell-main");
    expect(reloadedSnapshot.ok).toBeTrue();
    expect(reloadedSnapshot.data?.draft?.draftId).toBe(draftId);
    expect(reloadedSnapshot.data?.draft?.content).toBe("{\"prompt\":\"publishable\"}");
    expect(reloadedSnapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-shell-main:v1"]);

    reopenedRepository.dispose();
  });

  it("blocks workflow manual execution when pre-execution validation fails", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-run-validation-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-run.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const result = await service.runWorkflowDraft({
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

    expect(result.ok).toBeTrue();
    expect(result.data?.launchStatus).toBe("blocked");
    expect(result.data?.validation.ready).toBeFalse();
    expect((result.data?.validation.blockingIssueCount ?? 0) > 0).toBeTrue();
    expect(result.data?.validation.issues.some((issue) => issue.code === "trigger-malformed")).toBeTrue();

    repository.dispose();
  });

  it("assesses workflow execution readiness through service -> bridge -> backend without launching runtime", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-readiness-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-readiness.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const blocked = await service.assessWorkflowExecutionReadiness({
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

    const ready = await service.assessWorkflowExecutionReadiness({
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

    repository.dispose();
  });

  it("launches workflow manual execution when canonical validation and translation succeed", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-run-success-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-run-success.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const backendApi = new StudioShellBackendApi(repository, undefined, workflowRunRepository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const result = await service.runWorkflowDraft({
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
              title: "Preview",
            },
          },
        }],
      }),
      inputValues: {
        prompt: "hello",
      },
    });

    expect(result.ok).toBeTrue();
    expect(result.data?.launchStatus).toBe("launched");
    expect(result.data?.validation.ready).toBeTrue();
    expect(result.data?.planSummary?.stepCount).toBe(1);
    expect(result.data?.runtime?.status === "completed" || result.data?.runtime?.status === "paused").toBeTrue();
    expect(result.data?.runtime?.outputDelivery?.results[0]).toEqual(expect.objectContaining({
      outputId: "output-1",
      destinationType: WorkflowDraftOutputDestinationTypes.webViewer,
      target: "preview",
      status: "delivered",
    }));
    expect(result.data?.run?.runId).toBeDefined();

    const runDetail = await service.getWorkflowRunDetail(result.data!.run!.runId);
    expect(runDetail.ok).toBeTrue();
    expect(runDetail.data?.summary.workflowId).toContain("workflow:");

    repository.dispose();
  });

  it("keeps execution readiness and launch feedback aligned for wizard-authored and canvas-authored drafts", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-mode-authored-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-mode-authored.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const wizardAuthoredDraft = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-manual",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userManual,
        config: {},
      }],
      steps: [{
        id: "step-wizard",
        type: "action",
        kind: "action",
        order: 1,
      }],
      outputs: [{
        id: "output-wizard",
        type: "workflow-output",
        order: 1,
        outputType: WorkflowDraftOutputTypes.document,
        format: WorkflowDraftOutputFormats.json,
        sourceStepId: "step-wizard",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.webViewer,
          target: "wizard-preview",
          options: {
            title: "Wizard preview",
          },
        },
      }],
    });
    const canvasAuthoredDraft = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-state",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: {
          sourceType: "system",
          eventCategory: "system-state-changed",
          eventName: "record-updated",
        },
      }],
      inputs: [{
        id: "input-record-id",
        type: "runtime-input",
        sourceType: "runtime-parameter",
        parameterKey: "recordId",
        required: true,
      }],
      steps: [{
        id: "step-canvas",
        type: "action",
        kind: "action",
        order: 1,
      }],
      outputs: [{
        id: "output-canvas",
        type: "workflow-output",
        order: 1,
        outputType: WorkflowDraftOutputTypes.document,
        format: WorkflowDraftOutputFormats.json,
        sourceStepId: "step-canvas",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.webViewer,
          target: "canvas-preview",
          options: {
            title: "Canvas preview",
          },
        },
      }],
    });

    const wizardReadiness = await service.assessWorkflowExecutionReadiness({
      studioId: "studio-workflows",
      content: wizardAuthoredDraft,
    });
    expect(wizardReadiness.ok).toBeTrue();
    expect(wizardReadiness.data?.ready).toBeTrue();

    const wizardRun = await service.runWorkflowDraft({
      studioId: "studio-workflows",
      content: wizardAuthoredDraft,
    });
    expect(wizardRun.ok).toBeTrue();
    expect(wizardRun.data?.launchStatus).toBe("launched");

    const canvasReadiness = await service.assessWorkflowExecutionReadiness({
      studioId: "studio-workflows",
      content: canvasAuthoredDraft,
      triggerActivation: {
        triggerId: "trigger-state",
        sourceKind: "state-data",
        payload: {
          recordId: "record-17",
        },
      },
    });
    expect(canvasReadiness.ok).toBeTrue();
    expect(canvasReadiness.data?.ready).toBeTrue();

    const canvasRun = await service.runWorkflowDraft({
      studioId: "studio-workflows",
      content: canvasAuthoredDraft,
      triggerEntry: {
        sourceKind: "state-data",
        triggerId: "trigger-state",
        payload: {
          recordId: "record-17",
        },
      },
    });
    expect(canvasRun.ok).toBeTrue();
    expect(canvasRun.data?.launchStatus).toBe("launched");
    expect(canvasRun.data?.validation.ready).toBeTrue();

    repository.dispose();
  });

  it("starts a system execution from System Studio through service -> bridge -> runtime backend and reads status/trace/result", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-runtime-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "system-runtime.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    const systemApi = new SystemStudioBackendApi(repository);
    const runtimeApi = new SystemRuntimeBackendApi(repository);
    installBridge(backendApi, systemApi, runtimeApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-systems", "System Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-systems",
      sessionId: sessionId!,
      content: JSON.stringify({
        systemSpec: {
          components: [],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      metadata: {
        title: "Runnable System",
        tags: ["system", "runtime"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();

    const validated = await service.transitionLifecycle({
      studioId: "studio-systems",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const started = await service.startSystemExecution({
      studioId: "studio-systems",
      draftId: draftId!,
      context: { trigger: "manual", actorId: "integration-test" },
    });
    expect(started.ok).toBeTrue();
    expect(started.data?.executionId).toBeDefined();
    expect(started.data?.status === "succeeded" || started.data?.status === "failed").toBeTrue();

    const status = await service.getSystemExecutionStatus(started.data!.executionId);
    expect(status.ok).toBeTrue();
    expect(status.data?.executionId).toBe(started.data?.executionId);
    expect(status.data?.progress.totalNodeCount).toBeGreaterThan(0);
    expect((status.data?.nodeStatuses.length ?? 0) > 0).toBeTrue();
    expect(status.data?.recovery.decisionCount).toBeGreaterThanOrEqual(0);

    const trace = await service.getSystemExecutionTrace({
      executionId: started.data!.executionId,
      eventLimit: 3,
      logLimit: 2,
    });
    expect(trace.ok).toBeTrue();
    expect((trace.data?.trace.events.length ?? 0) <= 3).toBeTrue();
    expect((trace.data?.trace.logs.length ?? 0) <= 2).toBeTrue();

    const result = await service.getSystemExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
    expect(result.data?.executionId).toBe(started.data?.executionId);
    expect(result.data?.output).toBeDefined();
    expect(result.data?.outputSummary.hasOutput).toBeTrue();
    expect((result.data?.nodeResults.length ?? 0) > 0).toBeTrue();
    expect(result.data?.diagnostics.length).toBeGreaterThanOrEqual(0);

    repository.dispose();
  });

  it("runs nested mixed interop systems from Studio Shell runtime path and reloads persisted runtime records", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-runtime-interop-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "studio-shell.sqlite");
    const runtimeDbPath = path.join(root, "system-runtime.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    const systemApi = new SystemStudioBackendApi(repository);
    const runtimeStore = new SqliteSystemRuntimeExecutionStore(runtimeDbPath);
    const runtimeApi = new SystemRuntimeBackendApi(repository, runtimeStore);
    installBridge(backendApi, systemApi, runtimeApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-systems-interop-runtime", "System Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const childCreated = await service.createDraft({
      studioId: "studio-systems-interop-runtime",
      sessionId: sessionId!,
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "atomic",
              alias: "child-model",
              assetId: "asset:model:child",
              versionId: "asset:model:child:v1",
              taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
            },
          ],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      metadata: {
        title: "Child Runtime System",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
      dependencies: [{ assetId: "asset:model:child", versionId: "asset:model:child:v1" }],
    });
    expect(childCreated.ok).toBeTrue();

    const childValidated = await service.transitionLifecycle({
      studioId: "studio-systems-interop-runtime",
      sessionId: sessionId!,
      draftId: childCreated.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(childValidated.ok).toBeTrue();

    const childPublished = await service.publishVersion({
      studioId: "studio-systems-interop-runtime",
      sessionId: sessionId!,
      draftId: childCreated.data!.draft!.draftId,
      versionId: "asset:studio-systems-interop-runtime-child:v1",
      versionLabel: "v1",
      createdBy: "runtime-interop-test",
      upstreamVersionIds: ["asset:model:child:v1"],
    });
    expect(childPublished.ok).toBeTrue();

    const rootCreated = await service.createDraft({
      studioId: "studio-systems-interop-runtime",
      sessionId: sessionId!,
      content: JSON.stringify({
        systemSpec: {
          components: [
            {
              componentKind: "atomic",
              alias: "model",
              assetId: "asset:model",
              versionId: "asset:model:v2",
              taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
            },
            {
              componentKind: "composite",
              alias: "workflow",
              assetId: "asset:workflow",
              versionId: "asset:workflow:v7",
              taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
            },
            {
              componentKind: "system",
              alias: "child-system",
              assetId: childCreated.data!.draft!.assetId,
              versionId: "asset:studio-systems-interop-runtime-child:v1",
              taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
            },
          ],
          nestedSystems: [
            {
              alias: "child-system",
              assetId: childCreated.data!.draft!.assetId,
              versionId: "asset:studio-systems-interop-runtime-child:v1",
            },
          ],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
      metadata: {
        title: "Mixed Runtime Interop System",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
      dependencies: [
        { assetId: "asset:model", versionId: "asset:model:v2" },
        { assetId: "asset:workflow", versionId: "asset:workflow:v7" },
        { assetId: childCreated.data!.draft!.assetId, versionId: "asset:studio-systems-interop-runtime-child:v1" },
      ],
    });
    expect(rootCreated.ok).toBeTrue();

    const rootValidated = await service.transitionLifecycle({
      studioId: "studio-systems-interop-runtime",
      sessionId: sessionId!,
      draftId: rootCreated.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(rootValidated.ok).toBeTrue();

    const started = await service.startSystemExecution({
      studioId: "studio-systems-interop-runtime",
      draftId: rootCreated.data!.draft!.draftId,
      context: { trigger: "manual", actorId: "system-runtime-interop-test" },
    });
    expect(started.ok).toBeTrue();

    const status = await service.getSystemExecutionStatus(started.data!.executionId);
    expect(status.ok).toBeTrue();
    expect(status.data?.nodeStatuses.length).toBeGreaterThan(0);
    expect(status.data?.nestedSystems.length).toBeGreaterThan(0);
    expect(Object.values(status.data?.executedVersionMap.nodeVersionIds ?? {})).toContain("asset:studio-systems-interop-runtime-child:v1");

    const trace = await service.getSystemExecutionTrace({ executionId: started.data!.executionId });
    expect(trace.ok).toBeTrue();
    const traceKinds = new Set(trace.data?.trace.events.map((event) => event.kind) ?? []);
    expect(traceKinds.has("execution-created")).toBeTrue();
    expect(traceKinds.has("node-status-changed")).toBeTrue();
    expect(traceKinds.has("nested-system-entered")).toBeTrue();
    expect(traceKinds.has("nested-system-completed") || traceKinds.has("error-recorded")).toBeTrue();

    const result = await service.getSystemExecutionResult(started.data!.executionId);
    expect(result.ok).toBeTrue();
    expect(result.data?.nestedSystemResults.length).toBeGreaterThan(0);
    expect(Object.values(result.data?.executedVersionMap.nodeVersionIds ?? {})).toContain("asset:studio-systems-interop-runtime-child:v1");

    const recent = await runtimeApi.listRecentExecutionsForSystem({
      assetId: rootCreated.data!.draft!.assetId,
      limit: 5,
    });
    expect(recent.ok).toBeTrue();
    expect(recent.data?.some((entry) => entry.executionId === started.data!.executionId)).toBeTrue();

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedRuntimeApi = new SystemRuntimeBackendApi(
      reopenedRepository,
      new SqliteSystemRuntimeExecutionStore(runtimeDbPath),
    );
    installBridge(new StudioShellBackendApi(reopenedRepository), new SystemStudioBackendApi(reopenedRepository), reopenedRuntimeApi);

    const reloadedStatus = await service.getSystemExecutionStatus(started.data!.executionId);
    expect(reloadedStatus.ok).toBeTrue();
    expect(reloadedStatus.data?.executionId).toBe(started.data?.executionId);

    const reloadedResult = await service.getSystemExecutionResult(started.data!.executionId);
    expect(reloadedResult.ok).toBeTrue();
    expect(reloadedResult.data?.outputSummary.hasOutput).toBeTrue();

    reopenedRepository.dispose();
  });
});

