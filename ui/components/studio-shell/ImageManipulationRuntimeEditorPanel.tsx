import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
  resolveComfyImageManipulationConfig,
  validateComfyImageManipulationConfig,
  type ComfyImageManipulationConfig,
} from "../../../application/system-studio/ComfyImageManipulationPropertySchema";
import { ReferenceImageSystemTemplate } from "../../../application/system-studio/ReferenceImageSystemTemplate";
import { validateReferenceImageCrossStudioContext, type CrossStudioIntegrityIssue } from "../../../application/system-studio/ReferenceImageCrossStudioIntegrity";
import type { OutputGalleryItem } from "../../../application/system-runtime/OutputGalleryDataContract";
import type { ReferenceImageDatasetBindingId } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { createSystemContextContract } from "../../../domain/system-studio/SystemContextContract";
import type { FileIngestionPolicy } from "../../../domain/ingestion/interfaces/IFileIngestion";
import { createBrowserImageUploadIngestionAdapter } from "../assets/image-system/BrowserImageUploadIngestionAdapter";
import { ImageUploadPanel } from "../assets/image-system/ImageUploadPanel";
import { ImageGallerySlider } from "../assets/image-system/ImageGallerySlider";
import { ImagePreviewPanel } from "../assets/image-system/ImagePreviewPanel";
import { mapOutputGalleryItemToImageViewModel } from "../assets/image-system/ImageOutputGalleryDataAdapter";
import type { ImageUiViewModel } from "../assets/image-system/ImageUiContracts";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";
import ComfyImageManipulationPropertyEditor from "../assets/image-system/ComfyImageManipulationPropertyEditor";
import { buildReferenceImageStartRequest } from "./ReferenceImageExperiencePanel";
import {
  ReferenceImageExecutionFlowService,
  createReferenceImageOutputPersistenceRequest,
  type ReferenceImageExecutionFlowIssue,
  type ReferenceImageExecutionFlowStep,
} from "../../runtime/ReferenceImageExecutionFlowService";

const uploadPolicy: FileIngestionPolicy = Object.freeze({
  acceptedExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
  acceptedMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  maxFileSizeBytes: 15 * 1024 * 1024,
  conversion: Object.freeze({
    mode: "forbidden",
    allowedOutputFormats: Object.freeze([]),
    passThroughExtensions: Object.freeze(["png", "jpg", "jpeg", "webp"]),
    passThroughMimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  }),
});

type PreviewSelectionContext = "source" | "output" | "reference";

const previewContextLabels: Record<PreviewSelectionContext, string> = Object.freeze({
  source: "Source photo",
  output: "Created image",
  reference: "Face reference photo",
});

function toFriendlyTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }
  return timestamp.toLocaleString();
}

function mapItemsToDisplayViewModels(items: ReadonlyArray<OutputGalleryItem>, context: PreviewSelectionContext): ReadonlyArray<ImageUiViewModel> {
  const singularLabel = context === "source"
    ? "Source"
    : context === "reference"
      ? "Reference"
      : "Result";

  return Object.freeze(items.map((item, index) => {
    const mapped = mapOutputGalleryItemToImageViewModel(item);
    return Object.freeze({
      ...mapped,
      title: `${singularLabel} ${index + 1}`,
      subtitle: toFriendlyTimestamp(item.timestamps.updatedAt),
    });
  }));
}

function resolveSelectedItem(
  items: ReadonlyArray<OutputGalleryItem>,
  selectedRecordId?: string,
): OutputGalleryItem | undefined {
  if (items.length < 1) {
    return undefined;
  }
  if (selectedRecordId) {
    const matched = items.find((item) => item.image.recordId === selectedRecordId);
    if (matched) {
      return matched;
    }
  }
  return items[0];
}

async function encodeFileBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export interface ImageManipulationRuntimeEditorPanelProps {
  readonly context: StudioShellExtensionContext;
}

