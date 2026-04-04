import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
  resolveComfyImageManipulationConfig,
  validateComfyImageManipulationConfig,
  type ComfyImageManipulationConfig,
} from "../../../application/system-studio/ComfyImageManipulationPropertySchema";
import { ImageManipulationSystemTemplate } from "../../../application/system-studio/ImageManipulationSystemTemplate";
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
import { ImageStatusNotice } from "../assets/image-system/ImageStatusNotice";
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
import {
  createIdleImageManipulationRunLifecycleState,
  mapExecutionFlowSnapshotToRunLifecycleState,
  type ImageManipulationRunLifecycleSnapshot,
} from "./image-manipulation/ImageManipulationRunLifecycleState";
import {
  getSelectionRecordIdForRole,
  setActivePreviewRole,
  setRoleSelection,
  type ImageManipulationSelectionRole,
  type ImageManipulationSelectionState,
} from "./image-manipulation/ImageManipulationSelectionState";
import type { SystemRuntimeWindowLaunchContract } from "../../../application/system-runtime/SystemRuntimeWindowLaunchContract";
import type {
  HydratedRuntimeDatasetBinding,
  SystemRuntimeHydratedState,
} from "../../runtime/SystemRuntimeWindowHydrationService";
import {
  ImageManipulationRuntimeDatasetBindingService,
  type ImageManipulationSelectionSnapshot,
} from "../../runtime/ImageManipulationRuntimeDatasetBindingService";

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

const previewContextLabels: Record<ImageManipulationSelectionRole, string> = Object.freeze({
  source: "Source photo",
  output: "Created image",
  reference: "Face reference photo",
});

const runStateLabels: Record<ImageManipulationRunLifecycleSnapshot["state"], string> = Object.freeze({
  idle: "Ready",
  validating: "Checking settings",
  preparing: "Preparing",
  running: "Creating",
  success: "Finished",
  failure: "Needs attention",
});

const emptyHydratedDatasetBindings: ReadonlyArray<HydratedRuntimeDatasetBinding> = Object.freeze([]);

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

