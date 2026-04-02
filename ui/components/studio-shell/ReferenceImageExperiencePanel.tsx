import { useEffect, useMemo, useState } from "react";
import { ReferenceImageSystemTemplate } from "../../../application/system-studio/ReferenceImageSystemTemplate";
import type { ImageRunHistoryRecord } from "../../../application/system-runtime/ImageRunHistoryDataContract";
import type { OutputGalleryItem } from "../../../application/system-runtime/OutputGalleryDataContract";
import { createDefaultUiTriggerSystemContextMapper } from "../../../application/workflow-studio/UiTriggerSystemContextMapper";
import { createDefaultWorkflowSystemContextBindingAdapter } from "../../../application/workflow-studio/SystemContextWorkflowInputMapper";
import { createUiTriggerEvent } from "../../../application/workflow-studio/UiTriggerEventContract";
import { createSystemContextContract, type SystemContextContract } from "../../../domain/system-studio/SystemContextContract";
import type { FileIngestionPolicy } from "../../../domain/ingestion/interfaces/IFileIngestion";
import { createBrowserImageUploadIngestionAdapter } from "../assets/image-system/BrowserImageUploadIngestionAdapter";
import { ImageOutputGallery } from "../assets/image-system/ImageOutputGallery";
import { ImageViewer } from "../assets/image-system/ImageViewer";
import { mapOutputGalleryItemToImageViewModel } from "../assets/image-system/ImageOutputGalleryDataAdapter";
import { ImageUploadPanel } from "../assets/image-system/ImageUploadPanel";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";

const uploadPolicy: FileIngestionPolicy = Object.freeze({
  acceptedExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
  acceptedMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  maxFileSizeBytes: 15 * 1024 * 1024,
  conversion: {
    mode: "forbidden",
    allowedOutputFormats: Object.freeze([]),
    passThroughExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
    passThroughMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  },
});

async function encodeFileBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

interface ReferenceImageExperiencePanelProps {
  readonly context: StudioShellExtensionContext;
}

export const ReferenceImageRuntimeContextStorageKey = "referenceImageRuntimeContext";

export interface StoredReferenceImageRuntimeContext {
  readonly selectedRecordId?: string;
  readonly selectedAssetId?: string;
  readonly activeResultId?: string;
  readonly editInstruction?: string;
  readonly variationStrength?: number;
  readonly resultCount?: number;
  readonly runtimeContext: SystemContextContract;
}

function parseSystemSpecEnvelope(content: string): Record<string, unknown> {
  try {
    if (!content.trim()) {
      return {};
    }
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return { ...(parsed as Record<string, unknown>) };
  } catch {
    return {};
  }
}

export function readStoredReferenceImageRuntimeContext(content: string): StoredReferenceImageRuntimeContext | undefined {
  const root = parseSystemSpecEnvelope(content);
  const systemSpec = root.systemSpec;
  if (!systemSpec || typeof systemSpec !== "object" || Array.isArray(systemSpec)) {
    return undefined;
  }
  const stored = (systemSpec as Record<string, unknown>)[ReferenceImageRuntimeContextStorageKey];
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return undefined;
  }
  const record = stored as Record<string, unknown>;
  return Object.freeze({
    selectedRecordId: typeof record.selectedRecordId === "string" ? record.selectedRecordId : undefined,
    selectedAssetId: typeof record.selectedAssetId === "string" ? record.selectedAssetId : undefined,
    activeResultId: typeof record.activeResultId === "string" ? record.activeResultId : undefined,
    editInstruction: typeof record.editInstruction === "string" ? record.editInstruction : undefined,
    variationStrength: typeof record.variationStrength === "number" ? record.variationStrength : undefined,
    resultCount: typeof record.resultCount === "number" ? record.resultCount : undefined,
    runtimeContext: createSystemContextContract(record.runtimeContext as Partial<SystemContextContract> | undefined),
  });
}

export function persistReferenceImageRuntimeContext(content: string, context: StoredReferenceImageRuntimeContext): string {
  const root = parseSystemSpecEnvelope(content);
  const systemSpec = root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec)
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};
  systemSpec[ReferenceImageRuntimeContextStorageKey] = {
    selectedRecordId: context.selectedRecordId,
    selectedAssetId: context.selectedAssetId,
    activeResultId: context.activeResultId,
    editInstruction: context.editInstruction,
    variationStrength: context.variationStrength,
    resultCount: context.resultCount,
    runtimeContext: context.runtimeContext,
  };
  root.systemSpec = systemSpec;
  return JSON.stringify(root, null, 2);
}

