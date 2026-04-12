import type { NodeDetailViewModel } from "../../presenters/NodePresenter";

export interface WorkflowNodeListProps {
  readonly nodes: ReadonlyArray<NodeDetailViewModel>;
  readonly selectedNodeId?: string;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onRemoveNode?: (nodeId: string) => void;
}

export default function WorkflowNodeList({
  nodes,
  selectedNodeId,
  onSelectNode,
  onRemoveNode,
}: WorkflowNodeListProps): JSX.Element {
  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Workflow Nodes</div>
          <div className="ui-panel__subtitle">
            Current nodes in the workflow, available for selection and editing.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        {nodes.length === 0 ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">
              No nodes have been added to this workflow yet.
            </p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--sm">
            {nodes.map((node) => (
              <article
                key={node.id}
                className={`ui-card ui-card--interactive${
                  selectedNodeId === node.id ? " ui-glow-accent" : ""
                }`}
              >
                <div className="ui-card__body ui-stack ui-stack--sm">
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ alignItems: "flex-start" }}>
                    <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
                      <div className="ui-heading-4" style={{ overflowWrap: "anywhere" }}>
                        {node.title}
                      </div>
                      <div className="ui-text-secondary ui-text-small">
                        {node.definitionTitle} • {node.definitionType}
                      </div>
                    </div>

                    <div className="ui-chips">
                      <span className="ui-badge ui-badge--neutral">{node.category}</span>
                      <span className="ui-badge ui-badge--neutral">
                        {node.executionKind}
                      </span>
                    </div>
                  </div>

                  <div className="ui-chips">
                    {node.isExecutable ? (
                      <span className="ui-badge ui-badge--success">Executable</span>
                    ) : (
                      <span className="ui-badge ui-badge--warning">Not Executable</span>
                    )}
                    {node.isModelAware ? (
                      <span className="ui-badge ui-badge--model">Model Aware</span>
                    ) : null}
                    {!node.isEnabled ? (
                      <span className="ui-badge ui-badge--danger">Disabled</span>
                    ) : null}
                    {node.isCollapsed ? (
                      <span className="ui-badge ui-badge--info">Collapsed</span>
                    ) : null}
                    <span className="ui-badge ui-badge--info">
                      In {node.inputPorts.length}
                    </span>
                    <span className="ui-badge ui-badge--info">
                      Out {node.outputPorts.length}
                    </span>
                  </div>

                  <div className="ui-row ui-row--wrap">
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      onClick={() => onSelectNode?.(node.id)}
                    >
                      {selectedNodeId === node.id ? "Selected" : "Inspect"}
                    </button>

                    <button
                      type="button"
                      className="ui-button ui-button--danger ui-button--sm"
                      onClick={() => onRemoveNode?.(node.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