function mapItemsToDisplayViewModels(items: ReadonlyArray<OutputGalleryItem>, context: ImageManipulationSelectionRole): ReadonlyArray<ImageUiViewModel> {
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

function toSelectionRole(value: string | undefined): ImageManipulationSelectionRole | undefined {
  if (value === "source" || value === "output" || value === "reference") {
    return value;
  }
  return undefined;
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
  readonly runtimeLaunch?: SystemRuntimeWindowLaunchContract;
  readonly hydratedRuntime?: SystemRuntimeHydratedState;
}

interface ImageCollections {
  readonly sources: ReadonlyArray<OutputGalleryItem>;
  readonly outputs: ReadonlyArray<OutputGalleryItem>;
  readonly references: ReadonlyArray<OutputGalleryItem>;
}

interface LoadCollectionsOptions {
  readonly preferredSourceRecordId?: string;
  readonly preferredOutputRecordId?: string;
  readonly preferredReferenceRecordId?: string;
  readonly preferLatestOutput?: boolean;
  readonly hydration?: boolean;
}

function getCollectionLoadErrorMessage(datasetBindingId: ReferenceImageDatasetBindingId): string {
  if (datasetBindingId === "input-image-dataset") {
    return "We couldn't load your source photos right now.";
  }
  if (datasetBindingId === "reference-image-dataset") {
    return "We couldn't load your face reference photos right now.";
  }
  return "We couldn't load your created images right now.";
}

function toReferenceImageDatasetBindingId(
  bindingId: string | undefined,
): ReferenceImageDatasetBindingId | undefined {
  return bindingId === "input-image-dataset"
    || bindingId === "output-image-dataset"
    || bindingId === "reference-image-dataset"
    ? bindingId
    : undefined;
}

function resolveRunStatusTone(state: ImageManipulationRunLifecycleSnapshot["state"]): "neutral" | "warning" | "danger" | "success" {
  if (state === "success") {
    return "success";
  }
  if (state === "failure") {
    return "danger";
  }
  if (state === "validating") {
    return "warning";
  }
  return "neutral";
}

function resolveRunStatusMessage(runLifecycle: ImageManipulationRunLifecycleSnapshot, fallbackStatusMessage?: string): string {
  return runLifecycle.message ?? fallbackStatusMessage ?? "Adjust your settings, then create a new image.";
}

function toFriendlyValidationMessage(path: string): string {
  if (path.startsWith("prompts.")) {
    return "Update your instructions to continue.";
  }
  if (path.startsWith("output.")) {
    return "Review your result settings before running.";
  }
  if (path.startsWith("faceId.")) {
    return "Review your face reference settings before running.";
  }
  if (path.startsWith("models.")) {
    return "Review advanced model settings before running.";
  }
  return "Review your settings before running.";
}

export function ImageManipulationRuntimeEditorPanel({
  context,
  runtimeLaunch,
  hydratedRuntime,
}: ImageManipulationRuntimeEditorPanelProps): JSX.Element {
  const initialPresetId = hydratedRuntime?.propertySchema.presetId
    ?? runtimeLaunch?.initialSelection.presetId
    ?? ComfyImageManipulationPropertySchema.defaultPresetId;
  const [presetId, setPresetId] = useState(initialPresetId);
  const [config, setConfig] = useState<ComfyImageManipulationConfig>(() => (
    hydratedRuntime?.propertySchema.defaults
    ?? createComfyImageManipulationDefaultConfig({ presetId: initialPresetId })
  ));
  const draft = context.snapshot?.draft;
  const isImageRuntimeTarget = (hydratedRuntime?.resolvedPage.pageBindingId ?? runtimeLaunch?.launchTarget.pageBindingId)
    === ImageManipulationSystemTemplate.compositionBindings.pageBindingId;
  const studioShell = useMemo(() => new StudioShellService(), []);
  const uploadAdapter = useMemo(() => createBrowserImageUploadIngestionAdapter({ policy: uploadPolicy }), []);
  const executionFlow = useMemo(() => new ReferenceImageExecutionFlowService(), []);
  const datasetBindingService = useMemo(() => new ImageManipulationRuntimeDatasetBindingService(), []);
  const requestIdRef = useRef(0);

  const roleBindings = useMemo(
    () => datasetBindingService.resolveRoleBindings(hydratedRuntime?.datasetBindings ?? emptyHydratedDatasetBindings),
    [datasetBindingService, hydratedRuntime?.datasetBindings],
  );
  const hydratedSelection = useMemo(() => {
    if (hydratedRuntime) {
      return hydratedRuntime.initialSelection;
    }
    return Object.freeze({
      selectedDatasetBindingId: runtimeLaunch?.initialSelection.selectedDatasetBindingId ?? roleBindings.outputBindingId,
      activePreviewRole: toSelectionRole(runtimeLaunch?.initialSelection.activePreviewRole) ?? "output",
      selectedRecordIds: Object.freeze({ ...(runtimeLaunch?.initialSelection.selectedRecordIds ?? {}) }),
      gallerySelectionRecordIds: Object.freeze([]),
    });
  }, [hydratedRuntime, runtimeLaunch?.initialSelection.activePreviewRole, runtimeLaunch?.initialSelection.selectedDatasetBindingId, runtimeLaunch?.initialSelection.selectedRecordIds, roleBindings.outputBindingId]);
  const [selection, setSelection] = useState<ImageManipulationSelectionState>(() => (
    datasetBindingService.createSelectionStateFromHydration({
      roleBindings,
      hydratedSelection,
    })
  ));
  const [selectionSnapshot, setSelectionSnapshot] = useState<ImageManipulationSelectionSnapshot>(() => (
    datasetBindingService.createEmptySelectionSnapshot(roleBindings)
  ));
  const [datasetInstanceId, setDatasetInstanceId] = useState<string | undefined>();

  const [outputItems, setOutputItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [sourceItems, setSourceItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);
  const [referenceItems, setReferenceItems] = useState<ReadonlyArray<OutputGalleryItem>>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [outputLoadError, setOutputLoadError] = useState<string | undefined>();
  const [sourceLoadError, setSourceLoadError] = useState<string | undefined>();
  const [referenceLoadError, setReferenceLoadError] = useState<string | undefined>();
  const [isHydrating, setIsHydrating] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [runLifecycle, setRunLifecycle] = useState<ImageManipulationRunLifecycleSnapshot>(() => createIdleImageManipulationRunLifecycleState());
  const [integrityIssues, setIntegrityIssues] = useState<ReadonlyArray<CrossStudioIntegrityIssue>>([]);
  const [flowSteps, setFlowSteps] = useState<ReadonlyArray<ReferenceImageExecutionFlowStep>>([]);
  const [flowIssues, setFlowIssues] = useState<ReadonlyArray<ReferenceImageExecutionFlowIssue>>([]);

  useEffect(() => {
    setSelection(datasetBindingService.createSelectionStateFromHydration({
      roleBindings,
      hydratedSelection,
    }));
    setSelectionSnapshot(datasetBindingService.createEmptySelectionSnapshot(roleBindings));
  }, [datasetBindingService, hydratedSelection, roleBindings]);

  const validationIssues = useMemo(() => validateComfyImageManipulationConfig(config), [config]);
  const validationSummaryMessage = useMemo(() => {
    if (validationIssues.length < 1) {
      return "Your settings are ready. You can create an image.";
    }
    return toFriendlyValidationMessage(validationIssues[0]?.path ?? "");
  }, [validationIssues]);
  const validationSummaryDetails = useMemo(() => {
    if (validationIssues.length < 1) {
      return Object.freeze([] as string[]);
    }
    const unique = Array.from(new Set(validationIssues.map((issue) => issue.message.trim()).filter((message) => message.length > 0)));
    return Object.freeze(unique.slice(0, 3));
  }, [validationIssues]);

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
    () => resolveSelectedItem(sourceItems, selection.sourceRecordId),
    [sourceItems, selection.sourceRecordId],
  );
  const selectedOutputItem = useMemo(
    () => resolveSelectedItem(outputItems, selection.outputRecordId),
    [outputItems, selection.outputRecordId],
  );
  const selectedReferenceItem = useMemo(
    () => resolveSelectedItem(referenceItems, selection.referenceRecordId),
    [referenceItems, selection.referenceRecordId],
  );

  useEffect(() => {
    if (selectedSourceItem?.dataset.instanceId && selectedSourceItem.dataset.instanceId !== datasetInstanceId) {
      setDatasetInstanceId(selectedSourceItem.dataset.instanceId);
    }
  }, [selectedSourceItem?.dataset.instanceId, datasetInstanceId]);

  const selectedSourceRecordId = selectedSourceItem?.image.recordId;
  const selectedSourceAssetId = selectedSourceItem?.image.imageReference
    ?? selectedSourceItem?.image.thumbnailReference
    ?? selectedSourceItem?.image.recordId;
  const selectedSourceDatasetInstanceId = selectedSourceItem?.dataset.instanceId ?? datasetInstanceId;
  const datasetBindingsById = useMemo(
    () => new Map((hydratedRuntime?.datasetBindings ?? []).map((entry) => [entry.bindingId, entry] as const)),
    [hydratedRuntime?.datasetBindings],
  );
  const sourceDatasetBinding = datasetBindingsById.get(roleBindings.sourceBindingId);
  const outputDatasetBinding = datasetBindingsById.get(roleBindings.outputBindingId);
  const referenceDatasetBinding = roleBindings.referenceBindingId
    ? datasetBindingsById.get(roleBindings.referenceBindingId)
    : undefined;
  const runtimeSystemAssetId = hydratedRuntime?.resolvedSystemAsset.assetId ?? draft?.assetId;
  const runtimeWorkflowAssetId = hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateAssetId
    ?? ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId;
  const runtimeWorkflowAssetVersionId = hydratedRuntime?.resolvedWorkflowTemplate.workflowTemplateVersionId
    ?? ReferenceImageSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId;

  const selectedPreviewViewModel = useMemo(() => {
    if (selection.activePreviewRole === "source") {
      return selectedSourceItem ? mapItemsToDisplayViewModels([selectedSourceItem], "source")[0] : undefined;
    }
    if (selection.activePreviewRole === "reference") {
      return selectedReferenceItem ? mapItemsToDisplayViewModels([selectedReferenceItem], "reference")[0] : undefined;
    }
    return selectedOutputItem ? mapItemsToDisplayViewModels([selectedOutputItem], "output")[0] : undefined;
  }, [selection.activePreviewRole, selectedSourceItem, selectedReferenceItem, selectedOutputItem]);

  const previewLoading = selection.activePreviewRole === "source"
    ? isLoadingSources
    : selection.activePreviewRole === "reference"
      ? isLoadingReferences
      : isLoadingOutputs;

  const previewErrorMessage = selection.activePreviewRole === "source"
    ? sourceLoadError
    : selection.activePreviewRole === "reference"
      ? referenceLoadError
      : outputLoadError;
  const hasCollectionLoadError = Boolean(sourceLoadError || outputLoadError || referenceLoadError);
  const runStatusMessage = resolveRunStatusMessage(runLifecycle, statusMessage);

  const activeGallery = useMemo(() => {
    if (selection.activePreviewRole === "source") {
      return {
        title: "Source photos",
        subtitle: "Images you've uploaded for editing",
        items: sourceViewModels,
        selectedId: getSelectionRecordIdForRole(selection, "source") ?? selectedSourceItem?.image.recordId,
        loading: isLoadingSources,
        errorMessage: sourceLoadError,
        emptyMessage: "Upload a photo to get started.",
      } as const;
    }
    if (selection.activePreviewRole === "reference") {
      return {
        title: "Face reference photos",
        subtitle: "Optional reference images for identity guidance",
        items: referenceViewModels,
        selectedId: getSelectionRecordIdForRole(selection, "reference") ?? selectedReferenceItem?.image.recordId,
        loading: isLoadingReferences,
        errorMessage: referenceLoadError,
        emptyMessage: "No face reference photos are available yet.",
      } as const;
    }
    return {
      title: "Created images",
      subtitle: "Recent results from this editor",
      items: outputViewModels,
      selectedId: getSelectionRecordIdForRole(selection, "output") ?? selectedOutputItem?.image.recordId,
      loading: isLoadingOutputs,
      errorMessage: outputLoadError,
      emptyMessage: "Create an image to see results here.",
    } as const;
  }, [
    selection,
    sourceViewModels,
    outputViewModels,
    referenceViewModels,
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
    datasetBindingId: ReferenceImageDatasetBindingId | undefined,
    setLoading: (value: boolean) => void,
    setError: (value: string | undefined) => void,
  ): Promise<ReadonlyArray<OutputGalleryItem>> => {
    if (!datasetBindingId || !draft?.draftId) {
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
        setError(getCollectionLoadErrorMessage(datasetBindingId));
        return Object.freeze([]);
      }
      return response.data.items;
    }).finally(() => setLoading(false));
  };

  const loadCollections = (options: LoadCollectionsOptions = {}): Promise<ImageCollections> => {
    if (!draft?.draftId) {
      setSourceItems(Object.freeze([]));
      setOutputItems(Object.freeze([]));
      setReferenceItems(Object.freeze([]));
      setSelection(datasetBindingService.createSelectionStateFromHydration({
        roleBindings,
        hydratedSelection,
      }));
      setSelectionSnapshot(datasetBindingService.createEmptySelectionSnapshot(roleBindings));
      setIsHydrating(false);
      return Promise.resolve(Object.freeze({
        sources: Object.freeze([]),
        outputs: Object.freeze([]),
        references: Object.freeze([]),
      }));
    }
    if (options.hydration) {
      setIsHydrating(true);
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    return Promise.all([
      loadCollection(toReferenceImageDatasetBindingId(roleBindings.sourceBindingId), setIsLoadingSources, setSourceLoadError),
      loadCollection(toReferenceImageDatasetBindingId(roleBindings.outputBindingId), setIsLoadingOutputs, setOutputLoadError),
      loadCollection(toReferenceImageDatasetBindingId(roleBindings.referenceBindingId), setIsLoadingReferences, setReferenceLoadError),
    ]).then(([nextSources, nextOutputs, nextReferences]) => {
      if (requestId !== requestIdRef.current) {
        return Object.freeze({
          sources: nextSources,
          outputs: nextOutputs,
          references: nextReferences,
        });
      }

      setSourceItems(nextSources);
      setOutputItems(nextOutputs);
      setReferenceItems(nextReferences);

      setSelection((current) => {
        const reconciled = datasetBindingService.reconcileSelection({
          current,
          roleBindings,
          hydratedSelection: Object.freeze({
            ...hydratedSelection,
            selectedRecordIds: Object.freeze({
              ...hydratedSelection.selectedRecordIds,
              ...(options.preferredSourceRecordId ? { [roleBindings.sourceBindingId]: options.preferredSourceRecordId } : {}),
              ...(options.preferredOutputRecordId ? { [roleBindings.outputBindingId]: options.preferredOutputRecordId } : {}),
              ...(options.preferredReferenceRecordId && roleBindings.referenceBindingId
                ? { [roleBindings.referenceBindingId]: options.preferredReferenceRecordId }
                : {}),
            }),
          }),
          collections: {
            sourceItems: nextSources,
            outputItems: nextOutputs,
            referenceItems: nextReferences,
          },
          preferLatestOutput: options.preferLatestOutput,
        });
        const withPreviewRole = reconciled.selection;
        setSelectionSnapshot(reconciled.serializedSelection);

        const nextSource = resolveSelectedItem(nextSources, withPreviewRole.sourceRecordId);
        if (nextSource?.dataset.instanceId) {
          setDatasetInstanceId(nextSource.dataset.instanceId);
        }

        return withPreviewRole;
      });

      return Object.freeze({
        sources: nextSources,
        outputs: nextOutputs,
        references: nextReferences,
      });
    }).finally(() => {
      if (options.hydration) {
        setIsHydrating(false);
      }
    });
  };

  useEffect(() => {
    void loadCollections({ hydration: true });
  }, [draft?.draftId, roleBindings.sourceBindingId, roleBindings.outputBindingId, roleBindings.referenceBindingId]);

  useEffect(() => {
    if (!draft?.draftId) {
      setSelectionSnapshot(datasetBindingService.createEmptySelectionSnapshot(roleBindings));
      return;
    }
    const reconciled = datasetBindingService.reconcileSelection({
      current: selection,
      roleBindings,
      hydratedSelection,
      collections: {
        sourceItems,
        outputItems,
        referenceItems,
      },
    });
    setSelectionSnapshot(reconciled.serializedSelection);
  }, [datasetBindingService, draft?.draftId, hydratedSelection, outputItems, referenceItems, roleBindings, selection, sourceItems]);

  if (!isImageRuntimeTarget || !draft) {
    return (
      <ImageStatusNotice
        title="Image editor unavailable"
        message="This runtime page is unavailable for the current launch context."
      />
    );
  }

  const isRunInProgress = runLifecycle.state === "validating"
    || runLifecycle.state === "preparing"
    || runLifecycle.state === "running";
  const runDisabled = !context.operations.startSystemExecution
    || !selectedSourceRecordId
    || !selectedSourceAssetId
    || !selectedSourceDatasetInstanceId
    || !config.prompts.positivePrompt.trim()
    || validationIssues.length > 0
    || isRunInProgress;

  return (
    <section className="ui-image-editor-page ui-stack ui-stack--sm">
      {isHydrating ? (
        <ImageStatusNotice
          title="Loading editor"
          message="Getting your photos and settings ready."
        />
      ) : null}
      {hasCollectionLoadError ? (
        <ImageStatusNotice
          title="Some images are unavailable"
          message="You can keep editing settings and try loading images again from the browser tabs."
          tone="warning"
        />
      ) : null}
      <div className="ui-image-editor-page__layout">
        <aside className="ui-image-editor-page__left-column ui-stack ui-stack--sm">
          <ImageUploadPanel
            title="Choose a photo"
            acceptedMimeTypes={["image/png", "image/jpeg", "image/webp"]}
            maxUploadCount={1}
            ingestionAdapter={uploadAdapter}
            targetContext={{
              system: { systemAssetId: draft.assetId },
              dataset: selectedSourceDatasetInstanceId
                ? {
                  datasetAssetId: sourceDatasetBinding?.datasetAssetId
                    ?? "asset:dataset:image-reference-input",
                  datasetVersionId: sourceDatasetBinding?.datasetAssetVersionId
                    ?? "v1",
                  systemDatasetInstanceId: selectedSourceDatasetInstanceId,
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
                    setStatusMessage("We couldn't upload this photo.");
                    return undefined;
                  }
                  setDatasetInstanceId(response.data.datasetInstanceId);
                  setSelection((current) => setRoleSelection(current, {
                    role: "source",
                    recordId: response.data.recordId,
                    syncPreviewRole: true,
                  }));
                  setStatusMessage("Photo ready.");
                  return response.data.recordId;
                })
                .then((preferredSourceRecordId) => loadCollections({ preferredSourceRecordId }))
                .finally(() => setIsUploading(false));
            }}
          />
          <ComfyImageManipulationPropertyEditor
            value={config}
            presetId={presetId}
            issues={validationIssues}
            disabled={context.isBusy || isRunInProgress}
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
          {validationIssues.length > 0 ? (
            <section className="ui-stack ui-stack--2xs">
              <ImageStatusNotice
                title="Update settings to continue"
                message={validationSummaryMessage}
                tone="warning"
              />
              <ul className="ui-text-small ui-text-secondary">
                {validationSummaryDetails.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </section>
          ) : (
            <ImageStatusNotice
              title="Settings ready"
              message={validationSummaryMessage}
              tone="success"
            />
          )}
          <section className="ui-image-surface ui-stack ui-stack--xs">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Selected photos</h3>
            </header>
            {isLoadingSources ? (
              <ImageStatusNotice
                title="Loading source photos"
                message="Your uploaded photos will appear here."
              />
            ) : null}
            {!isLoadingSources && sourceItems.length < 1 ? (
              <ImageStatusNotice
                title="No source photo yet"
                message="Choose a photo to start creating edits."
              />
            ) : null}
            {sourceLoadError ? (
              <ImageStatusNotice
                title="Source photos unavailable"
                message={sourceLoadError}
                tone="danger"
              />
            ) : null}
            <label className="ui-form-field">
              <span className="ui-form-field__label">Source photo</span>
              <select
                className="ui-input"
                value={selection.sourceRecordId ?? ""}
                disabled={sourceItems.length < 1 || isLoadingSources}
                onChange={(event) => {
                  const next = event.currentTarget.value || undefined;
                  setSelection((current) => setRoleSelection(current, {
                    role: "source",
                    recordId: next,
                    syncPreviewRole: true,
                  }));
                }}
              >
                {sourceItems.length < 1 ? <option value="">No source photo yet</option> : null}
                {sourceItems.map((item, index) => (
                  <option key={item.image.recordId} value={item.image.recordId}>
                    Source {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-form-field">
              <span className="ui-form-field__label">Face reference photo</span>
              <select
                className="ui-input"
                value={selection.referenceRecordId ?? ""}
                disabled={referenceItems.length < 1 || isLoadingReferences}
                onChange={(event) => {
                  const nextReferenceRecordId = event.currentTarget.value || undefined;
                  setSelection((current) => setRoleSelection(current, {
                    role: "reference",
                    recordId: nextReferenceRecordId,
                    syncPreviewRole: true,
                  }));
                }}
              >
                <option value="">None</option>
                {referenceItems.map((item, index) => (
                  <option key={item.image.recordId} value={item.image.recordId}>
                    Reference {index + 1}
                  </option>
                ))}
              </select>
            </label>
            {referenceLoadError ? (
              <ImageStatusNotice
                title="Face reference photos unavailable"
                message={referenceLoadError}
                tone="danger"
              />
            ) : null}
            <p className="ui-text-small ui-text-secondary">
              These selections stay linked to system-managed image collections.
            </p>
          </section>
          <section className="ui-image-surface ui-stack ui-stack--sm">
            <header className="ui-image-surface__header">
              <h3 className="ui-image-surface__title">Create image</h3>
            </header>
            <button
              type="button"
              className="ui-button ui-button--primary"
              disabled={runDisabled}
              onClick={() => {
                if (!context.operations.startSystemExecution || !selectedSourceRecordId || !selectedSourceAssetId || !selectedSourceDatasetInstanceId) {
                  return;
                }
                setRunLifecycle(Object.freeze({ state: "validating", message: "Checking your setup" }));
                setIntegrityIssues([]);
                setFlowSteps([]);
                setFlowIssues([]);

                const selectedImages = [Object.freeze({
                  selectionId: selectedSourceRecordId,
                  imageId: selectedSourceRecordId,
                  assetRef: Object.freeze({
                    assetId: selectedSourceAssetId,
                    recordId: selectedSourceRecordId,
                  }),
                  metadata: Object.freeze({ role: "source" }),
                })];
                if (selectedReferenceItem) {
                  selectedImages.push(Object.freeze({
                    selectionId: selectedReferenceItem.image.recordId,
                    imageId: selectedReferenceItem.image.recordId,
                    assetRef: Object.freeze({
                      assetId: selectedReferenceItem.image.imageReference
                        ?? selectedReferenceItem.image.thumbnailReference
                        ?? selectedReferenceItem.image.recordId,
                      recordId: selectedReferenceItem.image.recordId,
                    }),
                    metadata: Object.freeze({ role: "reference" }),
                  }));
                }

                const datasetRefs = [Object.freeze({
                  referenceId: "active-input",
                  instanceId: selectedSourceDatasetInstanceId,
                  datasetAssetId: sourceDatasetBinding?.datasetAssetId
                    ?? selectedSourceItem?.dataset.datasetAssetId
                    ?? "asset:dataset:image-reference-input",
                  role: "active-input",
                  systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                }), Object.freeze({
                  referenceId: "system-output",
                  instanceId: outputDatasetBinding?.datasetInstanceId
                    ?? selectedOutputItem?.dataset.instanceId
                    ?? "dataset-instance:reference-image:output",
                  datasetAssetId: outputDatasetBinding?.datasetAssetId
                    ?? selectedOutputItem?.dataset.datasetAssetId
                    ?? "asset:dataset:image-reference-output",
                  role: "system-owned-output",
                  systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                })];
                if (selectedReferenceItem) {
                  datasetRefs.push(Object.freeze({
                    referenceId: "face-reference",
                    instanceId: selectedReferenceItem.dataset.instanceId,
                    datasetAssetId: referenceDatasetBinding?.datasetAssetId
                      ?? selectedReferenceItem.dataset.datasetAssetId,
                    role: "reference-input",
                    systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                  }));
                }

                const runtimeContext = createSystemContextContract({
                  selectedImages,
                  parameters: Object.freeze({
                    editInstruction: config.prompts.positivePrompt,
                    variationStrength: config.generation.variationStrength,
                    resultCount: config.output.resultCount,
                    imageConfig: config,
                    presetId,
                    selectedReferenceRecordId: selectedReferenceItem?.image.recordId,
                  }),
                  datasets: datasetRefs,
                  runtime: Object.freeze({
                    runtimeSessionId: context.snapshot?.activeSessionId,
                    systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                    workflowAssetId: runtimeWorkflowAssetId,
                    sourceStudio: "system-studio",
                  }),
                });
                const request = buildReferenceImageStartRequest({
                  studioId: context.studioId,
                  draftId: draft.draftId,
                  systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                  runtimeContext,
                });
                const integrity = validateReferenceImageCrossStudioContext(runtimeContext);
                if (!integrity.valid) {
                  setRunLifecycle(Object.freeze({
                    state: "failure",
                    message: "Please check your image and settings.",
                  }));
                  setIntegrityIssues(integrity.blockingIssues);
                  return;
                }

                setRunLifecycle(Object.freeze({ state: "preparing", message: "Preparing" }));

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
                    sourceRecordId: selectedSourceRecordId,
                    sourceAssetId: selectedSourceAssetId,
                    parameterSnapshot: Object.freeze({
                      presetId,
                      imageConfig: config,
                      selectedReferenceRecordId: selectedReferenceItem?.image.recordId,
                      selectionSnapshot,
                    }),
                    runtimeContext,
                    workflowAssetId: runtimeWorkflowAssetId,
                    workflowAssetVersionId: runtimeWorkflowAssetVersionId,
                    systemAssetId: runtimeSystemAssetId ?? draft.assetId,
                    runtimeResult,
                  }),
                  refreshViews: async () => {
                    await loadCollections({ preferLatestOutput: true });
                    setSelection((current) => setActivePreviewRole(current, "output"));
                  },
                  onSnapshot: (snapshot) => {
                    setFlowSteps(snapshot.steps);
                    setFlowIssues(snapshot.issues);
                    setRunLifecycle(mapExecutionFlowSnapshotToRunLifecycleState(snapshot));
                  },
                }).catch(() => {
                  setRunLifecycle(Object.freeze({
                    state: "failure",
                    message: "Run failed. Check advanced details.",
                  }));
                });
              }}
            >
              {isRunInProgress ? "Creating..." : "Create image"}
            </button>
            {!selectedSourceRecordId && !isLoadingSources ? (
              <ImageStatusNotice
                title="Choose a source photo first"
                message="Add or select a source photo before creating an image."
                tone="warning"
              />
            ) : null}
            <ImageStatusNotice
              title={`Status: ${runStateLabels[runLifecycle.state]}`}
              message={runStatusMessage}
              tone={resolveRunStatusTone(runLifecycle.state)}
            />
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
            subtitle={previewContextLabels[selection.activePreviewRole]}
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
                aria-selected={selection.activePreviewRole === "output"}
                className={`ui-button ui-button--sm ${selection.activePreviewRole === "output" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setSelection((current) => setActivePreviewRole(current, "output"))}
              >
                Results ({outputItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selection.activePreviewRole === "source"}
                className={`ui-button ui-button--sm ${selection.activePreviewRole === "source" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setSelection((current) => setActivePreviewRole(current, "source"))}
              >
                Source ({sourceItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selection.activePreviewRole === "reference"}
                className={`ui-button ui-button--sm ${selection.activePreviewRole === "reference" ? "ui-button--primary" : "ui-button--ghost"}`}
                onClick={() => setSelection((current) => setActivePreviewRole(current, "reference"))}
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
                setSelection((current) => setRoleSelection(current, {
                  role: current.activePreviewRole,
                  recordId: imageId,
                  syncPreviewRole: true,
                }));
              }}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

export default ImageManipulationRuntimeEditorPanel;
