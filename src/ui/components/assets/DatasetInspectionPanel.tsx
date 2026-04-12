import type { JSX } from "react";
import type { DatasetInspectionViewModel } from "@application/data-studio/DatasetInspectionViewModel";

export interface DatasetInspectionPanelProps {
  readonly model?: DatasetInspectionViewModel;
  readonly isLoading?: boolean;
}

export default function DatasetInspectionPanel({ model, isLoading = false }: DatasetInspectionPanelProps): JSX.Element {
  if (isLoading) {
    return (
      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-inspection-panel-loading">
        <strong>Dataset Inspection</strong>
        <span className="ui-text-muted">Loading schema-aware inspection...</span>
      </section>
    );
  }

  if (!model) {
    return (
      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-inspection-panel-empty">
        <strong>Dataset Inspection</strong>
        <span className="ui-text-muted">Run a preview to inspect dataset schema, validation, and record samples.</span>
      </section>
    );
  }

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid="dataset-inspection-panel">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Dataset Inspection</strong>
        <span className={`ui-badge ${model.validationSummary.valid ? "ui-badge--success" : "ui-badge--warning"}`}>
          {model.validationSummary.valid ? "valid" : "needs review"}
        </span>
      </div>
      <div className="ui-meta-grid">
        <div className="ui-meta-item">
          <div className="ui-meta-label">Intent</div>
          <div className="ui-meta-value">{model.intent.name}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Intent id</div>
          <div className="ui-meta-value">{model.intent.id}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Contract version</div>
          <div className="ui-meta-value">{model.intent.contractVersion}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Shape kind</div>
          <div className="ui-meta-value">{model.shapeKind ?? "-"}</div>
        </div>
      </div>
      <span className="ui-subtle">{model.intent.description}</span>
      <span className="ui-subtle">{model.recordStructure}</span>

      <section className="ui-stack ui-stack--2xs">
        <strong>Field definitions</strong>
        {model.fields.length === 0 ? (
          <span className="ui-text-muted">No fields available until preview data is loaded.</span>
        ) : (
          <ul className="ui-stack ui-stack--2xs">
            {model.fields.map((field) => (
              <li key={field.name}>
                <span>{field.name}</span>
                {field.valueType ? <span className="ui-subtle"> Â· {field.valueType}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-stack ui-stack--2xs">
        <strong>Validation summary</strong>
        <div className="ui-row ui-row--wrap">
          <span className="ui-badge ui-badge--danger">{model.validationSummary.errors} errors</span>
          <span className="ui-badge ui-badge--warning">{model.validationSummary.warnings} warnings</span>
        </div>
        {model.validationIssues.length > 0 ? (
          <ul className="ui-stack ui-stack--2xs">
            {model.validationIssues.slice(0, 8).map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>{issue.message}</span>
                {issue.path ? <span className="ui-subtle"> ({issue.path})</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <span className="ui-text-muted">No validation issues for current preview payload.</span>
        )}
      </section>

      <details>
        <summary className="ui-text-small">Sample records</summary>
        {model.sampleRecords.length > 0 ? (
          <pre className="ui-text-mono">{JSON.stringify(model.sampleRecords, null, 2)}</pre>
        ) : (
          <span className="ui-text-muted">No sample records available.</span>
        )}
      </details>
    </section>
  );
}