export function buildReferenceImageStartRequest(input: {
  readonly studioId: string;
  readonly draftId: string;
  readonly systemAssetId: string;
  readonly runtimeContext: SystemContextContract;
}) {
  const mapper = createDefaultUiTriggerSystemContextMapper();
  const bindingAdapter = createDefaultWorkflowSystemContextBindingAdapter({
    mappingConfiguration: ReferenceImageSystemTemplate.primaryWorkflowAsset.contextMapping,
  });
  const event = createUiTriggerEvent({
    kind: "submit",
    name: "ui.reference-image.start",
    source: {
      studio: "system-studio",
      componentId: "reference-image-experience",
      actionId: "start",
    },
    payload: {
      imageId: input.runtimeContext.selectedImages[0]?.assetRef?.assetId,
      selectedImage: {
        imageId: input.runtimeContext.selectedImages[0]?.imageId,
        assetRef: {
          assetId: input.runtimeContext.selectedImages[0]?.assetRef?.assetId,
          recordId: input.runtimeContext.selectedImages[0]?.assetRef?.recordId,
        },
      },
      parameters: input.runtimeContext.parameters,
    },
    context: {
      systemAssetId: input.systemAssetId,
      references: {
        systemDatasetInstanceId: input.runtimeContext.datasets[0]?.instanceId,
        datasetInstanceId: input.runtimeContext.datasets[0]?.instanceId,
        systemDatasetRole: "input-store",
      },
    },
  });
  const systemContext = mapper.map(event);
  const mapped = bindingAdapter.map(systemContext);
  return Object.freeze({
    studioId: input.studioId,
    draftId: input.draftId,
    context: Object.freeze({
      trigger: "manual" as const,
      actorId: "reference-image-ui",
      inputValues: mapped.inputValues,
      metadata: mapped.metadata,
      runtimeContext: systemContext,
    }),
  });
}

