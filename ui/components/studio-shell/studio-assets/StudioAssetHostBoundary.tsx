import type { StudioHostBoundaryProps } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import { supportsStudioAssetMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import type { StudioEmbeddedEvent, StudioEmbeddedEventEnvelope } from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";
import { StudioEmbeddedIntentKinds } from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";

function toCssLength(value: string | number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "number" ? `${value}px` : value;
}

export function createEmbeddedStudioEventEnvelope(params: {
  readonly event: StudioEmbeddedEvent;
  readonly studioType: string;
  readonly studioId: string;
  readonly hostId: string;
  readonly mode: string;
}): StudioEmbeddedEventEnvelope {
  return Object.freeze({
    event: params.event,
    source: Object.freeze({
      studioType: params.studioType,
      studioId: params.studioId,
      hostId: params.hostId,
      mode: params.mode,
    }),
  });
}

function isStudioEmbeddedEvent(event: unknown): event is StudioEmbeddedEvent {
  return Boolean(event)
    && typeof event === "object"
    && "type" in event
    && (event as { readonly type?: string }).type === "studio.intent";
}

export default function StudioAssetHostBoundary<TInput, TEvent>({
  asset,
  context,
  session,
  onEvent,
  className,
}: StudioHostBoundaryProps<TInput, TEvent>): JSX.Element {
  if (!supportsStudioAssetMode(asset.contract, context.mode)) {
    return (
      <p className="ui-text-muted">
        This editor view is not available here yet.
      </p>
    );
  }

  const hostStyle = {
    minWidth: toCssLength(context.layout?.minWidth),
    minHeight: toCssLength(context.layout?.minHeight),
    maxWidth: toCssLength(context.layout?.maxWidth),
    maxHeight: toCssLength(context.layout?.maxHeight),
    width: toCssLength(context.layout?.width),
    height: toCssLength(context.layout?.height),
  };

  const handleEvent = onEvent
    ? (event: TEvent) => {
      if (isStudioEmbeddedEvent(event)) {
        if (event.intent.kind === StudioEmbeddedIntentKinds.openResource && !context.capabilities.canNavigate) {
          return;
        }
        if (event.intent.kind === StudioEmbeddedIntentKinds.requestFullView && !context.capabilities.canShowShellChrome) {
          return;
        }
      }
      onEvent(event);
    }
    : undefined;

  return (
    <div className={className} style={hostStyle} data-testid="studio-asset-host-boundary">
      {asset.render({
        context,
        session,
        onEvent: handleEvent,
      })}
    </div>
  );
}
