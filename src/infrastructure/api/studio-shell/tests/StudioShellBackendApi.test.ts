import { describe, expect, it } from "bun:test";
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
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";
import { InMemoryWorkflowPersistenceRepository } from "../../../workflows/InMemoryWorkflowPersistenceRepository";
import { InMemoryWorkflowRunSummaryRepository } from "../../../workflows/InMemoryWorkflowRunSummaryRepository";
import { DataStudioPreparationWizard } from "@application/data-studio/DataStudioPreparationWizard";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";
import { GetPersistedWorkflowUseCase } from "@application/workflow-persistence/GetPersistedWorkflowUseCase";
import type { IWorkflowPersistenceRepository } from "@application/ports/interfaces/IWorkflowPersistenceRepository";
import type { PersistedWorkflowRecord } from "@domain/workflow-studio/WorkflowPersistenceDomain";
import {
  createWorkflowRunDetailRecord,
  createWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
} from "@domain/workflow-studio/WorkflowRunHistoryDomain";
import type { StorageInstanceProvisioningContract } from "@application/system-runtime/StorageInstanceProvisioningContract";
import { createStorageInstanceProvisioningResult } from "@application/system-runtime/StorageInstanceProvisioningContract";

describe("StudioShellBackendApi", () => {
  it("lists workflow run summaries and projects structured run detail for workflow studio observability", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const summary = createWorkflowRunSummaryRecord({
      runId: "run:workflow:1",
      status: WorkflowRunStatuses.failed,
      triggerSource: WorkflowRunTriggerSources.manual,
      workflow: {
        workflowId: "asset:workflow-1",
        workflowName: "Workflow One",
      },
      correlation: {
        executionRunId: "run:workflow:1",
        workflowExecutionId: "workflow-exec:1",
      },
      timestamps: {
        startedAt: "2026-03-31T12:00:00.000Z",
        endedAt: "2026-03-31T12:00:05.000Z",
        updatedAt: "2026-03-31T12:00:05.000Z",
      },
      errorMessage: "Run failed at step node-a",
      output: {
        outputAssetIds: ["asset:out-1"],
        outputCount: 1,
      },
    });
    await workflowRunRepository.upsertDetail(createWorkflowRunDetailRecord({
      runId: summary.runId,
      summary,
      stepRuns: [{
        stepRunId: "run:workflow:1:node-a:1",
        stepId: "node-a",
        stepIndex: 0,
        attempt: 1,
        stepName: "First step",
        status: "failed",
        timestamps: {
          startedAt: "2026-03-31T12:00:01.000Z",
          endedAt: "2026-03-31T12:00:03.000Z",
          updatedAt: "2026-03-31T12:00:03.000Z",
        },
        error: {
          code: "runtime-error",
          message: "Tool runtime failed",
          detail: "Connection reset",
        },
      }],
      executionContext: {
        resolvedTriggerContext: {
          triggerSource: "manual",
          triggerEventId: "evt-1",
        },
      },
      outputs: {
        outputAssetIds: ["asset:out-1"],
        outputCount: 1,
        outputValues: {
          status: "completed",
          answer: "ok",
        },
      },
    }));

    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      workflowRunRepository,
    );

    const listed = await api.listWorkflowRuns({
      workflowId: "asset:workflow-1",
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data).toHaveLength(1);
    expect(listed.data?.[0]).toEqual(expect.objectContaining({
      runId: "run:workflow:1",
      status: WorkflowRunStatuses.failed,
      durationMs: 5000,
    }));
    expect(listed.data?.[0]?.primaryDiagnostic?.summary).toBe("Run failed at step node-a");
    expect(listed.data?.[0]?.failureLocation?.scope).toBe("step");
    expect(listed.data?.[0]?.failureLocation?.stepId).toBe("node-a");

    const detail = await api.getWorkflowRunDetail("run:workflow:1");
    expect(detail.ok).toBeTrue();
    expect(detail.data?.summary.workflowId).toBe("asset:workflow-1");
    expect(detail.data?.executionContext?.resolvedTriggerContext).toEqual({
      triggerSource: "manual",
      triggerEventId: "evt-1",
    });
    expect(detail.data?.outputs?.outputValues).toEqual({
      status: "completed",
      answer: "ok",
    });
    expect(detail.data?.diagnostics?.some((entry) => entry.scope === "step" && entry.location?.stepId === "node-a")).toBeTrue();
  });

  it("initializes reference-image storage through provisioning contract and can attach existing shared instances", async () => {
    class CountingProvisioner implements StorageInstanceProvisioningContract {
      public calls: string[] = [];

      public async provision(request: Parameters<StorageInstanceProvisioningContract["provision"]>[0]) {
        this.calls.push(request.instanceId);
        return createStorageInstanceProvisioningResult({
          instanceId: request.instanceId,
          storageInstanceRef: `storage-instance://${encodeURIComponent(request.instanceId)}`,
          provider: "test-provisioner",
          contractVersion: request.contractVersion,
          bindings: request.requestedBindings.map((area) => ({
            bindingId: `storage-binding:${request.instanceId}:${area}`,
            area,
            reference: `storage-instance://${encodeURIComponent(request.instanceId)}/${area}`,
            provider: "test-provisioner",
            metadata: {},
          })),
          metadata: {},
        });
      }
    }

    const provisioner = new CountingProvisioner();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      { storageInstanceProvisioner: provisioner },
    );

    const root = await api.initializeReferenceImageStorage({
      systemId: "asset:system:reference-image-manipulation",
      ownerKind: "system",
      storageInstanceId: "storage-instance:shared-reference-runtime",
    });
    expect(root.ok).toBeTrue();
    expect(root.data?.storage.instanceId).toBe("storage-instance:shared-reference-runtime");
    expect(root.data?.storage.bindings.map((entry) => entry.area)).toEqual(["input", "output", "reference", "intermediate"]);
    expect(provisioner.calls).toEqual(["storage-instance:shared-reference-runtime"]);

    const embedded = await api.initializeReferenceImageStorage({
      systemId: "asset:system:reference-image-manipulation",
      ownerKind: "embedded-subsystem",
      embeddedSubsystemId: "enhance",
      attachToStorageInstanceId: "storage-instance:shared-reference-runtime",
    });
    expect(embedded.ok).toBeTrue();
    expect(embedded.data?.storage.attachments.map((entry) => entry.ownerKind)).toEqual(["system", "embedded-subsystem"]);
    expect(embedded.data?.storage.attachments.map((entry) => entry.ownerId)).toEqual([
      "asset:system:reference-image-manipulation",
      "asset:system:reference-image-manipulation::subsystem:enhance",
    ]);
    expect(provisioner.calls).toEqual(["storage-instance:shared-reference-runtime"]);

    const siblingSystem = await api.initializeReferenceImageStorage({
      systemId: "system:studio:sibling-system",
      ownerKind: "system",
      attachToStorageInstanceId: "storage-instance:shared-reference-runtime",
    });
    expect(siblingSystem.ok).toBeTrue();
    expect(siblingSystem.data?.storage.attachments.map((entry) => entry.ownerId)).toEqual([
      "asset:system:reference-image-manipulation",
      "asset:system:reference-image-manipulation::subsystem:enhance",
      "system:studio:sibling-system",
    ]);
    expect(provisioner.calls).toEqual(["storage-instance:shared-reference-runtime"]);
  });

  it("rejects reference-image storage initialization when callers try to provide storage directories", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const direct = await (api as unknown as {
      initializeReferenceImageStorage: (request: unknown) => Promise<{ ok: boolean; error?: { message: string } }>;
    }).initializeReferenceImageStorage({
      systemId: "asset:system:reference-image-manipulation",
      ownerKind: "system",
      storageDirectory: "/tmp/nope",
    });
    expect(direct.ok).toBeFalse();
    expect(direct.error?.message).toContain("Storage path configuration is infrastructure-owned");
  });

  it("provisions reference-image template dataset storage bindings at draft creation time", async () => {
    class CountingProvisioner implements StorageInstanceProvisioningContract {
      public calls: string[] = [];

      public async provision(request: Parameters<StorageInstanceProvisioningContract["provision"]>[0]) {
        this.calls.push(request.instanceId);
        return createStorageInstanceProvisioningResult({
          instanceId: request.instanceId,
          storageInstanceRef: `storage-instance://${encodeURIComponent(request.instanceId)}`,
          provider: "test-provisioner",
          contractVersion: request.contractVersion,
          bindings: request.requestedBindings.map((area) => ({
            bindingId: `storage-binding:${request.instanceId}:${area}`,
            area,
            reference: `storage-instance://${encodeURIComponent(request.instanceId)}/${area}`,
            provider: "test-provisioner",
            metadata: {},
          })),
          metadata: {},
        });
      }
    }

    const provisioner = new CountingProvisioner();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      { storageInstanceProvisioner: provisioner },
    );

    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: "asset:system:reference-image-manipulation",
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    expect(created.ok).toBeTrue();
    expect(provisioner.calls).toEqual(["storage-instance:asset:system:reference-image-manipulation:image-runtime"]);

    const listed = await api.listReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
    });
    expect(listed.ok).toBeTrue();
    expect(provisioner.calls).toEqual(["storage-instance:asset:system:reference-image-manipulation:image-runtime"]);
  });

  it("provisions all image-editor dataset bindings at draft creation without extra setup", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: "asset:system:reference-image-manipulation",
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    expect(created.ok).toBeTrue();
    const runtimeSystemId = `system:studio:${created.data!.draft!.draftId}`;
    const datasetInstances = (api as unknown as {
      readonly referenceImageDatasets: {
        readonly listSystemDatasetInstances: (systemId: string) => ReadonlyArray<{
          readonly seedMetadata?: Readonly<Record<string, unknown>>;
        }>;
      };
    }).referenceImageDatasets.listSystemDatasetInstances(runtimeSystemId);

    const bindingIds = datasetInstances
      .map((instance) => instance.seedMetadata?.datasetBindingId)
      .filter((value): value is string => typeof value === "string")
      .sort();

    expect(bindingIds).toEqual([
      "input-image-dataset",
      "output-image-dataset",
      "reference-image-dataset",
    ]);
  });

  it("ignores caller-provided upload path hints and ingests through dataset storage bindings", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: "asset:system:reference-image-manipulation",
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "demo.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
      storageReference: "file://user/controlled/path.png",
    } as unknown as Parameters<StudioShellBackendApi["ingestReferenceImageUpload"]>[0]);

    expect(upload.ok).toBeTrue();
    expect(upload.data?.image.assetId).toContain("generated-output:storage-instance://");
    expect(upload.data?.image.assetId).not.toContain("file://user/controlled/path.png");
  });

  it("starts rerun from historical execution context and persists run lineage metadata", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const studioRepository = new InMemoryStudioShellRepository();
    const api = new StudioShellBackendApi(
      studioRepository,
      workflowPersistenceRepository,
      workflowRunRepository,
    );

    const initialized = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-workflows",
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
        title: "workflow-rerun-source",
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
      runId: "run:source-rerun",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:source-rerun",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: {
          workflowId,
          workflowName: "workflow-rerun-source",
        },
        correlation: {
          executionRunId: "run:source-rerun",
        },
        timestamps: {
          startedAt: "2026-03-31T12:00:00.000Z",
          endedAt: "2026-03-31T12:00:03.000Z",
          updatedAt: "2026-03-31T12:00:03.000Z",
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
            actorId: "user:test",
          },
        },
        resolvedTriggerContext: {
          triggerSource: "manual",
        },
      },
    }));

    const rerun = await api.startWorkflowRunRerun({
      sourceRunId: "run:source-rerun",
      mode: "as-is",
    });

    expect(rerun.ok).toBeTrue();
    expect(rerun.data?.mode).toBe("as-is");
    expect(rerun.data?.sourceRunId).toBe("run:source-rerun");
    expect(rerun.data?.runId).toBeDefined();

    const rerunDetail = await workflowRunRepository.getDetailByRunId(rerun.data!.runId);
    expect(rerunDetail?.summary.correlation.parentRunId).toBe("run:source-rerun");
    expect(rerunDetail?.summary.correlation.rerunMode).toBe("as-is");
    expect(rerunDetail?.executionContext?.executionInput).toEqual(expect.objectContaining({
      parameters: expect.objectContaining({
        parentRunId: "run:source-rerun",
        rerunMode: "as-is",
      }),
    }));
  });

  it("supports edited rerun overrides and preserves edited lineage reason", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const studioRepository = new InMemoryStudioShellRepository();
    const api = new StudioShellBackendApi(
      studioRepository,
      workflowPersistenceRepository,
      workflowRunRepository,
    );

    const initialized = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-workflows",
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
        title: "workflow-rerun-edit",
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
      runId: "run:source-edit-rerun",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:source-edit-rerun",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: {
          workflowId,
          workflowName: "workflow-rerun-edit",
        },
        correlation: {
          executionRunId: "run:source-edit-rerun",
        },
        timestamps: {
          startedAt: "2026-03-31T12:10:00.000Z",
          endedAt: "2026-03-31T12:10:02.000Z",
          updatedAt: "2026-03-31T12:10:02.000Z",
        },
      }),
      executionContext: {
        executionInput: {
          parameters: {
            inputValues: {
              prompt: "original",
            },
          },
        },
      },
    }));

    const rerun = await api.startWorkflowRunRerun({
      sourceRunId: "run:source-edit-rerun",
      mode: "edited",
      rerunReason: "Adjusted prompt payload",
      overrides: {
        parameters: {
          inputValues: {
            prompt: "edited",
          },
        },
      },
    });

    expect(rerun.ok).toBeTrue();
    expect(rerun.data?.mode).toBe("edited");

    const rerunDetail = await workflowRunRepository.getDetailByRunId(rerun.data!.runId);
    expect(rerunDetail?.summary.correlation.rerunMode).toBe("edited");
    expect(rerunDetail?.summary.correlation.rerunReason).toBe("Adjusted prompt payload");
    expect((rerunDetail?.executionContext?.executionInput as Record<string, unknown>)?.parameters).toEqual(expect.objectContaining({
      inputValues: {
        prompt: "edited",
      },
      parentRunId: "run:source-edit-rerun",
      rerunMode: "edited",
      rerunReason: "Adjusted prompt payload",
    }));
  });

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

  it("synchronizes workflow studio draft create/update/lifecycle changes into workflow persistence contracts", async () => {
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      workflowPersistenceRepository,
    );
    const getPersisted = new GetPersistedWorkflowUseCase(workflowPersistenceRepository);
    const initialized = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const wizardDraft = serializeWorkflowDraft({
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
    });

    const created = await api.createDraft({
      studioId: "studio-workflows",
      sessionId,
      content: wizardDraft,
      metadata: {
        title: "workflow-draft",
        tags: ["workflow", "wizard"],
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
          creatorId: "user:workflow",
          sourceType: "generated",
          sourceLabel: "workflow-studio",
        },
      },
    });
    expect(created.ok).toBeTrue();
    const workflowId = created.data!.draft!.assetId;

    const persistedAfterCreate = await getPersisted.execute(workflowId);
    expect(persistedAfterCreate?.status).toBe("draft");
    expect(persistedAfterCreate?.definition.draft.steps.map((entry) => entry.id)).toEqual(["step-wizard"]);
    expect(persistedAfterCreate?.ownershipContext?.ownerId).toBe("user:workflow");

    const canvasDraft = serializeWorkflowDraft({
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
      steps: [{
        id: "step-canvas",
        type: "action",
        kind: "action",
        order: 1,
      }],
    });
    await api.updateDraft({
      studioId: "studio-workflows",
      sessionId,
      draftId: created.data!.draft!.draftId,
      content: canvasDraft,
      metadataPatch: {
        title: "workflow-draft-renamed",
        summary: "Workflow summary updated from studio save",
        tags: ["workflow", "canvas"],
      },
    });
    await api.transitionLifecycle({
      studioId: "studio-workflows",
      sessionId,
      draftId: created.data!.draft!.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const persistedAfterUpdate = await getPersisted.execute(workflowId);
    expect(persistedAfterUpdate?.status).toBe("saved");
    expect(persistedAfterUpdate?.name).toBe("workflow-draft-renamed");
    expect(persistedAfterUpdate?.metadata.summary).toBe("Workflow summary updated from studio save");
    expect(persistedAfterUpdate?.revision.persistenceRevision).toBeGreaterThan(1);
    expect(persistedAfterUpdate?.definition.draft.steps.map((entry) => entry.id)).toEqual(["step-canvas"]);
    expect(persistedAfterUpdate?.metadata.tags).toEqual(["workflow", "canvas"]);
  });

  it("loads persisted workflow records through studio-shell backend for workflow studio entry initialization", async () => {
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      workflowPersistenceRepository,
    );
    const initialized = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const serialized = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [{
        id: "step-existing",
        type: "action",
        kind: "action",
        order: 1,
      }],
    });

    const created = await api.createDraft({
      studioId: "studio-workflows",
      sessionId,
      content: serialized,
      metadata: {
        title: "existing-workflow",
        tags: ["workflow", "draft"],
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
    expect(created.ok).toBeTrue();
    const persistedWorkflowId = created.data!.draft!.assetId;

    const loaded = await api.getPersistedWorkflow(persistedWorkflowId);
    expect(loaded.ok).toBeTrue();
    expect(loaded.data?.id).toBe(persistedWorkflowId);
    expect(loaded.data?.serializedDraft).toBe(serialized);

    const missing = await api.getPersistedWorkflow("workflow:missing");
    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("not-found");
  });

  it("returns invalid-request for malformed persisted workflow definitions on open", async () => {
    const malformedRepository: IWorkflowPersistenceRepository = {
      async create(record) {
        return record;
      },
      async update(record) {
        return record;
      },
      async getById(): Promise<PersistedWorkflowRecord | undefined> {
        return Object.freeze({
          id: "workflow:malformed",
          name: "Malformed Workflow",
          status: "draft",
          lifecycleState: "draft",
          metadata: Object.freeze({ tags: Object.freeze([]) }),
          ownershipContext: undefined,
          revision: Object.freeze({
            persistenceRevision: 1,
            workflowRevision: 1,
          }),
          timestamps: Object.freeze({
            createdAt: "2026-03-30T00:00:00.000Z",
            updatedAt: "2026-03-30T00:00:00.000Z",
          }),
          payload: Object.freeze({
            kind: "workflow-entity",
            schemaVersion: "ai-loom.workflow-entity.v1",
          }),
          definition: Object.freeze({
            id: "workflow:malformed",
            name: "Malformed Workflow",
            metadata: Object.freeze({ tags: Object.freeze([]) }),
            draft: Object.freeze({ triggers: [], inputs: [], steps: [], outputs: [] }),
            serializedDraft: "{ malformed-json",
            draftRevision: 1,
            lifecycleState: "draft",
            createdAt: "2026-03-30T00:00:00.000Z",
            updatedAt: "2026-03-30T00:00:00.000Z",
          }),
        } as unknown as PersistedWorkflowRecord);
      },
      async list() {
        return [];
      },
      async duplicate(_sourceWorkflowId, duplicateRecord) {
        return duplicateRecord;
      },
    };
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository(), malformedRepository);

    const response = await api.getPersistedWorkflow("workflow:malformed");
    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-request");
  });

  it("maps persistence adapter failures to persistence-failed api errors", async () => {
    const failingRepository: IWorkflowPersistenceRepository = {
      async create(record) {
        return record;
      },
      async update(record) {
        return record;
      },
      async getById() {
        throw new Error("disk unavailable");
      },
      async list() {
        return [];
      },
      async duplicate(_sourceWorkflowId, duplicateRecord) {
        return duplicateRecord;
      },
    };
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository(), failingRepository);

    const response = await api.getPersistedWorkflow("workflow:any");
    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("persistence-failed");
  });

  it("duplicates persisted workflow records with new identity, draft status, and lineage metadata", async () => {
    const workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      workflowPersistenceRepository,
    );
    const initialized = await api.initializeStudio("studio-workflows", "Workflow Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const serialized = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [{
        id: "step-source",
        type: "action",
        kind: "action",
        order: 1,
      }],
      outputs: [{
        id: "output-source",
        type: "workflow-output",
        outputType: WorkflowDraftOutputTypes.document,
        format: WorkflowDraftOutputFormats.json,
        sourceStepId: "step-source",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.fileExport,
          target: "/tmp/source.json",
        },
      }],
    });

    const created = await api.createDraft({
      studioId: "studio-workflows",
      sessionId,
      content: serialized,
      metadata: {
        title: "source-workflow",
        tags: ["workflow", "source"],
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
    expect(created.ok).toBeTrue();
    const sourceWorkflowId = created.data!.draft!.assetId;

    const duplicated = await api.duplicatePersistedWorkflow({
      sourceWorkflowId,
    });
    expect(duplicated.ok).toBeTrue();
    expect(duplicated.data?.id).toBe(`${sourceWorkflowId}:copy`);
    expect(duplicated.data?.status).toBe("draft");
    expect(duplicated.data?.revision.persistenceRevision).toBe(1);
    expect(duplicated.data?.revision.workflowRevision).toBe(1);
    expect(duplicated.data?.revision.duplicatedFromWorkflowId).toBe(sourceWorkflowId);
    expect(duplicated.data?.serializedDraft).toBe(serialized);

    const loadedSource = await api.getPersistedWorkflow(sourceWorkflowId);
    expect(loadedSource.ok).toBeTrue();
    expect(loadedSource.data?.id).toBe(sourceWorkflowId);
    expect(loadedSource.data?.revision.duplicatedFromWorkflowId).toBeUndefined();

    const loadedDuplicate = await api.getPersistedWorkflow(`${sourceWorkflowId}:copy`);
    expect(loadedDuplicate.ok).toBeTrue();
    expect(loadedDuplicate.data?.revision.duplicatedFromWorkflowId).toBe(sourceWorkflowId);

    const duplicateMissing = await api.duplicatePersistedWorkflow({
      sourceWorkflowId: "workflow:missing",
    });
    expect(duplicateMissing.ok).toBeFalse();
    expect(duplicateMissing.error?.code).toBe("not-found");
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

  it("assesses Data Studio execution readiness from canonical pipeline state", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    await api.initializeStudio("studio-dataset", "Dataset Studio");
    const wizard = new DataStudioPreparationWizard();
    const state = wizard.exportPipelineState();

    const blocked = await api.assessDataStudioExecutionReadiness({
      studioId: "studio-dataset",
      pipelineState: state,
    });
    expect(blocked.ok).toBeTrue();
    expect(blocked.data?.executionReady).toBeFalse();
    expect((blocked.data?.blockingIssueCount ?? 0) > 0).toBeTrue();

    const sourceStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      ...(sourceStage?.options ?? {}),
      sourceAssetId: "asset:source-customers:v1",
    }));
    const ingestionStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.UnifiedIngestion);
    wizard.setStageOptions(PipelineStageIds.UnifiedIngestion, Object.freeze({
      ...(ingestionStage?.options ?? {}),
      outputTarget: "records",
    }));
    const preparedStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
    wizard.setStageOptions(PipelineStageIds.StoragePrepared, Object.freeze({
      ...(preparedStage?.options ?? {}),
      destination: "prepared://warehouse/customers",
    }));

    const ready = await api.assessDataStudioExecutionReadiness({
      studioId: "studio-dataset",
      pipelineState: wizard.exportPipelineState(),
    });
    expect(ready.ok).toBeTrue();
    expect(ready.data?.executionReady).toBeTrue();
    expect(ready.data?.blockingIssueCount).toBe(0);
  });

  it("runs Data Studio pipelines through the unified execution engine path", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    await api.initializeStudio("studio-dataset", "Dataset Studio");
    const wizard = new DataStudioPreparationWizard();
    const sourceStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      ...(sourceStage?.options ?? {}),
      sourceAssetId: "asset:source-customers:v1",
    }));
    const ingestionStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.UnifiedIngestion);
    wizard.setStageOptions(PipelineStageIds.UnifiedIngestion, Object.freeze({
      ...(ingestionStage?.options ?? {}),
      outputTarget: "records",
    }));
    const preparedStage = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
    wizard.setStageOptions(PipelineStageIds.StoragePrepared, Object.freeze({
      ...(preparedStage?.options ?? {}),
      destination: "prepared://warehouse/customers",
    }));

    const result = await api.runDataStudioPipeline({
      studioId: "studio-dataset",
      pipelineState: wizard.exportPipelineState(),
      initiatedBy: "test",
      executionReason: "integration-test",
    });

    expect(result.ok).toBeTrue();
    expect(result.data?.launchStatus).toBe("launched");
    expect(result.data?.execution.launchAccepted).toBeTrue();
    expect(result.data?.result?.status).toBe("completed");
    expect(result.data?.result?.preparedOutput?.storageReference).toContain("prepared://");
  });

  it("persists and retrieves Data Studio pipelines from draft, latest-version, and explicit prior-version snapshots", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-dataset", "Dataset Studio");
    const sessionId = initialized.data!.activeSessionId!;

    const wizard = new DataStudioPreparationWizard();
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceAssetId: "asset:source-customers:v1",
      sourceReference: "prepared://warehouse/customers",
      sourceKind: "records",
    }));
    const draftState = wizard.exportPipelineStateJson();

    const created = await api.createDraft({
      studioId: "studio-dataset",
      sessionId,
      content: draftState,
      metadata: {
        title: "dataset-pipeline",
        tags: ["dataset", "pipeline"],
      },
    });
    const draftId = created.data!.draft!.draftId;

    await api.transitionLifecycle({
      studioId: "studio-dataset",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await api.publishVersion({
      studioId: "studio-dataset",
      sessionId,
      draftId,
      versionId: "version:data-pipeline:v1",
      versionLabel: "v1",
    });
    const v1SourceReference = wizard.getSnapshot().stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection)?.options?.sourceReference;

    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceAssetId: "asset:source-customers:v2",
      sourceReference: "prepared://warehouse/customers-v2",
      sourceKind: "records",
    }));
    await api.updateDraft({
      studioId: "studio-dataset",
      sessionId,
      draftId,
      content: wizard.exportPipelineStateJson(),
    });
    await api.transitionLifecycle({
      studioId: "studio-dataset",
      sessionId,
      draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    await api.publishVersion({
      studioId: "studio-dataset",
      sessionId,
      draftId,
      versionId: "version:data-pipeline:v2",
      versionLabel: "v2",
      parentVersionId: "version:data-pipeline:v1",
    });

    const listed = await api.listDataStudioPipelines({
      studioId: "studio-dataset",
      draftId,
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data).toHaveLength(2);
    expect(listed.data?.[0]?.versionId).toBe("version:data-pipeline:v1");
    expect(listed.data?.[1]?.versionId).toBe("version:data-pipeline:v2");
    expect(listed.data?.[0]?.dataStudioPipeline?.kind).toBe("data-studio-pipeline-version");

    const loadedDraft = await api.loadDataStudioPipeline({
      studioId: "studio-dataset",
      draftId,
      source: "draft",
    });
    expect(loadedDraft.ok).toBeTrue();
    expect(loadedDraft.data?.source).toBe("draft");
    expect(loadedDraft.data?.pipelineState.kind).toBe("data-studio-pipeline-state");
    expect(loadedDraft.data?.latestVersionId).toBe("version:data-pipeline:v2");

    const loadedLatest = await api.loadDataStudioPipeline({
      studioId: "studio-dataset",
      draftId,
      source: "latest-version",
    });
    expect(loadedLatest.ok).toBeTrue();
    expect(loadedLatest.data?.source).toBe("version");
    expect(loadedLatest.data?.selectedVersionId).toBe("version:data-pipeline:v2");

    const loadedVersion = await api.loadDataStudioPipeline({
      studioId: "studio-dataset",
      draftId,
      source: "version-id",
      versionId: "version:data-pipeline:v1",
    });
    expect(loadedVersion.ok).toBeTrue();
    expect(loadedVersion.data?.source).toBe("version");
    expect(loadedVersion.data?.selectedVersionId).toBe("version:data-pipeline:v1");
    expect(loadedVersion.data?.pipelineState.kind).toBe("data-studio-pipeline-state");
    const loadedV1SourceReference = loadedVersion.data?.pipelineState.stages
      .find((stage) => stage.stageId === PipelineStageIds.SourceSelection)
      ?.options?.sourceReference;
    const loadedLatestSourceReference = loadedLatest.data?.pipelineState.stages
      .find((stage) => stage.stageId === PipelineStageIds.SourceSelection)
      ?.options?.sourceReference;
    expect(loadedV1SourceReference).toBe(v1SourceReference);
    expect(loadedLatestSourceReference).toBe("prepared://warehouse/customers-v2");
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

  it("returns run observability metadata and persists manual launch records when run-history repository is available", async () => {
    const workflowRunRepository = new InMemoryWorkflowRunSummaryRepository();
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      workflowRunRepository,
    );

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
      }),
      inputValues: {
        customerId: "customer-42",
      },
    });

    expect(run.ok).toBeTrue();
    expect(run.data?.run?.runId).toBeDefined();
    expect(run.data?.run?.workflowId).toContain("workflow:");

    const persisted = await workflowRunRepository.getDetailByRunId(run.data!.run!.runId);
    expect(persisted).toBeDefined();
    expect(persisted?.summary.correlation.workflowExecutionId).toBe(run.data?.execution.executionId);
    expect((persisted?.executionContext?.executionInput as Record<string, unknown>)?.parameters).toEqual(expect.objectContaining({
      inputValues: {
        customerId: "customer-42",
      },
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

