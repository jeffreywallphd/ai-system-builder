import DataPreviewSurface from "./DataPreviewSurface";
import type { DataAssetExecutionResult } from "../../../application/dataset-studio/DataAssetExecutionFramework";

export interface DataPreviewPanelProps {
  readonly title?: string;
  readonly isLoading?: boolean;
  readonly executionResult?: DataAssetExecutionResult;
  readonly emptyMessage?: string;
}

function renderValidationSummary(result: DataAssetExecutionResult): JSX.Element | null {
  const issues = result.validationIssues;
  if (issues.length === 0) {
    return null;
  }

  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="data-preview-panel-validation">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Validation</strong>
        <div className="ui-row ui-row--wrap">
          {errorCount > 0 ? <span className="ui-badge ui-badge--danger">{errorCount} errors</span> : null}
          {warningCount > 0 ? <span className="ui-badge ui-badge--warning">{warningCount} warnings</span> : null}
        </div>
      </div>
      <ul className="ui-stack ui-stack--2xs">
        {issues.slice(0, 6).map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            <span className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
              [{issue.section}] {issue.message}
            </span>
            {issue.path ? <span className="ui-subtle"> ({issue.path})</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderExecutionMetadata(result: DataAssetExecutionResult): JSX.Element {
  const lineage = result.lineage;

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="data-preview-panel-metadata">
      <strong>Execution Metadata</strong>
      <div className="ui-meta-grid">
        <div className="ui-meta-item">
          <div className="ui-meta-label">Output type</div>
          <div className="ui-meta-value">{result.output?.kind ?? result.preview.kind}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Sample count</div>
          <div className="ui-meta-value">{result.preview.summary.sampleCount}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Lineage inputs</div>
          <div className="ui-meta-value">{lineage.inputs.length}</div>
        </div>
        <div className="ui-meta-item">
          <div className="ui-meta-label">Lineage steps</div>
          <div className="ui-meta-value">{lineage.steps.length}</div>
        </div>
      </div>
      {result.failure ? (
        <div className="ui-banner ui-banner--danger">
          {result.failure.kind}: {result.failure.message}
        </div>
      ) : null}
    </section>
  );
}

export default function DataPreviewPanel({
  title = "Data Preview Panel",
  isLoading = false,
  executionResult,
  emptyMessage = "Run conversion/execution to inspect a preview sample.",
}: DataPreviewPanelProps): JSX.Element {
  if (isLoading) {
    return (
      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="data-preview-panel-loading">
        <strong>{title}</strong>
        <div className="ui-text-muted">Loading preview...</div>
      </section>
    );
  }

  if (!executionResult) {
    return (
      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="data-preview-panel-empty">
        <strong>{title}</strong>
        <div className="ui-text-muted">{emptyMessage}</div>
      </section>
    );
  }

  return (
    <section className="ui-stack ui-stack--sm" data-testid="data-preview-panel">
      {renderExecutionMetadata(executionResult)}
      <DataPreviewSurface preview={executionResult.preview} title={title} />
      {renderValidationSummary(executionResult)}
    </section>
  );
}


