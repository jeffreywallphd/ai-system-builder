import type { JSX } from "react";
import type { DataPreviewModel } from "../../../application/data-studio/DataPreviewEngine";

export interface DataPreviewSurfaceProps {
  readonly preview: DataPreviewModel;
  readonly title?: string;
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
              <th>Item</th>
              <th>Label</th>
              <th>Confidence</th>
              <th>Bounding box</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => (
              <tr key={item.itemId}>
                <td>{item.itemId}</td>
                <td>{item.label ?? "-"}</td>
                <td>{item.confidence?.toFixed(3) ?? "-"}</td>
                <td>{item.boundingBox
                  ? `${item.boundingBox.x},${item.boundingBox.y},${item.boundingBox.width},${item.boundingBox.height}`
                  : "-"}</td>
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

export default function DataPreviewSurface({ preview, title = "Data Preview" }: DataPreviewSurfaceProps): JSX.Element {
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
      {renderData(preview)}
    </section>
  );
}
