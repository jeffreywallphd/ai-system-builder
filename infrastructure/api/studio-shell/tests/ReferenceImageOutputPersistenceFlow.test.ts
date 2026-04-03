import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Reference image output persistence flow", () => {
  it("persists generated workflow outputs into the system-owned output dataset and returns gallery items", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
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

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      executionId: "run:output:1",
      sourceAssetId: "generated-output:upload://source.png",
      parameterSnapshot: {
        editInstruction: "brighten and sharpen",
        variationStrength: 0.45,
        resultCount: 1,
      },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{ selectionId: "source-1", imageId: "source-1", assetRef: { assetId: "generated-output:upload://source.png", recordId: "source-1" } }],
        parameters: { editInstruction: "brighten and sharpen", variationStrength: 0.45, resultCount: 1 },
        datasets: [{ referenceId: "active-input", instanceId: "dataset-instance:reference-image:input", datasetAssetId: "asset:dataset:image-reference-input", role: "active-input" }],
        runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: "session:test:1" },
      },
      workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
      workflowAssetVersionId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
      systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      runtimeResult: {
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:output:1",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://generated-1.png",
                    metadata: {
                      filename: "generated-1.png",
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
    expect(persisted.data?.datasetInstanceId).toBe("dataset-instance:reference-image:output");
    expect(persisted.data?.persistedRecordIds.length).toBe(1);
    expect(persisted.data?.status).toBe("materialized");
    expect(persisted.data?.executionOutcome).toBe("success");
    expect(persisted.data?.persistenceBlocked).toBeFalse();

    const listed = await api.listReferenceImageOutputs({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      limit: 10,
      offset: 0,
    });

    expect(listed.ok).toBeTrue();
    expect(listed.data?.summary.datasetInstanceId).toBe("dataset-instance:reference-image:output");
    expect(listed.data?.summary.totalItems).toBe(1);
    expect(listed.data?.items[0]?.workflow?.workflowRunId).toBe("run:output:1");
    expect(listed.data?.items[0]?.sourceImage?.stableId).toBe("generated-output:upload://source.png");
    expect(listed.data?.items[0]?.generationParametersSummary.editInstruction).toBe("brighten and sharpen");

    const history = await api.listReferenceImageRunHistory({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      limit: 10,
      offset: 0,
    });

    expect(history.ok).toBeTrue();
    expect(history.data?.summary.totalRuns).toBe(1);
    expect(history.data?.runs[0]?.runId).toBe("run:output:1");
    expect(history.data?.runs[0]?.outputs.datasetInstance?.persistedRecordIds).toEqual(persisted.data?.persistedRecordIds);
    expect(history.data?.runs[0]?.inputs.parameterSummary.editInstruction).toBe("brighten and sharpen");
    expect(history.data?.runs[0]?.lineage?.workflowExecutionId).toBe("run:output:1");
    expect(history.data?.runs[0]?.lineage?.sourceDatasetInstanceId).toBe("dataset-instance:reference-image:input");
    expect(history.data?.runs[0]?.lineage?.systemAssetId).toBe(ReferenceImageSystemTemplate.systemAsset.assetId);
    expect(history.data?.runs[0]?.lineage?.status).toBe("complete");
  });
});

