import type {
  ImageComponentId,
  ImageUiContextRef,
  ImageUiEvent,
  ImageUiEventPayloadMap,
  ImageUiEventType,
} from "./ImageUiContracts";

export function createImageUiEvent<TType extends ImageUiEventType>(input: {
  readonly type: TType;
  readonly sourceComponent: ImageComponentId;
  readonly payload: ImageUiEventPayloadMap[TType];
  readonly context?: ImageUiContextRef;
}): ImageUiEvent<TType> {
  return Object.freeze({
    type: input.type,
    sourceComponent: input.sourceComponent,
    payload: input.payload,
    context: input.context,
    eventId: `${input.sourceComponent}:${input.type}:${Date.now().toString(36)}`,
    occurredAt: new Date().toISOString(),
  });
}

export function emitImageUiEvent<TType extends ImageUiEventType>(
  emit: ((event: ImageUiEvent<TType>) => void) | undefined,
  input: {
    readonly type: TType;
    readonly sourceComponent: ImageComponentId;
    readonly payload: ImageUiEventPayloadMap[TType];
    readonly context?: ImageUiContextRef;
  },
): void {
  if (!emit) {
    return;
  }
  emit(createImageUiEvent(input));
}
