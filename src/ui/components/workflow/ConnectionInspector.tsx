import type { WorkflowResponse } from "@application/dto/WorkflowResponse";

export interface ConnectionInspectorProps {
  readonly connection?: WorkflowResponse["connections"][number];
  readonly onRemoveConnection?: (connectionId: string) => void;
}

export default function ConnectionInspector({
  connection,
  onRemoveConnection,
}: ConnectionInspectorProps): JSX.Element {
  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Connection Inspector</div>
          <div className="ui-panel__subtitle">
            Inspect and manage the selected workflow connection.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        {!connection ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">
              Select a connection on the canvas to inspect its metadata.
            </p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--md">
            <div className="ui-chips">
              <span className="ui-badge ui-badge--neutral">{connection.kind}</span>
              <span className="ui-badge ui-badge--info">{connection.state}</span>
              {connection.isEnabled ? (
                <span className="ui-badge ui-badge--success">Enabled</span>
              ) : (
                <span className="ui-badge ui-badge--danger">Disabled</span>
              )}
            </div>

            <div className="ui-meta-grid">
              <div className="ui-meta-item">
                <div className="ui-meta-label">Source Node</div>
                <div className="ui-meta-value">{connection.source.nodeId}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Source Port</div>
                <div className="ui-meta-value">{connection.source.portId}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Target Node</div>
                <div className="ui-meta-value">{connection.target.nodeId}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Target Port</div>
                <div className="ui-meta-value">{connection.target.portId}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Connection Id</div>
                <div className="ui-meta-value">{connection.id}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Label</div>
                <div className="ui-meta-value">{connection.metadata?.label ?? "â€”"}</div>
              </div>
            </div>

            {connection.metadata?.description ? (
              <div className="ui-stack ui-stack--xs">
                <div className="ui-meta-label">Description</div>
                <div className="ui-text-secondary">{connection.metadata.description}</div>
              </div>
            ) : null}

            {connection.metadata?.tags && connection.metadata.tags.length > 0 ? (
              <div className="ui-stack ui-stack--xs">
                <div className="ui-meta-label">Tags</div>
                <div className="ui-chips">
                  {connection.metadata.tags.map((tag) => (
                    <span key={tag} className="ui-badge ui-badge--neutral">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ui-row ui-row--wrap">
              <button
                type="button"
                className="ui-button ui-button--danger ui-button--md"
                onClick={() => onRemoveConnection?.(connection.id)}
              >
                Remove Connection
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