it("records explicit incomplete lineage when runtime output payload is missing", async () => {
  const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
  const initialized = await api.initializeStudio("studio-system", "System Studio");
  const created = await api.createDraft({
    studioId: "studio-system",
    sessionId: initialized.data!.activeSessionId!,
    assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
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

  const persisted = await api.persistReferenceImageOutputs({
    studioId: "studio-system",
    draftId: created.data!.draft!.draftId,
    executionId: "run:output:missing",
    runtimeContext: {
      contractVersion: "1.0.0",
      selectedImages: [],
      parameters: {},
      datasets: [],
      runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId },
    },
  });
  expect(persisted.ok).toBeTrue();
  expect(persisted.data?.status).toBe("failed");
  expect(persisted.data?.executionOutcome).toBe("recoverable-failure");
  expect(persisted.data?.persistenceBlocked).toBeTrue();

  const history = await api.listReferenceImageRunHistory({
    studioId: "studio-system",
    draftId: created.data!.draft!.draftId,
    limit: 10,
    offset: 0,
  });

  expect(history.ok).toBeTrue();
  expect(history.data?.runs[0]?.lineage?.status).toBe("incomplete");
  expect(history.data?.runs[0]?.lineage?.missing).toContain("runtime-output");
});

it("fails fast with recoverable diagnostics when runtime context is incomplete", async () => {
  const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
  const initialized = await api.initializeStudio("studio-system", "System Studio");
  const created = await api.createDraft({
    studioId: "studio-system",
    sessionId: initialized.data!.activeSessionId!,
    assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
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

  const persisted = await api.persistReferenceImageOutputs({
    studioId: "studio-system",
    draftId: created.data!.draft!.draftId,
    executionId: "run:invalid-context",
    runtimeContext: {
      contractVersion: "1.0.0",
      selectedImages: [],
      parameters: { resultCount: 1 },
      datasets: [{
        referenceId: "active-input",
        datasetAssetId: "asset:dataset:image-reference-input",
        role: "active-input",
      }],
      runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId },
    },
    runtimeResult: {
      output: {
        payload: {
          nodeResults: {
            workflow: {
              result: {
                executionId: "run:invalid-context",
                status: "completed",
                outputs: [{
                  nodeId: "save_image",
                  kind: "image",
                  reference: "memory://invalid-context.png",
                  metadata: {
                    filename: "invalid-context.png",
                    format: "png",
                    width: 512,
                    height: 512,
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
  expect(persisted.data?.status).toBe("failed");
  expect(persisted.data?.failureMessages.length).toBeGreaterThan(0);
  expect(persisted.data?.executionOutcome).toBe("recoverable-failure");
  expect(persisted.data?.persistenceBlocked).toBeTrue();

  const history = await api.listReferenceImageRunHistory({
    studioId: "studio-system",
    draftId: created.data!.draft!.draftId,
    limit: 10,
    offset: 0,
  });

  expect(history.ok).toBeTrue();
  expect(history.data?.runs[0]?.lineage?.status).toBe("incomplete");
  expect(history.data?.runs[0]?.lineage?.missing).toContain("selected-image-missing");
});

it("blocks persistence when upstream execution status is failed", async () => {
  const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
  const initialized = await api.initializeStudio("studio-system", "System Studio");
  const created = await api.createDraft({
    studioId: "studio-system",
    sessionId: initialized.data!.activeSessionId!,
    assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
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

  const persisted = await api.persistReferenceImageOutputs({
    studioId: "studio-system",
    draftId: created.data!.draft!.draftId,
    executionId: "run:runtime-failed",
    sourceAssetId: "generated-output:upload://source.png",
    runtimeContext: {
      contractVersion: "1.0.0",
      selectedImages: [{ selectionId: "source-1", imageId: "source-1", assetRef: { assetId: "generated-output:upload://source.png", recordId: "source-1" } }],
      parameters: { resultCount: 1 },
      datasets: [{ referenceId: "active-input", instanceId: "dataset-instance:reference-image:input", datasetAssetId: "asset:dataset:image-reference-input", role: "active-input" }],
      runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: "session:test:1" },
    },
    runtimeResult: {
      status: "failed",
      output: {
        payload: {
          nodeResults: {
            workflow: {
              result: {
                executionId: "run:runtime-failed",
                status: "completed",
                outputs: [{
                  nodeId: "save_image",
                  kind: "image",
                  reference: "memory://should-not-persist.png",
                }],
              },
            },
          },
        },
      },
    },
  });

  expect(persisted.ok).toBeTrue();
  expect(persisted.data?.status).toBe("failed");
  expect(persisted.data?.persistedRecordIds).toEqual([]);
  expect(persisted.data?.executionOutcome).toBe("non-recoverable-failure");
  expect(persisted.data?.persistenceBlocked).toBeTrue();
});

it("keeps output/history views synchronized across repeated saves for the same draft", async () => {
  const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
  const initialized = await api.initializeStudio("studio-system", "System Studio");
  const created = await api.createDraft({
    studioId: "studio-system",
    sessionId: initialized.data!.activeSessionId!,
    assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
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

  const draftId = created.data!.draft!.draftId;
  for (const index of [1, 2]) {
    const runId = `run:sync:${index}`;
    const persistResult = await api.persistReferenceImageOutputs({
      studioId: "studio-system",
      draftId,
      executionId: runId,
      sourceAssetId: "generated-output:upload://source.png",
      parameterSnapshot: { editInstruction: `variation ${index}`, resultCount: 1 },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{ selectionId: "source-1", imageId: "source-1", assetRef: { assetId: "generated-output:upload://source.png", recordId: "source-1" } }],
        parameters: { editInstruction: `variation ${index}`, resultCount: 1 },
        datasets: [{ referenceId: "active-input", instanceId: "dataset-instance:reference-image:input", datasetAssetId: "asset:dataset:image-reference-input", role: "active-input" }],
        runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: `session:sync:${index}` },
      },
      workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
      workflowAssetVersionId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
      systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      runtimeResult: {
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
                    reference: `memory://generated-sync-${index}.png`,
                    metadata: {
                      filename: `generated-sync-${index}.png`,
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
    expect(persistResult.ok).toBeTrue();
    expect(persistResult.data?.persistedRecordIds.length).toBe(1);
  }

  const listed = await api.listReferenceImageOutputs({
    studioId: "studio-system",
    draftId,
    limit: 10,
    offset: 0,
  });
  expect(listed.ok).toBeTrue();
  expect(listed.data?.summary.totalItems).toBe(2);

  const history = await api.listReferenceImageRunHistory({
    studioId: "studio-system",
    draftId,
    limit: 10,
    offset: 0,
  });
  expect(history.ok).toBeTrue();
  expect(history.data?.summary.totalRuns).toBe(2);
  expect(history.data?.runs[0]?.lineage?.workflowAssetId).toBe(ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId);
  expect(history.data?.runs[0]?.lineage?.workflowAssetVersionId).toBe(ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId);
});