export function ReferenceImageExperiencePanel({ context }: ReferenceImageExperiencePanelProps): JSX.Element {
  const snapshot = context.snapshot;
  const draft = snapshot?.draft;
  const isReferenceImageDraft = draft?.assetId === ReferenceImageSystemTemplate.systemAsset.assetId;
  const studioShell = useMemo(() => new StudioShellService(), []);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [datasetInstanceId, setDatasetInstanceId] = useState<string | undefined>();
  const [editInstruction, setEditInstruction] = useState("");
  const [variationStrength, setVariationStrength] = useState(0.5);
  const [resultCount, setResultCount] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [resultItems, setResultItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [activeResultId, setActiveResultId] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [runHistory, setRunHistory] = useState<ReadonlyArray<ImageRunHistoryRecord>>([]);
  const uploadAdapter = useMemo(() => createBrowserImageUploadIngestionAdapter({ policy: uploadPolicy }), []);
  const selectedResult = useMemo(
    () => resultItems.find((item) => item.image.recordId === activeResultId) ?? resultItems[0],
    [resultItems, activeResultId],
  );
  const resultViewModels = useMemo(
    () => resultItems.map((item) => mapOutputGalleryItemToImageViewModel(item)),
    [resultItems],
  );
  const selectedResultViewModel = useMemo(
    () => selectedResult ? mapOutputGalleryItemToImageViewModel(selectedResult) : undefined,
    [selectedResult],
  );

  const loadResults = () => {
    if (!draft) {
      return Promise.resolve();
    }
    setIsLoadingResults(true);
    return studioShell.listReferenceImageOutputs({
      studioId: context.studioId,
      draftId: draft.draftId,
      limit: 24,
      offset: 0,
    }).then((response) => {
      if (!response.ok || !response.data) {
        return;
      }
      setResultItems(response.data.items);
      if (!activeResultId && response.data.items[0]) {
        setActiveResultId(response.data.items[0].image.recordId);
      }
    }).finally(() => setIsLoadingResults(false));
  };

  const loadHistory = () => {
    if (!draft) {
      return Promise.resolve();
    }
    setIsLoadingHistory(true);
    return studioShell.listReferenceImageRunHistory({
      studioId: context.studioId,
      draftId: draft.draftId,
      limit: 20,
      offset: 0,
    }).then((response) => {
      if (!response.ok || !response.data) {
        return;
      }
      setRunHistory(response.data.runs);
    }).finally(() => setIsLoadingHistory(false));
  };

  useEffect(() => {
    void loadResults();
    void loadHistory();
  }, [draft?.draftId]);

  useEffect(() => {
    const stored = readStoredReferenceImageRuntimeContext(draft.content);
    if (!stored) {
      return;
    }
    setSelectedRecordId(stored.selectedRecordId);
    setSelectedAssetId(stored.selectedAssetId);
    setActiveResultId(stored.activeResultId);
    setEditInstruction(stored.editInstruction ?? "");
    setVariationStrength(stored.variationStrength ?? 0.5);
    setResultCount(stored.resultCount ?? 1);
    const datasetRef = stored.runtimeContext.datasets.find((entry) => entry.role === "active-input" || entry.role === "input-store");
    setDatasetInstanceId(datasetRef?.instanceId);
  }, [draft.draftId]);

  useEffect(() => {
    const selectedImage = selectedRecordId && selectedAssetId
      ? Object.freeze([{ selectionId: selectedRecordId, imageId: selectedRecordId, assetRef: { assetId: selectedAssetId, recordId: selectedRecordId } }])
      : Object.freeze([]);
    const runtimeContext = createSystemContextContract({
      selectedImages: selectedImage,
      parameters: Object.freeze({ editInstruction, variationStrength, resultCount }),
      datasets: datasetInstanceId
        ? Object.freeze([{ referenceId: "active-input", instanceId: datasetInstanceId, role: "active-input", datasetAssetId: "asset:dataset:image-reference-input" }])
        : Object.freeze([]),
      runtime: {
        runtimeSessionId: snapshot?.activeSessionId,
        systemAssetId: draft.assetId,
        workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
        sourceStudio: "system-studio",
      },
      extensions: {
        workflowInputBinding: ReferenceImageSystemTemplate.primaryWorkflowAsset.datasetBindings.workflowInputId,
        outputDatasetBinding: ReferenceImageSystemTemplate.primaryWorkflowAsset.datasetBindings.outputDatasetInstanceBindingId,
      },
    });
    context.operations.setDraftContent?.(persistReferenceImageRuntimeContext(draft.content, {
      selectedRecordId,
      selectedAssetId,
      activeResultId,
      editInstruction,
      variationStrength,
      resultCount,
      runtimeContext,
    }));
  }, [
    activeResultId,
    context.operations,
    datasetInstanceId,
    draft.assetId,
    draft.content,
    editInstruction,
    resultCount,
    selectedAssetId,
    selectedRecordId,
    snapshot?.activeSessionId,
    variationStrength,
  ]);

  if (!isReferenceImageDraft || !draft) {
    return (
      <section className="ui-image-surface ui-image-surface--status">
        This template panel appears when the reference image system is open.
      </section>
    );
  }

  return (
    <section className="ui-stack ui-stack--sm">
      <ImageUploadPanel
        title="Upload image"
        acceptedMimeTypes={["image/png", "image/jpeg", "image/webp"]}
        maxUploadCount={1}
        ingestionAdapter={uploadAdapter}
        targetContext={{
          system: {
            systemAssetId: draft.assetId,
          },
          dataset: datasetInstanceId
            ? {
              datasetAssetId: "asset:dataset:image-reference-input",
              datasetVersionId: "v1",
              systemDatasetInstanceId: datasetInstanceId,
            }
            : undefined,
        }}
        disabled={context.isBusy || isUploading}
        onUploadRequested={(event) => {
          const file = event.files[0];
          if (!file) {
            return;
          }
          setIsUploading(true);
          setStatus(undefined);
          void encodeFileBase64(file)
            .then((payloadBase64) => studioShell.ingestReferenceImageUpload({
              studioId: context.studioId,
              draftId: draft.draftId,
              fileName: file.name,
              mimeType: file.type,
              payloadBase64,
            }))
            .then((response) => {
              if (!response.ok || !response.data) {
                setStatus(response.error?.message ?? "Upload failed.");
                return;
              }
              setSelectedRecordId(response.data.recordId);
              setSelectedAssetId(response.data.image.assetId);
              setDatasetInstanceId(response.data.datasetInstanceId);
              setStatus("Image uploaded and ready.");
            })
            .then(() => Promise.all([loadResults(), loadHistory()]))
            .finally(() => {
              setIsUploading(false);
            });
        }}
      />
      <section className="ui-image-surface">
        <header className="ui-image-surface__header">
          <h3 className="ui-image-surface__title">Processing settings</h3>
        </header>
        <label className="ui-form-field">
          <span className="ui-form-field__label">Edit instructions</span>
          <textarea className="ui-input" value={editInstruction} onChange={(event) => setEditInstruction(event.currentTarget.value)} rows={3} />
        </label>
        <details>
          <summary className="ui-text-small ui-text-secondary">Advanced</summary>
          <div className="ui-grid ui-grid--2" style={{ marginTop: "0.5rem" }}>
            <label className="ui-form-field">
              <span className="ui-form-field__label">Variation strength</span>
              <input className="ui-input" type="number" min={0} max={1} step={0.05} value={variationStrength} onChange={(event) => setVariationStrength(Number(event.currentTarget.value) || 0)} />
            </label>
            <label className="ui-form-field">
              <span className="ui-form-field__label">Result count</span>
              <input className="ui-input" type="number" min={1} max={4} step={1} value={resultCount} onChange={(event) => setResultCount(Math.max(1, Number(event.currentTarget.value) || 1))} />
            </label>
          </div>
        </details>
      </section>
      <section className="ui-image-surface">
        <header className="ui-image-surface__header">
          <h3 className="ui-image-surface__title">Results</h3>
        </header>
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={!selectedRecordId || !selectedAssetId || !datasetInstanceId || isStarting || !context.operations.startSystemExecution}
          onClick={() => {
            if (!selectedRecordId || !selectedAssetId || !datasetInstanceId || !context.operations.startSystemExecution) {
              return;
            }
            setIsStarting(true);
            const request = buildReferenceImageStartRequest({
              studioId: context.studioId,
              draftId: draft.draftId,
              systemAssetId: draft.assetId,
              runtimeContext: createSystemContextContract({
                selectedImages: [{
                  selectionId: selectedRecordId,
                  imageId: selectedRecordId,
                  assetRef: {
                    assetId: selectedAssetId,
                    recordId: selectedRecordId,
                  },
                }],
                parameters: { editInstruction, variationStrength, resultCount },
                datasets: [{
                  referenceId: "active-input",
                  instanceId: datasetInstanceId,
                  datasetAssetId: "asset:dataset:image-reference-input",
                  role: "active-input",
                  systemAssetId: draft.assetId,
                }, {
                  referenceId: "system-output",
                  instanceId: "dataset-instance:reference-image:output",
                  datasetAssetId: "asset:dataset:image-reference-output",
                  role: "system-owned-output",
                  systemAssetId: draft.assetId,
                }],
                runtime: {
                  runtimeSessionId: snapshot?.activeSessionId,
                  systemAssetId: draft.assetId,
                  workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
                  sourceStudio: "system-studio",
                },
              }),
            });
            void context.operations.startSystemExecution(request).then((response) => {
              if (!response.ok || !response.data) {
                setStatus(response.error?.message ?? "Could not start processing.");
                return;
              }
              const executionId = response.data.executionId;
              void studioShell.getSystemExecutionResult(executionId)
                .then((result) => studioShell.persistReferenceImageOutputs({
                  studioId: context.studioId,
                  draftId: draft.draftId,
                  executionId,
                  sourceRecordId: selectedRecordId,
                  sourceAssetId: selectedAssetId,
                  parameterSnapshot: {
                    editInstruction,
                    variationStrength,
                    resultCount,
                  },
                  runtimeContext: request.context.runtimeContext,
                  workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
                  workflowAssetVersionId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
                  systemAssetId: draft.assetId,
                  runtimeResult: result.ok
                    ? { output: result.data?.output, status: result.data?.status }
                    : undefined,
                }))
                .then((persisted) => {
                  if (!persisted.ok) {
                    setStatus(persisted.error?.message ?? `Run started (${executionId}), but results could not be saved.`);
                    return;
                  }
                  const count = persisted.data?.persistedRecordIds.length ?? 0;
                  setStatus(count > 0
                    ? `Generated images saved (${count}).`
                    : "Run finished, but no generated images were returned.");
                })
                .then(() => Promise.all([loadResults(), loadHistory()]));
            }).finally(() => setIsStarting(false));
          }}
        >
          {isStarting ? "Starting..." : "Start"}
        </button>
        {status ? <p className="ui-text-small ui-text-secondary">{status}</p> : null}
      </section>
      <section className="ui-image-surface">
        <header className="ui-image-surface__header">
          <h3 className="ui-image-surface__title">Generated images</h3>
        </header>
        <ImageOutputGallery
          title="Results"
          items={resultViewModels}
          loading={isLoadingResults}
          emptyMessage="No generated images yet. Start a run to see results here."
          renderOptions={{
            fitMode: "cover",
            zoomCapability: "disabled",
            placeholderBehavior: "show-placeholder",
            lazyLoad: true,
            allowSelectionHighlight: true,
          }}
          selection={{
            mode: "single",
            selectedIds: activeResultId ? [activeResultId] : [],
            focusedId: activeResultId,
          }}
          onSelectionChanged={(event) => {
            setActiveResultId(event.selection.focusedId ?? event.selection.selectedIds[0]);
          }}
          onItemOpened={(event) => {
            setActiveResultId(event.imageId);
          }}
          presentationMode="grid"
        />
        {selectedResultViewModel ? (
          <div className="ui-stack ui-stack--sm" style={{ marginTop: "0.75rem" }}>
            <div className="ui-row ui-row--space-between ui-row--middle">
              <h4 className="ui-text-small" style={{ margin: 0 }}>View details</h4>
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => setActiveResultId(selectedResultViewModel.imageId)}>
                Open
              </button>
            </div>
            <ImageViewer
              image={selectedResultViewModel}
              renderOptions={{
                fitMode: "contain",
                zoomCapability: "buttons",
                placeholderBehavior: "show-placeholder",
                lazyLoad: false,
                allowSelectionHighlight: true,
              }}
              selection={{
                mode: "single",
                selectedIds: [selectedResultViewModel.imageId],
                focusedId: selectedResultViewModel.imageId,
              }}
              showMetadata
            />
            <details>
              <summary className="ui-text-small ui-text-secondary">Settings used</summary>
              <pre className="ui-code-block">{JSON.stringify(selectedResult?.generationParametersSummary ?? {}, null, 2)}</pre>
            </details>
            <p className="ui-text-small ui-text-secondary">
              Created from {selectedResult?.sourceImage?.stableId ?? "your uploaded image"}.
            </p>
          </div>
        ) : null}
      </section>
      <section className="ui-image-surface">
        <header className="ui-image-surface__header">
          <h3 className="ui-image-surface__title">Recent activity</h3>
        </header>
        {isLoadingHistory ? <p className="ui-text-small ui-text-secondary">Loading activity...</p> : null}
        {runHistory.length === 0 && !isLoadingHistory ? (
          <p className="ui-text-small ui-text-secondary">No previous results yet.</p>
        ) : null}
        <div className="ui-stack ui-stack--xs">
          {runHistory.map((run) => (
            <article key={run.runId} className="ui-card ui-stack ui-stack--xs">
              <strong className="ui-text-small">Run details</strong>
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                Created {new Date(run.timestamps.requestedAt).toLocaleString()}
              </p>
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                Source image: {run.inputs.images[0]?.stableId ?? "Uploaded image"}
              </p>
              <div className="ui-row ui-row--space-between ui-row--middle">
                <span className="ui-text-small ui-text-secondary">
                  Previous results: {run.outputs.datasetInstance?.persistedRecordIds.length ?? 0}
                </span>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  onClick={() => {
                    const firstResultId = run.outputs.datasetInstance?.persistedRecordIds[0];
                    if (firstResultId) {
                      setActiveResultId(firstResultId);
                    }
                  }}
                >
                  Open result
                </button>
              </div>
              <details>
                <summary className="ui-text-small ui-text-secondary">Settings</summary>
                <pre className="ui-code-block">{JSON.stringify(run.inputs.parameterSummary ?? {}, null, 2)}</pre>
              </details>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
