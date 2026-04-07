import { useMemo, useState, type JSX } from "react";
import type { DataPreviewModel } from "@application/data-studio/DataPreviewEngine";
import { DEFAULT_IMAGE_RENDER_OPTIONS, ImageRenderFrame, resolveSelectionForImage, type ImageUiViewModel } from "./image-system";

export interface DataPreviewSurfaceProps {
  readonly preview: DataPreviewModel;
  readonly title?: string;
  readonly imageSelectionMode?: "single" | "multi";
  readonly selectedImageSelectionIds?: ReadonlyArray<string>;
  readonly onToggleImageSelection?: (selectionId: string) => void;
}

const THUMBNAIL_RENDER_OPTIONS = Object.freeze({
  ...DEFAULT_IMAGE_RENDER_OPTIONS,
  fitMode: "cover",
  placeholderBehavior: "show-placeholder",
  zoomCapability: "disabled",
});

function toImageViewModel(item: {
  readonly itemId: string;
  readonly imageId?: string;
  readonly imageReference?: string;
  readonly thumbnailSource?: string;
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly tags: ReadonlyArray<string>;
}): ImageUiViewModel {
  return {
    imageId: item.imageId ?? item.itemId,
    title: item.imageReference ?? item.itemId,
    sourceUrl: item.thumbnailSource,
    thumbnailUrl: item.thumbnailSource,
    metadata: {
      width: item.width,
      height: item.height,
      format: item.format,
      altText: item.imageReference ?? item.itemId,
    },
    tags: item.tags,
    isPlaceholder: !item.thumbnailSource,
  };
}

function renderSummary(preview: DataPreviewModel): JSX.Element {
  return (
    <div className="ui-meta-grid">
      <div className="ui-meta-item">
        <div className="ui-meta-label">Rows/items</div>
        <div className="ui-meta-value">{preview.summary.sampleCount} / {preview.summary.totalCount}</div>
      </div>
      <div className="ui-meta-item">
        <div className="ui-meta-label">Schema</div>
        <div className="ui-meta-value">{preview.metadata.schemaVersion}</div>
      </div>
      <div className="ui-meta-item">
        <div className="ui-meta-label">Source</div>
        <div className="ui-meta-value">{preview.metadata.sourceFileName ?? "-"}</div>
      </div>
      <div className="ui-meta-item">
        <div className="ui-meta-label">Diagnostics</div>
        <div className="ui-meta-value">{preview.diagnostics.errorCount} errors</div>
      </div>
    </div>
  );
}

function formatSummaryRecord(value: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "-";
  }
  return entries.map(([key, entry]) => {
    if (entry && typeof entry === "object") {
      return `${key}: ${JSON.stringify(entry)}`;
    }
    return `${key}: ${String(entry)}`;
  }).join(", ");
}

