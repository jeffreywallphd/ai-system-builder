import type { DesktopPostLoginRuntimeStatus } from "../../../../electron/shared/DesktopContracts";
import { buildDesktopRuntimeDiagnosticsSnapshot } from "../../runtime/DesktopRuntimeDiagnosticsModel";

export interface DesktopRuntimeDiagnosticsPanelProps {
  readonly runtimeLifecycleStatus?: DesktopPostLoginRuntimeStatus;
}

export default function DesktopRuntimeDiagnosticsPanel({
  runtimeLifecycleStatus,
}: DesktopRuntimeDiagnosticsPanelProps): JSX.Element {
  const snapshot = buildDesktopRuntimeDiagnosticsSnapshot(runtimeLifecycleStatus);

  return (
    <section className="ui-panel ui-panel--flat" aria-live="polite" data-testid="desktop-runtime-diagnostics-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Desktop runtime diagnostics (development)</div>
          <div className="ui-panel__subtitle">
            Lifecycle troubleshooting details for local desktop activation issues.
          </div>
        </div>
      </div>
      <div className="ui-panel__body">
        {snapshot ? (
          <>
            <div className="ui-meta-grid">
              <div className="ui-meta-item">
                <div className="ui-meta-label">Lifecycle state</div>
                <div className="ui-meta-value">{snapshot.lifecycleState}</div>
              </div>
              <div className="ui-meta-item">
                <div className="ui-meta-label">Capability phase</div>
                <div className="ui-meta-value">{snapshot.capabilityPhase}</div>
              </div>
              <div className="ui-meta-item">
                <div className="ui-meta-label">Transport phase</div>
                <div className="ui-meta-value">{snapshot.transportPhase}</div>
              </div>
              <div className="ui-meta-item">
                <div className="ui-meta-label">Blocking dependency category</div>
                <div className="ui-meta-value">{snapshot.blockingDependencyCategory}</div>
              </div>
            </div>
            <div className="ui-stack" style={{ gap: "0.35rem" }}>
              <div className="ui-meta-label">Blocking activation stage</div>
              <div className="ui-meta-value">
                {snapshot.blockingActivationStageId
                  ? `${snapshot.blockingActivationStageId} (${snapshot.blockingActivationStageState ?? "unknown"})`
                  : "none"}
              </div>
              {snapshot.blockingActivationStageDetail ? (
                <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
                  {snapshot.blockingActivationStageDetail}
                </p>
              ) : null}
            </div>
            <div className="ui-stack" style={{ gap: "0.35rem" }}>
              <div className="ui-meta-label">Recent transition timestamps</div>
              <ul className="ui-list ui-stack" style={{ gap: "0.2rem", margin: 0, paddingLeft: "1rem" }}>
                {snapshot.recentTransitionTimestamps.map((entry) => (
                  <li key={`${entry.key}:${entry.occurredAt}`} className="ui-text-small">
                    <span className="ui-text-secondary">{entry.label}:</span>{" "}
                    <code>{entry.occurredAt}</code>
                  </li>
                ))}
              </ul>
            </div>
            <details>
              <summary className="ui-meta-label">Inspectable lifecycle snapshot</summary>
              <pre
                className="ui-code"
                data-testid="desktop-runtime-diagnostics-json"
                style={{ marginTop: "0.5rem", maxHeight: "16rem", overflow: "auto" }}
              >
                {JSON.stringify(runtimeLifecycleStatus, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
            Runtime lifecycle status has not been reported by the desktop bridge yet.
          </p>
        )}
      </div>
    </section>
  );
}
