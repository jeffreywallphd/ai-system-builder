import { memo, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ReactFlowNodeData } from "./NodeAdapter";

function inputHandlePosition(index: number): CSSProperties {
  return {
    top: 48 + index * 34,
  };
}

function outputHandlePosition(index: number): CSSProperties {
  return {
    top: 48 + index * 34,
  };
}

function ReactFlowNodeWrapper({
  data,
  selected,
}: NodeProps<ReactFlowNodeData>): JSX.Element {
  const node = data.node;

  return (
    <div
      className={`ui-rf-node${selected ? " ui-rf-node--selected" : ""}${
        !node.isEnabled ? " ui-rf-node--disabled" : ""
      }`}
    >
      <div className="ui-rf-node__header">
        <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
          <div className="ui-rf-node__title">{node.title}</div>
          <div className="ui-text-small ui-subtle" style={{ overflowWrap: "anywhere" }}>
            {node.definitionTitle}
          </div>
        </div>

        <div className="ui-chips">
          <span className="ui-badge ui-badge--neutral">{node.category}</span>
          {node.isModelAware ? (
            <span className="ui-badge ui-badge--model">Model</span>
          ) : null}
        </div>
      </div>

      <div className="ui-rf-node__body">
        <div className="ui-rf-node__ports">
          <div className="ui-stack ui-stack--xs">
            {node.inputPorts.length > 0 ? (
              node.inputPorts.map((port, index) => (
                <div key={port.id} className="ui-rf-node__port-row ui-rf-node__port-row--input">
                  <Handle
                    id={port.id}
                    type="target"
                    position={Position.Left}
                    className="ui-rf-node__handle"
                    style={inputHandlePosition(index)}
                  />
                  <div className="ui-rf-node__port-label">
                    <span className="ui-text-small">{port.name}</span>
                    <div className="ui-chips">
                      {port.valueTypes.slice(0, 1).map((type) => (
                        <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <span className="ui-subtle ui-text-small">No inputs</span>
            )}
          </div>

          <div className="ui-stack ui-stack--xs">
            {node.outputPorts.length > 0 ? (
              node.outputPorts.map((port, index) => (
                <div key={port.id} className="ui-rf-node__port-row ui-rf-node__port-row--output">
                  <div className="ui-rf-node__port-label ui-rf-node__port-label--right">
                    <span className="ui-text-small">{port.name}</span>
                    <div className="ui-chips">
                      {port.valueTypes.slice(0, 1).map((type) => (
                        <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Handle
                    id={port.id}
                    type="source"
                    position={Position.Right}
                    className="ui-rf-node__handle"
                    style={outputHandlePosition(index)}
                  />
                </div>
              ))
            ) : (
              <span className="ui-subtle ui-text-small" style={{ textAlign: "right" }}>
                No outputs
              </span>
            )}
          </div>
        </div>

        <div className="ui-row ui-row--wrap" style={{ marginTop: "var(--space-sm)" }}>
          {node.isExecutable ? (
            <span className="ui-badge ui-badge--success">Executable</span>
          ) : (
            <span className="ui-badge ui-badge--warning">Not Ready</span>
          )}
          {!node.isEnabled ? (
            <span className="ui-badge ui-badge--danger">Disabled</span>
          ) : null}
          {node.isCollapsed ? (
            <span className="ui-badge ui-badge--info">Collapsed</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default memo(ReactFlowNodeWrapper);
