import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { SystemBuildTemplateCatalog } from "@application/system-studio/SystemBuildTemplateCatalog";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";

function patchDraftWorkflowParameterValues(
  contentTemplate: string,
  workflowId: string,
  parameterValues: Readonly<Record<string, unknown>>,
): string {
  const root = JSON.parse(contentTemplate) as {
    readonly systemSpec?: {
      readonly serialization?: {
        readonly runtime?: {
          readonly state?: {
            readonly imageWorkflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
          };
        };
      };
    };
  };
  const systemSpec = root.systemSpec ?? {};
  const serialization = systemSpec.serialization ?? {};
  const runtime = serialization.runtime ?? {};
  const state = runtime.state ?? {};
  const parameterMap = state.imageWorkflowParameterValuesByWorkflowId ?? {};
  const mergedState = {
    ...state,
    imageWorkflowParameterValuesByWorkflowId: {
      ...parameterMap,
      [workflowId]: {
        ...(parameterMap[workflowId] ?? {}),
        ...parameterValues,
      },
    },
  };

  return JSON.stringify({
    ...root,
    systemSpec: {
      ...systemSpec,
      serialization: {
        ...serialization,
        runtime: {
          ...runtime,
          state: mergedState,
        },
      },
    },
  });
}

describe("Image manipulation studio vertical slice verification", () => {
  it("verifies full authoritative flow from image selection through readiness, launch, monitoring, review, reuse, and reopen", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const template = SystemBuildTemplateCatalog[0]!;
    const selectedWorkflowId = ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId;

    const initialized = await api.initializeStudio("studio-system", "System Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data!.activeSessionId!;

    const workflowListing = await api.listImageWorkflowDefinitions({
      workspaceId: "workspace-alpha",
      actorUserId: "user-author",
    });
    expect(workflowListing.ok).toBeTrue();
    expect((workflowListing.data?.items.length ?? 0) > 0).toBeTrue();
    expect(workflowListing.data?.items.some((item) => item.workflowId === selectedWorkflowId)).toBeTrue();

    const workflowDetail = await api.getImageWorkflowDefinition({
      workspaceId: "workspace-alpha",
      actorUserId: "user-author",
      workflowId: selectedWorkflowId,
    });
    expect(workflowDetail.ok).toBeTrue();
    expect((workflowDetail.data?.parameterSpecifications.length ?? 0) > 0).toBeTrue();

    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
      assetId: template.draftSeed.assetId,
      content: patchDraftWorkflowParameterValues(
        template.draftSeed.contentTemplate,
        selectedWorkflowId,
        { resultCount: 1, denoiseStrength: 0.45 },
      ),
      metadata: {
        title: template.draftSeed.metadataPatch.title ?? "Image Manipulation System",
        summary: template.draftSeed.metadataPatch.summary,
        tags: template.draftSeed.metadataPatch.tags ?? ["system", "image-manipulation"],
        taxonomy: template.draftSeed.metadataPatch.taxonomy!,
        provenance: template.draftSeed.metadataPatch.provenance,
      },
      dependencies: template.draftSeed.dependencies,
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data!.draft!.draftId;

    const savedSystem = await api.saveImageSystemDefinition({
      studioId: "studio-system",
      sessionId,
      draftId,
      saveAsNew: true,
    });
    expect(savedSystem.ok).toBeTrue();
    expect(savedSystem.data?.workflowId).toBe(selectedWorkflowId);
    expect((savedSystem.data?.readinessSummary.length ?? 0) > 0).toBeTrue();
    expect(savedSystem.data?.readiness).toBeDefined();
    expect(typeof savedSystem.data?.readiness.blockingIssueCount).toBe("number");
    expect(typeof savedSystem.data?.readiness.advisoryIssueCount).toBe("number");
    const systemId = savedSystem.data!.systemId;

    const readinessDetail = await api.getImageSystemDefinition({
      workspaceId: "workspace-alpha",
      actorUserId: "user-author",
      systemId,
    });
    expect(readinessDetail.ok).toBeTrue();
    expect((readinessDetail.data?.readinessState.length ?? 0) > 0).toBeTrue();
    expect(readinessDetail.data?.readiness).toBeDefined();
    expect(readinessDetail.data?.parameterBaseline).toEqual(
      expect.objectContaining({
        resultCount: 1,
      }),
    );

    const uploaded = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId,
      fileName: "full-slice-source.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(uploaded.ok).toBeTrue();

    const runId = "run:vertical:full:1";
    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      executionId: runId,
      sourceRecordId: uploaded.data?.recordId,
      sourceAssetId: uploaded.data?.image.assetId,
      parameterSnapshot: {
        editInstruction: "Add warm highlights",
        variationStrength: 0.45,
        resultCount: 1,
      },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{
          selectionId: uploaded.data!.recordId,
          imageId: uploaded.data!.recordId,
          assetRef: {
            assetId: uploaded.data!.image.assetId,
            recordId: uploaded.data!.recordId,
          },
        }],
        parameters: {
          editInstruction: "Add warm highlights",
          variationStrength: 0.45,
          resultCount: 1,
        },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance:reference-image:input",
          datasetAssetId: "asset:dataset:image-reference-input",
          role: "active-input",
        }, {
          referenceId: "system-output",
          instanceId: "dataset-instance:reference-image:output",
          datasetAssetId: "asset:dataset:image-reference-output",
          role: "system-owned-output",
        }],
        runtime: {
          systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId,
          runtimeSessionId: "runtime:session:vertical:1",
        },
      },
      runtimeResult: {
        status: "completed",
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: runId,
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://vertical-full-1.png",
                    metadata: {
                      filename: "vertical-full-1.png",
                      format: "png",
                      width: 1024,
                      height: 768,
                    },
                  }],
                },
              },
            },
          },
        },
      },
    });
    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("materialized");
    expect(persisted.data?.persistedRecordIds).toHaveLength(1);

    const history = await api.listReferenceImageRunHistory({
      studioId: "studio-system",
      draftId,
      limit: 10,
      offset: 0,
    });
    expect(history.ok).toBeTrue();
    expect(history.data?.summary.totalRuns).toBe(1);
    expect(history.data?.runs[0]?.runId).toBe(runId);
    expect(history.data?.runs[0]?.status).toBe("completed");
    expect(history.data?.runs[0]?.lineage?.status).toBe("complete");

    const outputs = await api.listReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      limit: 10,
      offset: 0,
    });
    expect(outputs.ok).toBeTrue();
    expect(outputs.data?.summary.totalItems).toBe(1);
    const outputRecordId = outputs.data!.items[0]!.image.recordId;
    const outputDetail = await api.getReferenceImageOutput({
      studioId: "studio-system",
      draftId,
      recordId: outputRecordId,
    });
    expect(outputDetail.ok).toBeTrue();
    expect(outputDetail.data?.workflow?.workflowRunId).toBe(runId);

    const continued = await api.chainReferenceImageDatasetItemToInput({
      studioId: "studio-system",
      draftId,
      sourceDatasetBindingId: "output-image-dataset",
      sourceRecordId: outputRecordId,
      targetDatasetBindingId: "input-image-dataset",
    });
    expect(continued.ok).toBeTrue();

    const inputItems = await api.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId,
      datasetBindingId: "input-image-dataset",
      limit: 10,
      offset: 0,
    });
    expect(inputItems.ok).toBeTrue();
    expect(
      inputItems.data?.items.some((item) => item.image.recordId === continued.data?.target.recordId),
    ).toBeTrue();

    const reloaded = await api.loadSnapshot("studio-system");
    expect(reloaded.ok).toBeTrue();
    expect(reloaded.data?.draft?.draftId).toBe(draftId);

    const savedSystems = await api.listImageSystemDefinitions({
      workspaceId: "workspace-alpha",
      actorUserId: "user-author",
      limit: 20,
      offset: 0,
    });
    expect(savedSystems.ok).toBeTrue();
    expect(savedSystems.data?.items.some((item) => item.systemId === systemId)).toBeTrue();
  });

  it("captures authoritative failed-run monitoring and supports continued work after recovery", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const template = SystemBuildTemplateCatalog[0]!;

    const initialized = await api.initializeStudio("studio-system-failure", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system-failure",
      sessionId: initialized.data!.activeSessionId!,
      assetId: template.draftSeed.assetId,
      content: template.draftSeed.contentTemplate,
      metadata: {
        title: template.draftSeed.metadataPatch.title ?? "Image Manipulation System",
        summary: template.draftSeed.metadataPatch.summary,
        tags: template.draftSeed.metadataPatch.tags ?? ["system", "image-manipulation"],
        taxonomy: template.draftSeed.metadataPatch.taxonomy!,
        provenance: template.draftSeed.metadataPatch.provenance,
      },
      dependencies: template.draftSeed.dependencies,
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data!.draft!.draftId;

    const failedRun = await api.persistReferenceImageOutputs({
      studioId: "studio-system-failure",
      draftId,
      executionId: "run:vertical:failed:1",
      sourceAssetId: "generated-output:upload://failed-source.png",
      runtimeResult: {
        status: "failed",
        diagnostics: [{
          source: "runtime-error",
          severity: "error",
          code: "missing-model",
          message: "Missing checkpoint model for this runtime profile.",
        }],
      },
    });
    expect(failedRun.ok).toBeTrue();
    expect(failedRun.data?.status).toBe("failed");
    expect(failedRun.data?.persistedRecordIds).toEqual([]);
    expect(failedRun.data?.diagnostics[0]?.retryable).toBeTrue();

    const failedHistory = await api.listReferenceImageRunHistory({
      studioId: "studio-system-failure",
      draftId,
      status: "failed",
      limit: 10,
      offset: 0,
    });
    expect(failedHistory.ok).toBeTrue();
    expect(failedHistory.data?.summary.totalRuns).toBe(1);
    expect(failedHistory.data?.runs[0]?.runId).toBe("run:vertical:failed:1");

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system-failure",
      draftId,
      fileName: "recovery-source.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(upload.ok).toBeTrue();

    const recoveredRun = await api.persistReferenceImageOutputs({
      studioId: "studio-system-failure",
      draftId,
      executionId: "run:vertical:recovered:2",
      sourceRecordId: upload.data?.recordId,
      sourceAssetId: upload.data?.image.assetId,
      parameterSnapshot: {
        editInstruction: "Recover with safe defaults",
        resultCount: 1,
      },
      runtimeResult: {
        status: "completed",
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:vertical:recovered:2",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://vertical-recovered-2.png",
                    metadata: {
                      filename: "vertical-recovered-2.png",
                      format: "png",
                      width: 768,
                      height: 768,
                    },
                  }],
                },
              },
            },
          },
        },
      },
    });
    expect(recoveredRun.ok).toBeTrue();
    expect(recoveredRun.data?.status).toBe("materialized");

    const allHistory = await api.listReferenceImageRunHistory({
      studioId: "studio-system-failure",
      draftId,
      limit: 10,
      offset: 0,
    });
    expect(allHistory.ok).toBeTrue();
    expect(allHistory.data?.summary.totalRuns).toBe(2);
    expect(allHistory.data?.runs.some((run) => run.runId === "run:vertical:failed:1" && run.status === "failed")).toBeTrue();
    expect(allHistory.data?.runs.some((run) => run.runId === "run:vertical:recovered:2" && run.status === "completed")).toBeTrue();
  });
});
