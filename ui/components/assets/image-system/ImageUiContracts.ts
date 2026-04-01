export type ImageComponentId =
  | "upload-panel"
  | "image-viewer"
  | "parameter-form"
  | "output-gallery"
  | "comparison-view";

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
  readonly sourceUrl?: string;
  readonly thumbnailUrl?: string;
  readonly metadata: ImageRenderMetadata;
  readonly tags: ReadonlyArray<string>;
  readonly context?: ImageUiContextRef;
  readonly isPlaceholder?: boolean;
}

export interface ImageUploadPanelPropsContract {
  readonly acceptedMimeTypes: ReadonlyArray<string>;
  readonly maxUploadCount?: number;
  readonly targetContext?: ImageUiContextRef;
  readonly ingestionAdapter?: ImageUploadIngestionAdapter;
}

export interface ImageUploadPanelEventContract {
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
}

export interface ImageViewerEventContract {
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
}

export interface ImageParameterValidationIssue {
  readonly parameterId: string;
  readonly code: "required" | "invalid-type" | "below-min" | "above-max" | "invalid-option";
  readonly message: string;
}

export interface ImageParameterFormEventContract {
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
}

export interface ImageOutputGalleryEventContract {
  readonly onSelectionChanged?: (event: ImageSelectionChangeEvent) => void;
  readonly onItemOpened?: (payload: { readonly imageId: string }) => void;
}

export interface ImageComparisonPair {
  readonly left: ImageUiViewModel;
  readonly right: ImageUiViewModel;
  readonly comparisonLabel?: string;
}

export interface ImageComparisonViewPropsContract {
  readonly pair: ImageComparisonPair;
  readonly renderOptions: ImageRenderOptions;
}

export interface ImageComparisonViewEventContract {
  readonly onSwapRequested?: () => void;
  readonly onSelectionChanged?: (event: ImageSelectionChangeEvent) => void;
}

export const DEFAULT_IMAGE_RENDER_OPTIONS: ImageRenderOptions = Object.freeze({
  fitMode: "contain",
  zoomCapability: "disabled",
  placeholderBehavior: "show-placeholder",
  lazyLoad: true,
  allowSelectionHighlight: true,
});
