import { useEffect, useState } from "react";
import type { ExecutionRunDetailProjection } from "../../../application/execution/ExecutionRunDetailProjectionService";
import type { ExecutionRelatedRunClusterProjection } from "../../../application/execution/ExecutionRelatedRunClusterProjectionService";
import type { ExecutionRunProjection } from "../../../application/execution/ExecutionRunProjectionService";
import type { ExecutionHistoryService } from "../../services/ExecutionHistoryService";
import ExecutionRunDetailPanel from "./ExecutionRunDetailPanel";

export interface ExecutionHistoryPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly items: ReadonlyArray<ExecutionRunProjection>;
  readonly emptyMessage: string;
  readonly executionHistoryService?: ExecutionHistoryService;
  readonly detailEmptyMessage?: string;
}

export default function ExecutionHistoryPanel({
  title,
  subtitle,
  items,
  emptyMessage,
  executionHistoryService,
  detailEmptyMessage = "Select a durable execution run to inspect run metadata, unit states, timeline, diagnostics, and execution path details.",
}: ExecutionHistoryPanelProps): JSX.Element {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(items[0]?.runId);
  const [detail, setDetail] = useState<ExecutionRunDetailProjection | undefined>(undefined);
  const [relatedRunCluster, setRelatedRunCluster] = useState<ExecutionRelatedRunClusterProjection | undefined>(undefined);
  const [detailError, setDetailError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!items.some((item) => item.runId === selectedRunId)) {
      setSelectedRunId(items[0]?.runId);
    }
  }, [items, selectedRunId]);

  useEffect(() => {
    if (!executionHistoryService || !selectedRunId) {
      setDetail(undefined);
      setRelatedRunCluster(undefined);
      setDetailError(undefined);
      return;
    }

    let active = true;
    setDetailError(undefined);
    void executionHistoryService.getRunDetail(selectedRunId)
      .then((nextDetail) => {
        if (active) {
          setDetail(nextDetail);
        }
      })
      .catch((error) => {
        if (active) {
          setDetail(undefined);
          setRelatedRunCluster(undefined);
          setDetailError(error instanceof Error ? error.message : "Unable to load execution detail.");
        }
      });

    void executionHistoryService.getRelatedRunCluster(selectedRunId)
      .then((cluster) => {
        if (active) {
          setRelatedRunCluster(cluster);
        }
      })
      .catch(() => {
        if (active) {
          setRelatedRunCluster(undefined);
        }
      });

    return () => {
      active = false;
    };
  }, [executionHistoryService, selectedRunId]);

  return (
    <section className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div>
          <h3>{title}</h3>
          <p className="ui-text-secondary ui-text-small">{subtitle}</p>
        </div>

        {items.length === 0 ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
            <div className="ui-stack ui-stack--sm">
              {items.map((item) => (
                <button
                  key={item.runId}
                  className="ui-panel ui-stack ui-stack--2xs"
                  type="button"
                  style={{
                    textAlign: "left",
                    borderColor: item.runId === selectedRunId ? "var(--color-border-strong)" : undefined,
                    background: item.runId === selectedRunId ? "var(--color-surface-elevated)" : undefined,
                  }}
                  onClick={() => setSelectedRunId(item.runId)}
                >
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                    <div className="ui-stack ui-stack--3xs" style={{ minWidth: 0 }}>
                      <strong>{item.terminalSummary ?? item.statusLabel}</strong>
                      <span className="ui-text-secondary ui-text-small">{item.runId}</span>
                    </div>
                    <span className={`ui-badge ui-badge--${item.statusTone}`}>{item.statusLabel}</span>
                  </div>
                  <div className="ui-text-secondary ui-text-small">
                    {item.progressLabel} · {item.executionPathLabel} · {item.durationSummary}
                  </div>
                  {item.currentUnitLabel ? (
                    <div className="ui-text-secondary ui-text-small">Current unit: {item.currentUnitLabel}</div>
                  ) : null}
                  {item.metadataSummary ? (
                    <div className="ui-text-secondary ui-text-small">Context: {item.metadataSummary}</div>
                  ) : null}
                  {item.executionPathDetail ? (
                    <div className="ui-text-secondary ui-text-small">Path detail: {item.executionPathDetail}</div>
                  ) : null}
                  {item.errorSummary ? (
                    <div className="ui-text-secondary ui-text-small">Error: {item.errorSummary}</div>
                  ) : null}
                  {item.diagnosticsSummary ? (
                    <div className="ui-text-secondary ui-text-small">Diagnostics: {item.diagnosticsSummary}</div>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="ui-stack ui-stack--sm">
              {detailError ? <p className="ui-text-danger">{detailError}</p> : null}
              <ExecutionRunDetailPanel
                detail={detail}
                emptyMessage={detailEmptyMessage}
                relatedRunCluster={relatedRunCluster}
                onSelectRun={setSelectedRunId}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
