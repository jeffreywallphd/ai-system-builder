import { useMemo } from "react";
import type { NodeDetailViewModel } from "../../presenters/NodePresenter";
import NodePropertyEditor from "./NodePropertyEditor";

export interface NodeInspectorProps {
  readonly node?: NodeDetailViewModel;
  readonly onPropertyChange?: (propertyId: string, value: unknown) => void;
}

export default function NodeInspector({
  node,
  onPropertyChange,
}: NodeInspectorProps): JSX.Element {
  const sortedInputPorts = useMemo(() => node?.inputPorts ?? [], [node]);

  const sortedOutputPorts = useMemo(() => node?.outputPorts ?? [], [node]);

  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Node Inspector</div>
          <div className="ui-panel__subtitle">Inspect and edit the selected workflow node.</div>
        </div>
      </div>

      <div className="ui-panel__body">
        {!node ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">
              Select a node to inspect its properties, ports, and metadata.
            </p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--md">
            <div className="ui-stack ui-stack--sm">
              <div className="ui-stack ui-stack--2xs">
                <div className="ui-heading-4">{node.title}</div>
                <div className="ui-text-secondary ui-text-small">
                  {node.definitionTitle} • {node.definitionType}
                </div>
                {node.notes ? <div className="ui-text-secondary">{node.notes}</div> : null}
              </div>

              <div className="ui-chips">
                <span className="ui-badge ui-badge--neutral">{node.category}</span>
                <span className="ui-badge ui-badge--neutral">{node.executionKind}</span>
                {node.isExecutable ? (
                  <span className="ui-badge ui-badge--success">Executable</span>
                ) : (
                  <span className="ui-badge ui-badge--warning">Not Executable</span>
                )}
                {node.isModelAware ? <span className="ui-badge ui-badge--model">Model Aware</span> : null}
                {!node.isEnabled ? <span className="ui-badge ui-badge--danger">Disabled</span> : null}
                {node.isCollapsed ? <span className="ui-badge ui-badge--info">Collapsed</span> : null}
              </div>
            </div>

            <div className="ui-divider" />

            <div className="ui-stack ui-stack--sm">
              <div className="ui-heading-4">Ports</div>

              <div className="ui-meta-grid">
                <div className="ui-meta-item">
                  <div className="ui-meta-label">Inputs</div>
                  <div className="ui-stack ui-stack--xs">
                    {sortedInputPorts.length > 0 ? (
                      sortedInputPorts.map((port) => (
                        <div key={port.id} className="ui-card">
                          <div className="ui-card__body ui-stack ui-stack--2xs">
                            <div className="ui-row ui-row--between ui-row--wrap">
                              <span className="ui-text-body">{port.name}</span>
                              <div className="ui-chips">
                                <span className="ui-badge ui-badge--neutral">{port.cardinality}</span>
                                {port.isOptional ? (
                                  <span className="ui-badge ui-badge--warning">Optional</span>
                                ) : null}
                                {port.isControlPort ? (
                                  <span className="ui-badge ui-badge--control">Control</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="ui-chips">
                              {port.valueTypes.map((type) => (
                                <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
                                  {type}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="ui-subtle">No input ports</span>
                    )}
                  </div>
                </div>

                <div className="ui-meta-item">
                  <div className="ui-meta-label">Outputs</div>
                  <div className="ui-stack ui-stack--xs">
                    {sortedOutputPorts.length > 0 ? (
                      sortedOutputPorts.map((port) => (
                        <div key={port.id} className="ui-card">
                          <div className="ui-card__body ui-stack ui-stack--2xs">
                            <div className="ui-row ui-row--between ui-row--wrap">
                              <span className="ui-text-body">{port.name}</span>
                              <div className="ui-chips">
                                <span className="ui-badge ui-badge--neutral">{port.cardinality}</span>
                                {port.isControlPort ? (
                                  <span className="ui-badge ui-badge--control">Control</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="ui-chips">
                              {port.valueTypes.map((type) => (
                                <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
                                  {type}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="ui-subtle">No output ports</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="ui-divider" />

            <NodePropertyEditor
              fields={node.properties}
              disabled={!node.isEnabled}
              onPropertyChange={onPropertyChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}
