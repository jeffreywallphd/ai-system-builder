import type { StudioHostBoundaryProps } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import { supportsStudioAssetMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";

export default function StudioAssetHostBoundary<TInput, TEvent>({
  asset,
  context,
  session,
  onEvent,
}: StudioHostBoundaryProps<TInput, TEvent>): JSX.Element {
  if (!supportsStudioAssetMode(asset.contract, context.mode)) {
    return (
      <p className="ui-text-muted">
        This editor view is not available here yet.
      </p>
    );
  }

  return asset.render({
    context,
    session,
    onEvent,
  });
}
