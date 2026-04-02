import type { JSX } from "react";
import type { ImageRunHistoryItemViewModel, ImageRunHistoryListPropsContract } from "./ImageUiContracts";
import { ParameterSummaryPanel } from "./ImageSummaryPanels";

function ImageRunHistoryListItem({ run }: { readonly run: ImageRunHistoryItemViewModel }): JSX.Element {
  return (
    <article className="ui-image-run-history__item ui-image-item-card">
      <header className="ui-image-run-history__item-header">
        <strong>{run.runId}</strong>
        <span className={`ui-pill ui-pill--${run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "warning"}`}>{run.status}</span>
      </header>
      <div className="ui-image-run-history__item-meta ui-text-small ui-text-secondary">
        <span>{run.timestamp}</span>
        <span>{run.workflowSummary}</span>
        <span>{run.ioSummary}</span>
      </div>
      <ParameterSummaryPanel summary={run.parameterSummary} />
    </article>
  );
}

export interface ImageRunHistoryListProps extends ImageRunHistoryListPropsContract {
  readonly title?: string;
  readonly emptyMessage?: string;
}

export function ImageRunHistoryList({ runs, title = "Run history", emptyMessage = "No run history available." }: ImageRunHistoryListProps): JSX.Element {
  if (runs.length === 0) {
    return <section className="ui-image-run-history ui-image-surface--status">{emptyMessage}</section>;
  }

  return (
    <section className="ui-image-run-history ui-image-surface">
      <header className="ui-image-surface__header">
        <h3 className="ui-image-surface__title">{title}</h3>
        <span className="ui-text-small ui-text-secondary">{runs.length} runs</span>
      </header>
      <div className="ui-image-run-history__list">
        {runs.map((run) => <ImageRunHistoryListItem key={run.runId} run={run} />)}
      </div>
    </section>
  );
}
