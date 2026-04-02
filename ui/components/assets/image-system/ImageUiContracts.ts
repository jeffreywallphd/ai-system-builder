export type ImageComponentId =
  | "upload-panel"
  | "image-viewer"
  | "parameter-form"
  | "output-gallery"
  | "comparison-view"
  | "run-history";

export type ImageRenderFitMode = "contain" | "cover" | "fill" | "scale-down";

export type ImageRenderPlaceholderBehavior = "show-placeholder" | "keep-space" | "hide";

export type ImageRenderZoomCapability = "disabled" | "wheel" | "gesture" | "buttons";

export interface ImageDatasetContextRef {
  readonly datasetAssetId: string;
  readonly datasetVersionId?: string;
  readonly datasetInstanceId?: string;
}

export interface ImageSystemContextRef {
  readonly systemAssetId: string;
  readonly systemVersionId?: string;
  readonly runtimeSessionId?: string;
}

export interface ImageUiContextRef {
  readonly dataset?: ImageDatasetContextRef;
  readonly system?: ImageSystemContextRef;
  readonly workflowAssetId?: string;
  readonly workflowRunId?: string;
}

export type ImageUiEventType =
  | "upload-initiated"
  | "upload-completed"
  | "upload-failed"
  | "image-selected"
  | "image-deselected"
  | "parameter-changed"
  | "parameter-submitted"
  | "parameter-reset"
  | "gallery-item-selected"
  | "gallery-item-opened"
  | "comparison-target-changed"
  | "comparison-mode-changed"
  | "viewer-zoom-requested"
  | "viewer-interaction";