export function ImageManipulationRuntimeEditorPanel({ context }: ImageManipulationRuntimeEditorPanelProps): JSX.Element {
  const [presetId, setPresetId] = useState(ComfyImageManipulationPropertySchema.defaultPresetId);
  const [config, setConfig] = useState<ComfyImageManipulationConfig>(() => createComfyImageManipulationDefaultConfig());
  const draft = context.snapshot?.draft;
  const isTemplateDraft = draft?.assetId === ReferenceImageSystemTemplate.systemAsset.assetId;
  const studioShell = useMemo(() => new StudioShellService(), []);
  const uploadAdapter = useMemo(() => createBrowserImageUploadIngestionAdapter({ policy: uploadPolicy }), []);
  const executionFlow = useMemo(() => new ReferenceImageExecutionFlowService(), []);
  const requestIdRef = useRef(0);

  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [datasetInstanceId, setDatasetInstanceId] = useState<string | undefined>();

  const [activeSelectionContext, setActiveSelectionContext] = useState<PreviewSelectionContext>("output");
  const [activeSourceId, setActiveSourceId] = useState<string | undefined>();
  const [activeResultId, setActiveResultId] = useState<string | undefined>();
  const [activeReferenceId, setActiveReferenceId] = useState<string | undefined>();

  const [outputItems, setOutputItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [sourceItems, setSourceItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [referenceItems, setReferenceItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [outputLoadError, setOutputLoadError] = useState<string | undefined>();
  const [sourceLoadError, setSourceLoadError] = useState<string | undefined>();
  const [referenceLoadError, setReferenceLoadError] = useState<string | undefined>();

  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [integrityIssues, setIntegrityIssues] = useState<ReadonlyArray<CrossStudioIntegrityIssue>>([]);
  const [flowSteps, setFlowSteps] = useState<ReadonlyArray<ReferenceImageExecutionFlowStep>>([]);
  const [flowIssues, setFlowIssues] = useState<ReadonlyArray<ReferenceImageExecutionFlowIssue>>([]);

  const validationIssues = useMemo(() => validateComfyImageManipulationConfig(config), [config]);

  const sourceViewModels = useMemo(
    () => mapItemsToDisplayViewModels(sourceItems, "source"),
    [sourceItems],
  );
  const outputViewModels = useMemo(
    () => mapItemsToDisplayViewModels(outputItems, "output"),
    [outputItems],
  );
  const referenceViewModels = useMemo(
    () => mapItemsToDisplayViewModels(referenceItems, "reference"),
    [referenceItems],
  );

  const selectedSourceItem = useMemo(
    () => resolveSelectedItem(sourceItems, activeSourceId ?? selectedRecordId),
    [sourceItems, activeSourceId, selectedRecordId],
  );
  const selectedOutputItem = useMemo(
    () => resolveSelectedItem(outputItems, activeResultId),
    [outputItems, activeResultId],
  );
  const selectedReferenceItem = useMemo(
    () => resolveSelectedItem(referenceItems, activeReferenceId),
    [referenceItems, activeReferenceId],
  );

  const selectedPreviewViewModel = useMemo(() => {
    if (activeSelectionContext === "source") {
      return selectedSourceItem ? mapItemsToDisplayViewModels([selectedSourceItem], "source")[0] : undefined;
    }
    if (activeSelectionContext === "reference") {
      return selectedReferenceItem ? mapItemsToDisplayViewModels([selectedReferenceItem], "reference")[0] : undefined;
    }
    return selectedOutputItem ? mapItemsToDisplayViewModels([selectedOutputItem], "output")[0] : undefined;
  }, [activeSelectionContext, selectedSourceItem, selectedReferenceItem, selectedOutputItem]);

  const previewLoading = activeSelectionContext === "source"
    ? isLoadingSources
    : activeSelectionContext === "reference"
      ? isLoadingReferences
      : isLoadingOutputs;

  const previewErrorMessage = activeSelectionContext === "source"
    ? sourceLoadError
    : activeSelectionContext === "reference"
      ? referenceLoadError
      : outputLoadError;

  const activeGallery = useMemo(() => {
    if (activeSelectionContext === "source") {
      return {
        title: "Source photos",
        subtitle: "Images you've uploaded for editing",
        items: sourceViewModels,
        selectedId: activeSourceId ?? selectedSourceItem?.image.recordId,
        loading: isLoadingSources,
        errorMessage: sourceLoadError,
        emptyMessage: "Upload a photo to get started.",
      } as const;
    }
    if (activeSelectionContext === "reference") {
      return {
        title: "Face reference photos",
        subtitle: "Optional reference images for identity guidance",
        items: referenceViewModels,
        selectedId: activeReferenceId ?? selectedReferenceItem?.image.recordId,
        loading: isLoadingReferences,
        errorMessage: referenceLoadError,
        emptyMessage: "No face reference photos are available yet.",
      } as const;
    }
    return {
      title: "Created images",
      subtitle: "Recent results from this editor",
      items: outputViewModels,
      selectedId: activeResultId ?? selectedOutputItem?.image.recordId,
      loading: isLoadingOutputs,
      errorMessage: outputLoadError,
      emptyMessage: "Create an image to see results here.",
    } as const;
  }, [
    activeSelectionContext,
    sourceViewModels,
    outputViewModels,
    referenceViewModels,
    activeSourceId,
    activeResultId,
    activeReferenceId,
    selectedSourceItem,
    selectedOutputItem,
    selectedReferenceItem,
    isLoadingSources,
    isLoadingReferences,
    isLoadingOutputs,
    sourceLoadError,
    referenceLoadError,
    outputLoadError,
  ]);

  const loadCollection = (
    datasetBindingId: ReferenceImageDatasetBindingId,
    setLoading: (value: boolean) => void,
    setError: (value: string | undefined) => void,
  ): Promise<ReadonlyArray<OutputGalleryItem>> => {
    if (!draft?.draftId) {
      return Promise.resolve(Object.freeze([]));
    }
    setLoading(true);
    setError(undefined);

    const request = datasetBindingId === "output-image-dataset"
      ? studioShell.listReferenceImageOutputs({
        studioId: context.studioId,
        draftId: draft.draftId,
        limit: 24,
        offset: 0,
      })
      : studioShell.listReferenceImageDatasetItems({
        studioId: context.studioId,
        draftId: draft.draftId,
        datasetBindingId,
        limit: 24,
        offset: 0,
      });

    return request.then((response) => {
      if (!response.ok || !response.data) {
        setError(response.error?.message ?? "Couldn't load images right now.");
        return Object.freeze([]);
      }
      return response.data.items;
    }).finally(() => setLoading(false));
  };

  const loadCollections = (): Promise<void> => {
    if (!draft?.draftId) {
      setSourceItems(Object.freeze([]));
      setOutputItems(Object.freeze([]));
      setReferenceItems(Object.freeze([]));
      return Promise.resolve();
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    return Promise.all([
      loadCollection("input-image-dataset", setIsLoadingSources, setSourceLoadError),
      loadCollection("output-image-dataset", setIsLoadingOutputs, setOutputLoadError),
      loadCollection("reference-image-dataset", setIsLoadingReferences, setReferenceLoadError),
    ]).then(([nextSources, nextOutputs, nextReferences]) => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setSourceItems(nextSources);
      setOutputItems(nextOutputs);
      setReferenceItems(nextReferences);

      const nextSource = resolveSelectedItem(nextSources, activeSourceId ?? selectedRecordId);
      const nextOutput = resolveSelectedItem(nextOutputs, activeResultId);
      const nextReference = resolveSelectedItem(nextReferences, activeReferenceId);

      if (nextSource) {
        setActiveSourceId(nextSource.image.recordId);
      }
      if (nextOutput) {
        setActiveResultId(nextOutput.image.recordId);
      }
      if (nextReference) {
        setActiveReferenceId(nextReference.image.recordId);
      }
    });
  };

  useEffect(() => {
    void loadCollections();
  }, [draft?.draftId]);

  if (!isTemplateDraft || !draft) {
    return (
      <section className="ui-image-surface ui-image-surface--status">
        This editor appears when the image manipulation template is open.
      </section>
    );
  }

  return (
    <section className="ui-image-editor-page ui-stack ui-stack--sm">
      <div className="ui-image-editor-page__layout">
        <aside className="ui-image-editor-page__left-column ui-stack ui-stack--sm">
          <ImageUploadPanel
            title="Choose a photo"
            acceptedMimeTypes={["image/png", "image/jpeg", "image/webp"]}
            maxUploadCount={1}
            ingestionAdapter={uploadAdapter}
            targetContext={{
              system: { systemAssetId: draft.assetId },
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
              setStatusMessage(undefined);
              setIsUploading(true);
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
                    setStatusMessage(response.error?.message ?? "Could not upload this photo.");
                    return;
                  }
                  setSelectedRecordId(response.data.recordId);
                  setSelectedAssetId(response.data.image.assetId);
                  setDatasetInstanceId(response.data.datasetInstanceId);
                  setActiveSourceId(response.data.recordId);
                  setActiveSelectionContext("source");
                  setStatusMessage("Photo ready.");
                })
                .then(() => loadCollections())
                .finally(() => setIsUploading(false));
            }}
          />
          <ComfyImageManipulationPropertyEditor
            value={config}
            presetId={presetId}
            issues={validationIssues}
            disabled={context.isBusy || isRunning}
            onChange={(next) => {
              try {
                setConfig(resolveComfyImageManipulationConfig(next, { presetId }));
              } catch {
                setConfig(next);
              }
            }}
            onPresetIdChange={(nextPresetId) => {
              setPresetId(nextPresetId);
              setConfig(createComfyImageManipulationDefaultConfig({ presetId: nextPresetId }));
            }}
          />
          <section className="ui-image-surface ui-stack ui-stack--sm">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Create image</h3>
            </header>
            <button
              type="button"
              className="ui-button ui-button--primary"
              disabled={
                !context.operations.startSystemExecution
                || !selectedRecordId
                || !selectedAssetId
                || !datasetInstanceId
                || !config.prompts.positivePrompt.trim()
                || validationIssues.length > 0
                || isRunning
              }
              onClick={() => {
                if (!context.operations.startSystemExecution || !selectedRecordId || !selectedAssetId || !datasetInstanceId) {
                  return;
                }
                setIsRunning(true);
                setIntegrityIssues([]);
                const runtimeContext = createSystemContextContract({
                  selectedImages: [Object.freeze({
                    selectionId: selectedRecordId,
                    imageId: selectedRecordId,
                    assetRef: Object.freeze({
                      assetId: selectedAssetId,
                      recordId: selectedRecordId,
                    }),
                  })],
                  parameters: Object.freeze({
                    editInstruction: config.prompts.positivePrompt,
                    variationStrength: config.generation.variationStrength,
                    resultCount: config.output.resultCount,
                    imageConfig: config,
                    presetId,
                  }),
                  datasets: [Object.freeze({
                    referenceId: "active-input",
                    instanceId: datasetInstanceId,
                    datasetAssetId: "asset:dataset:image-reference-input",
                    role: "active-input",
                    systemAssetId: draft.assetId,
                  }), Object.freeze({
                    referenceId: "system-output",
                    instanceId: "dataset-instance:reference-image:output",
                    datasetAssetId: "asset:dataset:image-reference-output",
                    role: "system-owned-output",
                    systemAssetId: draft.assetId,
                  })],
                  runtime: Object.freeze({
                    runtimeSessionId: context.snapshot?.activeSessionId,
                    systemAssetId: draft.assetId,
                    workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
                    sourceStudio: "system-studio",
                  }),
                });
                const request = buildReferenceImageStartRequest({
                  studioId: context.studioId,
                  draftId: draft.draftId,
                  systemAssetId: draft.assetId,
                  runtimeContext,
                });
                const integrity = validateReferenceImageCrossStudioContext(runtimeContext);
                if (!integrity.valid) {
                  setStatusMessage("Please check your image and settings.");
                  setIntegrityIssues(integrity.blockingIssues);
                  setIsRunning(false);
                  return;
                }
                void executionFlow.run({
                  startExecution: async () => {
                    const response = await context.operations.startSystemExecution?.(request);
                    return response && response.ok && response.data
                      ? { ok: true, executionId: response.data.executionId }
                      : { ok: false, errorMessage: response?.error?.message ?? "Could not start processing." };
                  },
                  getExecutionResult: async (executionId) => {
                    const response = await studioShell.getSystemExecutionResult(executionId);
                    return response.ok
                      ? { ok: true, data: response.data }
                      : { ok: false, errorMessage: response.error?.message ?? "Could not read runtime output." };
                  },
                  persistOutputs: async (persistRequest) => {
                    const response = await studioShell.persistReferenceImageOutputs(persistRequest);
                    return response.ok
                      ? { ok: true, data: response.data }
                      : { ok: false, errorMessage: response.error?.message };
                  },
                  persistenceRequestFactory: ({ executionId, runtimeResult }) => createReferenceImageOutputPersistenceRequest({
                    studioId: context.studioId,
                    draftId: draft.draftId,
                    executionId,
                    sourceRecordId: selectedRecordId,
                    sourceAssetId: selectedAssetId,
                    parameterSnapshot: Object.freeze({ presetId, imageConfig: config }),
                    runtimeContext,
                    workflowAssetId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
                    workflowAssetVersionId: ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
                    systemAssetId: draft.assetId,
                    runtimeResult,
                  }),
                  refreshViews: async () => {
                    await loadCollections();
                    setActiveSelectionContext("output");
                  },
                  onSnapshot: (snapshot) => {
                    setFlowSteps(snapshot.steps);
                    setFlowIssues(snapshot.issues);
                    setStatusMessage(
                      snapshot.overallStatus === "completed"
                        ? "Done. Your result is ready."
                        : snapshot.overallStatus === "failed"
                          ? "Run failed. Check advanced details."
                          : snapshot.steps[snapshot.steps.length - 1]?.userLabel,
                    );
                  },
                }).finally(() => setIsRunning(false));
              }}
            >
              {isRunning ? "Creating..." : "Create image"}
            </button>
            {statusMessage ? <p className="ui-text-small ui-text-secondary">{statusMessage}</p> : null}
            <details>
              <summary className="ui-text-small ui-text-secondary">Advanced details</summary>
              {flowSteps.map((step) => (
                <p key={step.stepId} className="ui-text-small ui-text-secondary">
                  {step.userLabel}: {step.status}
                </p>
              ))}
              {(integrityIssues.length > 0 || flowIssues.length > 0) ? (
                <ul className="ui-text-small ui-text-secondary">
                  {integrityIssues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>{issue.technicalMessage}</li>
                  ))}
                  {flowIssues.map((issue, index) => (
                    <li key={`${issue.stepId}-${issue.code}-${index}`}>{issue.technicalMessage ?? issue.userMessage}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          </section>
        </aside>
        <div className="ui-image-editor-page__right-column ui-stack ui-stack--sm">
          <ImagePreviewPanel
            className="ui-image-editor-page__preview-panel"
            title="Image preview"
            subtitle={previewContextLabels[activeSelectionContext]}
            image={selectedPreviewViewModel}
            loading={previewLoading}
            errorMessage={previewErrorMessage}
            emptyMessage="Select a source, result, or face reference image to preview it here."
            unavailableMessage="This image is currently unavailable."
          />
          <section className="ui-image-surface ui-image-editor-page__gallery-panel">
            <header className="ui-image-surface__header ui-image-editor-page__gallery-header">
              <h3 className="ui-image-surface__title">Image browser</h3>
            </header>
            <div className="ui-image-editor-page__gallery-contexts" role="tablist" aria-label="Image collections">
              <button
                type="button"
                role="tab"
                aria-selected={activeSelectionContext === "output"}
                className={`ui-button ui-button--sm ${activeSelectionContext === "output" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setActiveSelectionContext("output")}
              >
                Results ({outputItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSelectionContext === "source"}
                className={`ui-button ui-button--sm ${activeSelectionContext === "source" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setActiveSelectionContext("source")}
              >
                Source ({sourceItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSelectionContext === "reference"}
                className={`ui-button ui-button--sm ${activeSelectionContext === "reference" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setActiveSelectionContext("reference")}
              >
                Face reference ({referenceItems.length})
              </button>
            </div>
            <ImageGallerySlider
              className="ui-image-editor-page__gallery-slider-panel"
              title={activeGallery.title}
              subtitle={activeGallery.subtitle}
              items={activeGallery.items}
              selectedImageId={activeGallery.selectedId}
              loading={activeGallery.loading}
              errorMessage={activeGallery.errorMessage}
              emptyMessage={activeGallery.emptyMessage}
              onImageSelected={(imageId) => {
                if (activeSelectionContext === "source") {
                  setActiveSourceId(imageId);
                  return;
                }
                if (activeSelectionContext === "reference") {
                  setActiveReferenceId(imageId);
                  return;
                }
                setActiveResultId(imageId);
              }}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

export default ImageManipulationRuntimeEditorPanel;
