import type { StudioAssetPreviewModel } from "../../../studio-shell/studio-assets/StudioAssetPreview";
import { StudioAssetPreviewKinds } from "../../../studio-shell/studio-assets/StudioAssetPreview";

export interface StudioAssetPreviewCardProps {
  readonly preview: StudioAssetPreviewModel;
  readonly compact?: boolean;
}

function renderAtomicPreview(preview: StudioAssetPreviewModel): JSX.Element {
  const label = typeof preview.config.label === "string" && preview.config.label.trim()
    ? preview.config.label
    : preview.title;
  const helperText = typeof preview.config.helperText === "string" ? preview.config.helperText.trim() : "";
  const readOnly = preview.config.readOnly === true;
  const required = preview.config.required === true;
  const lowerTitle = preview.title.toLowerCase();

  if (lowerTitle.includes("button")) {
    return <button type="button" className="ui-button ui-button--sm" disabled={readOnly}>{label}</button>;
  }
  if (lowerTitle.includes("toggle")) {
    return (
      <label className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <input type="checkbox" checked={Boolean(preview.config.defaultOn)} readOnly disabled={readOnly} />
        <span>{label}</span>
      </label>
    );
  }
  if (lowerTitle.includes("number")) {
    return (
      <label className="ui-field">
        <span className="ui-field__label">{label}{required ? " *" : ""}</span>
        <input className="ui-input" type="number" placeholder="0" readOnly={readOnly} />
        {helperText ? <span className="ui-text-small ui-text-secondary">{helperText}</span> : null}
      </label>
    );
  }
  if (lowerTitle.includes("viewer")) {
    return <div className="ui-panel ui-text-small ui-text-secondary">Preview content appears here.</div>;
  }

  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}{required ? " *" : ""}</span>
      <input className="ui-input" type="text" placeholder="Enter text" readOnly={readOnly} />
      {helperText ? <span className="ui-text-small ui-text-secondary">{helperText}</span> : null}
    </label>
  );
}

export default function StudioAssetPreviewCard({ preview, compact = false }: StudioAssetPreviewCardProps): JSX.Element {
  if (preview.kind === StudioAssetPreviewKinds.unsupported) {
    return <div className="ui-text-small ui-text-muted">{preview.reason ?? "Preview unavailable."}</div>;
  }

  if (preview.kind === StudioAssetPreviewKinds.summary) {
    return <div className="ui-text-small ui-text-secondary">This asset preview is shown in summary mode.</div>;
  }

  return (
    <div className={`ui-stack ${compact ? "ui-stack--3xs" : "ui-stack--2xs"}`} data-testid="studio-asset-preview-card">
      {renderAtomicPreview(preview)}
    </div>
  );
}