export interface ImageUiEventPayloadMap {
  readonly "upload-initiated": {
    readonly fileCount: number;
    readonly fileNames: ReadonlyArray<string>;
  };
  readonly "upload-completed": {
    readonly acceptedCount: number;
    readonly rejectedCount: number;
    readonly issueCount: number;
    readonly issueCodes: ReadonlyArray<string>;
  };
  readonly "upload-failed": {
    readonly rejectedCount: number;
    readonly issueCount: number;
    readonly issueCodes: ReadonlyArray<string>;
  };
  readonly "image-selected": {
    readonly imageId: string;
    readonly selectionMode: ImageSelectionState["mode"];
  };
  readonly "image-deselected": {
    readonly imageId: string;
    readonly selectionMode: ImageSelectionState["mode"];
  };
  readonly "parameter-changed": {
    readonly imageId?: string;
    readonly parameterId: string;
    readonly value: unknown;
  };
  readonly "parameter-submitted": {
    readonly imageId?: string;
    readonly values: Readonly<Record<string, unknown>>;
    readonly issueCount: number;
  };
  readonly "parameter-reset": {
    readonly imageId?: string;
    readonly values: Readonly<Record<string, unknown>>;
  };
  readonly "gallery-item-selected": {
    readonly imageId: string;
    readonly selected: boolean;
    readonly selectedIds: ReadonlyArray<string>;
  };
  readonly "gallery-item-opened": {
    readonly imageId: string;
  };
  readonly "comparison-target-changed": {
    readonly imageId: string;
    readonly focused: boolean;
    readonly selectedIds: ReadonlyArray<string>;
  };
  readonly "comparison-mode-changed": {
    readonly mode: ImageComparisonMode;
  };
  readonly "viewer-zoom-requested": {
    readonly imageId: string;
    readonly delta: number;
    readonly zoom: number;
  };
  readonly "viewer-interaction": {
    readonly interactionType: "pan" | "swap" | "zoom" | "select";
    readonly imageId?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

export interface ImageUiEvent<TType extends ImageUiEventType = ImageUiEventType> {
  readonly type: TType;
  readonly sourceComponent: ImageComponentId;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly context?: ImageUiContextRef;
  readonly payload: ImageUiEventPayloadMap[TType];
}

export interface ImageUiEventEmitterContract {
  readonly onEvent?: (event: ImageUiEvent) => void;
}

export interface ImageRenderMetadata {
  readonly width?: number;
  readonly height?: number;
  readonly aspectRatio?: number;
  readonly mimeType?: string;
  readonly format?: string;
  readonly altText?: string;
  readonly orientation?: "landscape" | "portrait" | "square" | "unknown";
  readonly dominantColorHex?: string;
}

export interface ImageRenderOptions {
  readonly fitMode: ImageRenderFitMode;
  readonly zoomCapability: ImageRenderZoomCapability;
  readonly placeholderBehavior: ImageRenderPlaceholderBehavior;
  readonly lazyLoad: boolean;
  readonly allowSelectionHighlight: boolean;
}

export interface ImageSelectionState {
  readonly mode: "single" | "multi";
  readonly selectedIds: ReadonlyArray<string>;
  readonly focusedId?: string;
}

export interface ImageSelectionChangeEvent {
  readonly sourceComponent: ImageComponentId;
  readonly selection: ImageSelectionState;
}

export interface ImageUiViewModel {
  readonly imageId: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly sourceUrl?: string;
  readonly thumbnailUrl?: string;
  readonly metadata: ImageRenderMetadata;
  readonly tags: ReadonlyArray<string>;
  readonly context?: ImageUiContextRef;
  readonly previewSummary?: {
    readonly timestamp?: string;
    readonly workflowSummary?: string;
    readonly parameterSummary?: Readonly<Record<string, unknown>>;
    readonly metadataSummary?: Readonly<Record<string, unknown>>;
  };
  readonly isPlaceholder?: boolean;
}

export type ImageCollectionPresentationMode = "grid" | "list";

export interface ImageUploadPanelPropsContract {
  readonly acceptedMimeTypes: ReadonlyArray<string>;
  readonly maxUploadCount?: number;
  readonly targetContext?: ImageUiContextRef;
  readonly ingestionAdapter?: ImageUploadIngestionAdapter;
}

export interface ImageUploadPanelEventContract extends ImageUiEventEmitterContract {
  readonly onUploadRequested?: (payload: {
    readonly files: ReadonlyArray<File>;
    readonly context?: ImageUiContextRef;
  }) => void;
  readonly onValidationChanged?: (payload: {
    readonly sourceComponent: "upload-panel";
    readonly validation: ImageUploadValidationResult;
    readonly context?: ImageUiContextRef;
  }) => void;
}

export interface ImageUploadValidationIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly fileName?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageUploadValidationResult {
  readonly acceptedFiles: ReadonlyArray<File>;
  readonly rejectedFiles: ReadonlyArray<File>;
  readonly issues: ReadonlyArray<ImageUploadValidationIssue>;
}

export interface ImageUploadIngestionAdapter {
  evaluate(input: {
    readonly files: ReadonlyArray<File>;
    readonly acceptedMimeTypes: ReadonlyArray<string>;
    readonly maxUploadCount?: number;
    readonly context?: ImageUiContextRef;
  }): ImageUploadValidationResult;
}

export interface ImageViewerPropsContract {
  readonly image: ImageUiViewModel;
  readonly selection?: ImageSelectionState;
  readonly renderOptions: ImageRenderOptions;
  readonly eventContext?: ImageUiContextRef;
}

export interface ImageViewerEventContract extends ImageUiEventEmitterContract {
  readonly onImageSelected?: (event: ImageSelectionChangeEvent) => void;
  readonly onZoomRequested?: (payload: { readonly imageId: string; readonly delta: number }) => void;
}

export interface ImageParameterDefinition {
  readonly parameterId: string;
  readonly label: string;
  readonly type: "text" | "number" | "boolean" | "select" | "range";
  readonly description?: string;
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly placeholder?: string;
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly defaultValue?: unknown;
}

export interface ImageParameterFormPropsContract {
  readonly imageId?: string;
  readonly parameters: ReadonlyArray<ImageParameterDefinition>;
  readonly initialValues?: Readonly<Record<string, unknown>>;
  readonly eventContext?: ImageUiContextRef;
}

export interface ImageParameterValidationIssue {
  readonly parameterId: string;
  readonly code: "required" | "invalid-type" | "below-min" | "above-max" | "invalid-option";
  readonly message: string;
}

export interface ImageParameterFormEventContract extends ImageUiEventEmitterContract {
  readonly onParametersChanged?: (payload: {
    readonly imageId?: string;
    readonly values: Readonly<Record<string, unknown>>;
    readonly issues: ReadonlyArray<ImageParameterValidationIssue>;
  }) => void;
}

export interface ImageOutputGalleryPropsContract {
  readonly items: ReadonlyArray<ImageUiViewModel>;
  readonly selection?: ImageSelectionState;
  readonly renderOptions: ImageRenderOptions;
  readonly datasetContext?: ImageDatasetContextRef;
  readonly eventContext?: ImageUiContextRef;
  readonly presentationMode?: ImageCollectionPresentationMode;
}

export interface ImageOutputGalleryEventContract extends ImageUiEventEmitterContract {
  readonly onSelectionChanged?: (event: ImageSelectionChangeEvent) => void;
  readonly onItemOpened?: (payload: { readonly imageId: string }) => void;
}


export interface ImageOutputSelectionDetails {
  readonly selectedImageId?: string;
  readonly activeResultImageId?: string;
  readonly reusableInputImageId?: string;
}

export interface ImageOutputSelectionActionEvent {
  readonly sourceComponent: ImageComponentId;
  readonly details: ImageOutputSelectionDetails;
}

export interface ImageRunHistorySelectionEvent {
  readonly sourceComponent: ImageComponentId;
  readonly runId: string;
}

export interface ImageRunHistoryItemViewModel {
  readonly runId: string;
  readonly linkedOutputImageIds: ReadonlyArray<string>;
  readonly status: string;
  readonly timestamp: string;
  readonly workflowSummary: string;
  readonly ioSummary: string;
  readonly parameterSummary?: Readonly<Record<string, unknown>>;
}

export interface ImageRunHistoryListPropsContract {
  readonly runs: ReadonlyArray<ImageRunHistoryItemViewModel>;
  readonly selectedRunId?: string;
}

export interface ImageRunHistoryListEventContract extends ImageUiEventEmitterContract {
  readonly onRunSelected?: (event: ImageRunHistorySelectionEvent) => void;
}

export interface ImageComparisonPair {
  readonly left: ImageUiViewModel;
  readonly right: ImageUiViewModel;
  readonly comparisonLabel?: string;
}

export interface ImageComparisonItem {
  readonly image: ImageUiViewModel;
  readonly label?: string;
}

export type ImageComparisonMode = "side-by-side" | "overlay";

export interface ImageComparisonViewportState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export interface ImageComparisonViewPropsContract {
  readonly items: ReadonlyArray<ImageComparisonItem>;
  readonly mode: ImageComparisonMode;
  readonly renderOptions: ImageRenderOptions;
  readonly activeImageIds?: ReadonlyArray<string>;
  readonly focusedImageId?: string;
  readonly eventContext?: ImageUiContextRef;
}

export interface ImageComparisonViewEventContract extends ImageUiEventEmitterContract {
  readonly onSwapRequested?: () => void;
  readonly onSelectionChanged?: (event: ImageSelectionChangeEvent) => void;
  readonly onModeChanged?: (mode: ImageComparisonMode) => void;
  readonly onViewportChanged?: (viewport: ImageComparisonViewportState) => void;
}

export const DEFAULT_IMAGE_RENDER_OPTIONS: ImageRenderOptions = Object.freeze({
  fitMode: "contain",
  zoomCapability: "disabled",
  placeholderBehavior: "show-placeholder",
  lazyLoad: true,
  allowSelectionHighlight: true,
});
