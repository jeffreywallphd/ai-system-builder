import { useEffect, useMemo, useState } from "react";
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
import { createSystemContextContract } from "../../../domain/system-studio/SystemContextContract";
import type { FileIngestionPolicy } from "../../../domain/ingestion/interfaces/IFileIngestion";
import { createBrowserImageUploadIngestionAdapter } from "../assets/image-system/BrowserImageUploadIngestionAdapter";
import { ImageUploadPanel } from "../assets/image-system/ImageUploadPanel";
import { ImageRenderFrame } from "../assets/image-system/ImageRenderFrame";
import { ImageViewer } from "../assets/image-system/ImageViewer";
import { mapOutputGalleryItemToImageViewModel } from "../assets/image-system/ImageOutputGalleryDataAdapter";
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
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [datasetInstanceId, setDatasetInstanceId] = useState<string | undefined>();
  const [activeResultId, setActiveResultId] = useState<string | undefined>();
  const [items, setItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [integrityIssues, setIntegrityIssues] = useState<ReadonlyArray<CrossStudioIntegrityIssue>>([]);
  const [flowSteps, setFlowSteps] = useState<ReadonlyArray<ReferenceImageExecutionFlowStep>>([]);
  const [flowIssues, setFlowIssues] = useState<ReadonlyArray<ReferenceImageExecutionFlowIssue>>([]);
  const validationIssues = useMemo(() => validateComfyImageManipulationConfig(config), [config]);
  const viewModels = useMemo(() => items.map((item) => mapOutputGalleryItemToImageViewModel(item)), [items]);
  const selectedItem = useMemo(() => items.find((item) => item.image.recordId === activeResultId) ?? items[0], [items, activeResultId]);
  const selectedViewModel = useMemo(
    () => selectedItem ? mapOutputGalleryItemToImageViewModel(selectedItem) : undefined,
    [selectedItem],
  );

  const loadResults = (): Promise<ReadonlyArray<OutputGalleryItem>> => {
    if (!draft?.draftId) {
      return Promise.resolve(Object.freeze([]));
    }
    setIsLoadingResults(true);
    return studioShell.listReferenceImageOutputs({
      studioId: context.studioId,
      draftId: draft.draftId,
      limit: 24,
      offset: 0,
    }).then((response) => {
      if (!response.ok || !response.data) {
        return Object.freeze([]);
      }
      setItems(response.data.items);
      if (!activeResultId && response.data.items[0]) {
        setActiveResultId(response.data.items[0].image.recordId);
      }
      return response.data.items;
    }).finally(() => setIsLoadingResults(false));
  };

  useEffect(() => {
    void loadResults();
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
                  setStatusMessage("Photo ready.");
                })
                .then(() => loadResults())
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
                    await loadResults();
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
          <section className="ui-image-surface ui-image-editor-page__preview-panel">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Preview</h3>
            </header>
            {selectedViewModel ? (
              <ImageViewer
                image={selectedViewModel}
                renderOptions={{
                  fitMode: "contain",
                  zoomCapability: "buttons",
                  placeholderBehavior: "show-placeholder",
                  lazyLoad: false,
                  allowSelectionHighlight: true,
                }}
                selection={{
                  mode: "single",
                  selectedIds: [selectedViewModel.imageId],
                  focusedId: selectedViewModel.imageId,
                }}
                showMetadata
              />
            ) : (
              <p className="ui-text-small ui-text-secondary">Your newest image will appear here.</p>
            )}
          </section>
          <section className="ui-image-surface ui-image-editor-page__gallery-panel">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Results gallery</h3>
            </header>
            {isLoadingResults ? <p className="ui-text-small ui-text-secondary">Loading results...</p> : null}
            {!isLoadingResults && viewModels.length === 0 ? (
              <p className="ui-text-small ui-text-secondary">No results yet. Create an image to populate the gallery.</p>
            ) : null}
            <div className="ui-image-editor-page__gallery-slider">
              {viewModels.map((item) => {
                const selected = (activeResultId ?? viewModels[0]?.imageId) === item.imageId;
                return (
                  <button
                    type="button"
                    key={item.imageId}
                    className={`ui-image-editor-page__gallery-item ${selected ? "ui-image-editor-page__gallery-item--active" : ""}`}
                    onClick={() => setActiveResultId(item.imageId)}
                  >
                    <ImageRenderFrame
                      image={item}
                      selected={selected}
                      className="ui-image-editor-page__gallery-frame"
                      renderOptions={{
                        fitMode: "cover",
                        zoomCapability: "disabled",
                        placeholderBehavior: "show-placeholder",
                        lazyLoad: true,
                        allowSelectionHighlight: true,
                      }}
                    />
                    <span className="ui-text-small ui-text-secondary">{item.imageId}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default ImageManipulationRuntimeEditorPanel;
