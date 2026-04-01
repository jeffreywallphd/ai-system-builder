import type { WorkflowOutputAssetViewModel } from "../../presenters/WorkflowOutputPresenter";
import {
  DEFAULT_IMAGE_RENDER_OPTIONS,
  ImageRenderFrame,
  type ImageUiViewModel,
} from "./image-system";

export interface AssetViewerProps {
  readonly asset: WorkflowOutputAssetViewModel;
}

function toImageViewModel(asset: WorkflowOutputAssetViewModel): ImageUiViewModel {
  const [width, height] = (asset.detail.dimensionsLabel ?? "")
    .split("x")
    .map((entry) => Number.parseInt(entry.trim(), 10));

  return {
    imageId: asset.detail.reference,
    title: asset.title,
    sourceUrl: asset.previewUrl,
    metadata: {
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
      format: asset.detail.format,
      altText: asset.title,
    },
    tags: Object.freeze([]),
    isPlaceholder: !asset.previewUrl,
  };
}

export default function AssetViewer({ asset }: AssetViewerProps): JSX.Element {
  const renderPreview = (): JSX.Element => {
    switch (asset.viewerType) {
      case "image":
        return (
          <ImageRenderFrame
            className="ui-asset-viewer__media"
            image={toImageViewModel(asset)}
            renderOptions={DEFAULT_IMAGE_RENDER_OPTIONS}
            fallbackLabel="Image preview unavailable."
          />
        );

      case "video":
        return asset.previewUrl ? (
          <video className="ui-asset-viewer__media" src={asset.previewUrl} controls preload="metadata" />
        ) : (
          <div className="ui-asset-viewer__placeholder">Video preview unavailable.</div>
        );

      case "audio":
        return asset.previewUrl ? (
          <audio className="ui-asset-viewer__audio" src={asset.previewUrl} controls preload="metadata" />
        ) : (
          <div className="ui-asset-viewer__placeholder">Audio preview unavailable.</div>
        );

      case "document":
        if (asset.previewText) {
          return <pre className="ui-asset-viewer__text ui-text-mono">{asset.previewText}</pre>;
        }

        return asset.previewUrl ? (
          <iframe
            className="ui-asset-viewer__frame"
            title={asset.title}
            src={asset.previewUrl}
          />
        ) : (
          <div className="ui-asset-viewer__placeholder">Document preview unavailable.</div>
        );

      case "structured":
      case "text":
        return (
          <pre className="ui-asset-viewer__text ui-text-mono">
            {asset.previewText ?? asset.detail.semanticMetadata?.description ?? asset.detail.reference}
          </pre>
        );

      case "download":
      default:
        return (
          <div className="ui-asset-viewer__placeholder">
            No inline preview is available for this output type.
          </div>
        );
    }
  };

  return (
    <article className="ui-card ui-asset-viewer">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-row ui-row--between ui-row--wrap">
          <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
            <div className="ui-heading-4">{asset.title}</div>
            <div className="ui-text-secondary ui-text-small">
              {asset.detail.kind}
              {asset.detail.format ? ` • ${asset.detail.format.toUpperCase()}` : ""}
              {asset.detail.sourceLabel ? ` • ${asset.detail.sourceLabel}` : ""}
            </div>
          </div>

          <div className="ui-row ui-row--wrap">
            <span className="ui-badge ui-badge--neutral">{asset.viewerType}</span>
            <span className="ui-badge ui-badge--success">{asset.detail.statusLabel}</span>
          </div>
        </div>

        <div className="ui-asset-viewer__surface">{renderPreview()}</div>

        {asset.previewUnavailableReason ? (
          <div className="ui-text-small ui-subtle">{asset.previewUnavailableReason}</div>
        ) : null}

        <div className="ui-row ui-row--wrap ui-text-small ui-text-secondary">
          {asset.detail.dimensionsLabel ? <span>{asset.detail.dimensionsLabel}</span> : null}
          {asset.detail.durationLabel ? <span>{asset.detail.durationLabel}</span> : null}
          {asset.detail.sizeLabel ? <span>{asset.detail.sizeLabel}</span> : null}
          {asset.detail.location.location ? <span>{asset.detail.location.location}</span> : null}
        </div>
      </div>
    </article>
  );
}