function renderData(preview: DataPreviewModel): JSX.Element {
  if (preview.kind === "records") {
    return (
      <div className="ui-table-wrapper">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Record</th>
              <th>Fields</th>
            </tr>
          </thead>
          <tbody>
            {preview.records.map((record) => (
              <tr key={record.recordId}>
                <td>{record.recordId}</td>
                <td><pre className="ui-text-mono">{JSON.stringify(record.fields, null, 2)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (preview.kind === "table") {
    return (
      <div className="ui-table-wrapper">
        <table className="ui-table">
          <thead>
            <tr>
              {preview.columns.map((column) => (
                <th key={column.columnId}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.rowId}>
                {preview.columns.map((column) => (
                  <td key={`${row.rowId}:${column.columnId}`}>{String(row.cells[column.columnId] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (preview.kind === "text-items") {
    return (
      <div className="ui-stack ui-stack--xs">
        {preview.items.map((item) => (
          <article key={item.itemId} className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between">
                <strong>{item.itemId}</strong>
                {item.startOffset !== undefined && item.endOffset !== undefined ? (
                  <span className="ui-text-small ui-subtle">{item.startOffset}-{item.endOffset}</span>
                ) : null}
              </div>
              <pre className="ui-text-mono">{item.text}</pre>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (preview.kind === "image-metadata-records") {
    return (
      <div className="ui-table-wrapper">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>Image</th>
              <th>Dimensions</th>
              <th>Format</th>
              <th>Metadata</th>
              <th>Tags</th>
              <th>Annotations</th>
              <th>Derived</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => (
              <tr key={item.itemId}>
                <td>
                  <ImageRenderFrame
                    className="ui-image-preview-thumb"
                    image={toImageViewModel(item)}
                    renderOptions={THUMBNAIL_RENDER_OPTIONS}
                    fallbackLabel="No preview"
                  />
                </td>
                <td>
                  <div>{item.imageReference ?? item.imageId ?? item.itemId}</div>
                  {item.issues.length > 0 ? (
                    <div className="ui-text-small ui-subtle">{item.issues.join(" ")}</div>
                  ) : null}
                </td>
                <td>{item.width !== undefined && item.height !== undefined ? `${item.width}x${item.height}` : "-"}</td>
                <td>{item.format ?? "-"}</td>
                <td>{formatSummaryRecord(item.metadataSummary)}</td>
                <td>{item.tags.length > 0 ? item.tags.join(", ") : "-"}</td>
                <td>{formatSummaryRecord(item.annotations)}</td>
                <td>{formatSummaryRecord(item.derived)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--xs">
        <div className="ui-text-danger">{preview.message}</div>
        {preview.diagnostics.diagnostics.length > 0 ? (
          <pre className="ui-text-mono">{JSON.stringify(preview.diagnostics.diagnostics, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
}

function formatImageMetadata(value: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "-";
  }
  return entries
    .slice(0, 3)
    .map(([key, entry]) => `${key}: ${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`)
    .join(" Â· ");
}

function ImageCollectionPreviewSurface({
  preview,
  imageSelectionMode = "single",
  selectedImageSelectionIds,
  onToggleImageSelection,
}: {
  readonly preview: Extract<DataPreviewModel, { kind: "image-metadata-records" }>;
  readonly imageSelectionMode?: "single" | "multi";
  readonly selectedImageSelectionIds?: ReadonlyArray<string>;
  readonly onToggleImageSelection?: (selectionId: string) => void;
}): JSX.Element {
  const [windowOffset, setWindowOffset] = useState(preview.window.offset);
  const [localSelectedIds, setLocalSelectedIds] = useState<ReadonlyArray<string>>(Object.freeze([]));
  const currentOffset = preview.window.offset;
  const items = useMemo(
    () => preview.items,
    [preview.items],
  );
  const selectedIds = selectedImageSelectionIds ?? localSelectedIds;

  const toggleSelection = (selectionId: string) => {
    if (onToggleImageSelection) {
      onToggleImageSelection(selectionId);
      return;
    }
    setLocalSelectedIds((current) => {
      const hasSelection = current.includes(selectionId);
      if (imageSelectionMode === "single") {
        return hasSelection ? Object.freeze([]) : Object.freeze([selectionId]);
      }
      if (hasSelection) {
        return Object.freeze(current.filter((entry) => entry !== selectionId));
      }
      return Object.freeze([...current, selectionId]);
    });
  };

  return (
    <section className="ui-stack ui-stack--sm" data-testid="data-preview-image-collection-surface">
      <div className="ui-row ui-row--between ui-row--wrap">
        <span className="ui-text-small ui-text-secondary">
          Showing {currentOffset + 1}-{currentOffset + preview.window.returned} of {preview.summary.totalCount}
        </span>
        <div className="ui-row ui-row--wrap">
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            disabled={!preview.window.hasPreviousWindow}
            onClick={() => setWindowOffset(Math.max(0, currentOffset - preview.window.limit))}
          >
            Previous
          </button>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            disabled={!preview.window.hasNextWindow}
            onClick={() => setWindowOffset(currentOffset + preview.window.limit)}
          >
            Next
          </button>
        </div>
      </div>
      {windowOffset !== currentOffset ? (
        <span className="ui-text-small ui-text-secondary">
          Window controls are preview-contract driven. Request offset {windowOffset} from the preview service to fetch that window.
        </span>
      ) : null}
      <div className="ui-row ui-row--wrap">
        <span className="ui-badge ui-badge--neutral">selection: {imageSelectionMode}</span>
        <span className="ui-badge ui-badge--neutral">selected: {selectedIds.length}</span>
      </div>
      <div className="ui-image-preview-grid">
        {items.map((item) => {
          const isSelected = resolveSelectionForImage({
            imageId: item.selectionId,
            selectedIds,
          });
          return (
            <article key={item.itemId} className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="data-preview-image-card">
              <div className="ui-image-preview-grid__thumb-wrap">
                <ImageRenderFrame
                  className="ui-image-preview-thumb ui-image-preview-thumb--grid"
                  image={toImageViewModel(item)}
                  renderOptions={THUMBNAIL_RENDER_OPTIONS}
                  selected={isSelected}
                  fallbackLabel="No preview"
                />
              </div>
              <strong className="ui-text-small">{item.imageReference ?? item.imageId ?? item.itemId}</strong>
              <span className="ui-text-small ui-text-secondary">{item.width !== undefined && item.height !== undefined ? `${item.width}x${item.height}` : "Unknown size"} Â· {item.format ?? "unknown"}</span>
              <span className="ui-text-small ui-text-secondary">{formatImageMetadata(item.metadataSummary)}</span>
              {item.tags.length > 0 ? <span className="ui-text-small ui-text-secondary">Tags: {item.tags.join(", ")}</span> : null}
              {item.issues.length > 0 ? <span className="ui-text-small ui-text-danger">{item.issues.join(" ")}</span> : null}
              <button
                type="button"
                className={`ui-button ui-button--sm ${isSelected ? "ui-button--primary" : "ui-button--ghost"}`}
                aria-pressed={isSelected}
                onClick={() => toggleSelection(item.selectionId)}
              >
                {isSelected ? "Selected" : "Select"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function DataPreviewSurface({
  preview,
  title = "Data Preview",
  imageSelectionMode = "single",
  selectedImageSelectionIds,
  onToggleImageSelection,
}: DataPreviewSurfaceProps): JSX.Element {
  return (
    <section className="ui-panel ui-stack ui-stack--sm" data-testid="data-preview-surface">
      <header className="ui-stack ui-stack--2xs">
        <div className="ui-panel__title">{title}</div>
        <div className="ui-row ui-row--wrap">
          <span className="ui-badge ui-badge--neutral">{preview.kind}</span>
          {preview.summary.truncated ? <span className="ui-badge ui-badge--warning">sampled</span> : null}
        </div>
      </header>
      {renderSummary(preview)}
      {preview.kind === "image-metadata-records" ? (
        <ImageCollectionPreviewSurface
          preview={preview}
          imageSelectionMode={imageSelectionMode}
          selectedImageSelectionIds={selectedImageSelectionIds}
          onToggleImageSelection={onToggleImageSelection}
        />
      ) : renderData(preview)}
    </section>
  );
}

