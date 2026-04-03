import type {
  ImageComparisonItem,
  ImageComparisonMode,
  ImageComparisonViewPropsContract,
  ImageDatasetContextRef,
  ImageOutputGalleryPropsContract,
  ImageParameterDefinition,
  ImageParameterFormPropsContract,
  ImageSelectionState,
  ImageSystemContextRef,
  ImageUiContextRef,
  ImageUiViewModel,
  ImageUploadPanelPropsContract,
  ImageViewerPropsContract,
} from "./ImageUiContracts";

export interface ImageInterfaceInteractionState {
  readonly comparisonMode: ImageComparisonMode;
  readonly comparisonFocusedImageId?: string;
  readonly loadingByComponent: Readonly<Record<string, boolean>>;
  readonly errorByComponent: Readonly<Record<string, string | undefined>>;
}

export interface ImageInterfaceState {
  readonly selectedImageId?: string;
  readonly focusedImageId?: string;
  readonly imageCollection: ReadonlyArray<ImageUiViewModel>;
  readonly parameterValues: Readonly<Record<string, unknown>>;
  readonly datasetRef?: ImageDatasetContextRef;
  readonly systemRef?: ImageSystemContextRef;
  readonly interaction: ImageInterfaceInteractionState;
}

export type ImageInterfaceStateAction =
  | { readonly type: "set-image-collection"; readonly images: ReadonlyArray<ImageUiViewModel> }
  | { readonly type: "select-image"; readonly imageId?: string }
  | { readonly type: "focus-image"; readonly imageId?: string }
  | { readonly type: "set-parameter-values"; readonly values: Readonly<Record<string, unknown>> }
  | { readonly type: "set-context"; readonly datasetRef?: ImageDatasetContextRef; readonly systemRef?: ImageSystemContextRef }
  | { readonly type: "set-comparison-mode"; readonly mode: ImageComparisonMode }
  | { readonly type: "set-component-loading"; readonly componentId: string; readonly loading: boolean }
  | { readonly type: "set-component-error"; readonly componentId: string; readonly message?: string };

export function createInitialImageInterfaceState(input?: Partial<ImageInterfaceState>): ImageInterfaceState {
  return Object.freeze({
    selectedImageId: input?.selectedImageId,
    focusedImageId: input?.focusedImageId,
    imageCollection: Object.freeze(input?.imageCollection ?? []),
    parameterValues: Object.freeze(input?.parameterValues ?? {}),
    datasetRef: input?.datasetRef,
    systemRef: input?.systemRef,
    interaction: Object.freeze({
      comparisonMode: input?.interaction?.comparisonMode ?? "side-by-side",
      comparisonFocusedImageId: input?.interaction?.comparisonFocusedImageId,
      loadingByComponent: Object.freeze(input?.interaction?.loadingByComponent ?? {}),
      errorByComponent: Object.freeze(input?.interaction?.errorByComponent ?? {}),
    }),
  });
}

export function reduceImageInterfaceState(state: ImageInterfaceState, action: ImageInterfaceStateAction): ImageInterfaceState {
  switch (action.type) {
    case "set-image-collection":
      return Object.freeze({ ...state, imageCollection: Object.freeze([...action.images]) });
    case "select-image":
      return Object.freeze({ ...state, selectedImageId: action.imageId });
    case "focus-image":
      return Object.freeze({ ...state, focusedImageId: action.imageId });
    case "set-parameter-values":
      return Object.freeze({ ...state, parameterValues: Object.freeze({ ...action.values }) });
    case "set-context":
      return Object.freeze({ ...state, datasetRef: action.datasetRef, systemRef: action.systemRef });
    case "set-comparison-mode":
      return Object.freeze({ ...state, interaction: Object.freeze({ ...state.interaction, comparisonMode: action.mode }) });
    case "set-component-loading":
      return Object.freeze({
        ...state,
        interaction: Object.freeze({
          ...state.interaction,
          loadingByComponent: Object.freeze({ ...state.interaction.loadingByComponent, [action.componentId]: action.loading }),
        }),
      });
    case "set-component-error":
      return Object.freeze({
        ...state,
        interaction: Object.freeze({
          ...state.interaction,
          errorByComponent: Object.freeze({ ...state.interaction.errorByComponent, [action.componentId]: action.message }),
        }),
      });
    default:
      return state;
  }
}

function buildSelection(state: ImageInterfaceState, mode: ImageSelectionState["mode"]): ImageSelectionState {
  const selectedIds = state.selectedImageId ? Object.freeze([state.selectedImageId]) : Object.freeze([]);
  return Object.freeze({ mode, selectedIds, focusedId: state.focusedImageId ?? state.selectedImageId });
}

export function buildImageUiContextRef(state: ImageInterfaceState): ImageUiContextRef {
  return Object.freeze({
    dataset: state.datasetRef,
    system: state.systemRef,
  });
}

export function mapStateToUploadPanelProps(state: ImageInterfaceState, acceptedMimeTypes: ReadonlyArray<string>): ImageUploadPanelPropsContract {
  return Object.freeze({
    acceptedMimeTypes,
    targetContext: buildImageUiContextRef(state),
  });
}

export function mapStateToViewerProps(state: ImageInterfaceState, image: ImageUiViewModel, renderOptions: ImageViewerPropsContract["renderOptions"]): ImageViewerPropsContract {
  return Object.freeze({
    image,
    renderOptions,
    selection: buildSelection(state, "single"),
  });
}

export function mapStateToParameterFormProps(
  state: ImageInterfaceState,
  parameters: ReadonlyArray<ImageParameterDefinition>,
): ImageParameterFormPropsContract {
  return Object.freeze({
    imageId: state.selectedImageId,
    parameters,
    initialValues: state.parameterValues,
  });
}

export function mapStateToOutputGalleryProps(state: ImageInterfaceState, renderOptions: ImageOutputGalleryPropsContract["renderOptions"]): ImageOutputGalleryPropsContract {
  return Object.freeze({
    items: state.imageCollection,
    selection: buildSelection(state, "multi"),
    renderOptions,
    datasetContext: state.datasetRef,
  });
}

export function mapStateToComparisonProps(state: ImageInterfaceState, renderOptions: ImageComparisonViewPropsContract["renderOptions"]): ImageComparisonViewPropsContract {
  const items: ImageComparisonItem[] = state.imageCollection.slice(0, 2).map((image) => ({ image, label: image.title ?? image.imageId }));
  return Object.freeze({
    items: Object.freeze(items),
    mode: state.interaction.comparisonMode,
    renderOptions,
    activeImageIds: state.selectedImageId ? Object.freeze([state.selectedImageId]) : Object.freeze([]),
    focusedImageId: state.focusedImageId,
  });
}
