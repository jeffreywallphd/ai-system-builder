import type { JSX } from "react";
import type { ImageRunHistoryItemViewModel, ImageRunHistoryListEventContract, ImageRunHistoryListPropsContract } from "./ImageUiContracts";
import { emitImageUiEvent } from "./ImageUiEventAdapters";
import { ParameterSummaryPanel } from "./ImageSummaryPanels";

function ImageRunHistoryListItem({
  run,
  selected,
  onRunSelected,
  onEvent,
}: {
  readonly run: ImageRunHistoryItemViewModel;
  readonly selected: boolean;
  readonly onRunSelected?: ImageRunHistoryListEventContract["onRunSelected"];
  readonly onEvent?: ImageRunHistoryListEventContract["onEvent"];
}): JSX.Element {
  return (
    <article className={["ui-image-run-history__item", "ui-image-item-card", selected ? "ui-image-item-card--selected" : ""].filter(Boolean).join(" ")}>
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
      <div className="ui-image-control-group">
        <button
          type="button"
          className={`ui-button ui-button--sm ${selected ? "ui-button--primary" : "ui-button--ghost"}`}
          onClick={() => {
            onRunSelected?.({ sourceComponent: "run-history", runId: run.runId });
            emitImageUiEvent(onEvent, {
              type: "viewer-interaction",
              sourceComponent: "run-history",
              payload: {
                interactionType: "select",
                details: {
                  runId: run.runId,
                  linkedOutputCount: run.linkedOutputImageIds.length,
                },
              },
            });
          }}
        >
          {selected ? "Selected" : "Inspect outputs"}
        </button>
      </div>
    </article>
  );
}

export interface ImageRunHistoryListProps extends ImageRunHistoryListPropsContract, ImageRunHistoryListEventContract {
  readonly title?: string;
  readonly emptyMessage?: string;
}

export function ImageRunHistoryList({
  runs,
  selectedRunId,
  onRunSelected,
  onEvent,
  title = "Run history",
  emptyMessage = "No run history available.",
}: ImageRunHistoryListProps): JSX.Element {
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
        {runs.map((run) => (
          <ImageRunHistoryListItem
            key={run.runId}
            run={run}
            selected={selectedRunId === run.runId}
            onRunSelected={onRunSelected}
            onEvent={onEvent}
          />
        ))}
      </div>
    </section>
  );
}
