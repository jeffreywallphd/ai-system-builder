import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Link } from "react-router-dom";
import type { ReactFlowNodeData } from "./NodeAdapter";
import NodePropertyEditor from "../../nodes/NodePropertyEditor";
import { ROUTE_PATHS } from "../../../routes/RouteConfig";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from "../../../../application/nodes/NodeCanvasLayoutMetrics";

const inputHandleStyle: React.CSSProperties = {
  top: "50%",
  left: 0,
  transform: "translate(-60%, -50%)",
};

const outputHandleStyle: React.CSSProperties = {
  top: "50%",
  right: 0,
  transform: "translate(60%, -50%)",
};

function ReactFlowNodeWrapper({
  data,
  selected,
}: NodeProps<Node<ReactFlowNodeData>>): JSX.Element {
  const node = data.node;
  const nodeWidth = data.isCompactViewport
    ? undefined
    : node.size?.width ?? DEFAULT_NODE_WIDTH;
  const nodeMinHeight = data.isCompactViewport
    ? undefined
    : node.size?.height ?? DEFAULT_NODE_HEIGHT;
  const hasProperties = node.properties.length > 0;
  const executionOutput = data.executionOutput;
  const chunkDisplayItems =
    node.definitionType === "shared.chunk-displayer" && Array.isArray(executionOutput?.display)
      ? (executionOutput.display as ReadonlyArray<{ index?: number; text?: string }> )
      : undefined;

  return (
    <div
      className={`ui-rf-node${selected ? " ui-rf-node--selected" : ""}${
        !node.isEnabled ? " ui-rf-node--disabled" : ""
      }`}
      style={{
        width: nodeWidth,
        minHeight: nodeMinHeight,
      }}
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
          {node.modelSearch ? (
            <Link
              className="ui-button ui-button--ghost ui-button--sm nodrag"
              to={`${ROUTE_PATHS.models}?${buildModelSearchQuery(node.modelSearch)}`}
            >
              Find Models
            </Link>
          ) : null}
        </div>
      </div>

      <div className="ui-rf-node__body nodrag">
        <div className="ui-rf-node__layout">
          <div className="ui-stack ui-stack--xs">
            {node.inputPorts.length > 0 ? (
              node.inputPorts.map((port) => (
                <div key={port.id} className="ui-rf-node__port-row ui-rf-node__port-row--input">
                  <Handle
                    id={port.id}
                    type="target"
                    position={Position.Left}
                    className="ui-rf-node__handle"
                    style={inputHandleStyle}
                  />
                  <div className="ui-rf-node__port-label">
                    <span className="ui-text-small">{port.name}</span>
                    {port.valueTypes.slice(0, 1).map((type) => (
                      <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <span className="ui-subtle ui-text-small">No inputs</span>
            )}
          </div>

          {hasProperties ? (
            <div className="ui-rf-node__properties ui-tablet-up-only">
              <div className="ui-rf-node__properties-header">
                <span>Properties</span>
                <span className="ui-badge ui-badge--neutral">{node.properties.length}</span>
              </div>

              <div className="ui-rf-node__properties-body nodrag">
                <NodePropertyEditor
                  fields={node.properties}
                  disabled={!node.isEnabled}
                  onPropertyChange={(propertyId, value) =>
                    data.onPropertyChange?.(node.id, propertyId, value)
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="ui-stack ui-stack--xs">
            {node.outputPorts.length > 0 ? (
              node.outputPorts.map((port) => (
                <div key={port.id} className="ui-rf-node__port-row ui-rf-node__port-row--output">
                  <div className="ui-rf-node__port-label ui-rf-node__port-label--right">
                    <span className="ui-text-small">{port.name}</span>
                    {port.valueTypes.slice(0, 1).map((type) => (
                      <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
                        {type}
                      </span>
                    ))}
                  </div>
                  <Handle
                    id={port.id}
                    type="source"
                    position={Position.Right}
                    className="ui-rf-node__handle"
                    style={outputHandleStyle}
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

          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm nodrag"
            onClick={() => data.onRemoveNode?.(node.id)}
          >
            Remove
          </button>
        </div>

        {chunkDisplayItems ? (
          <div className="ui-card" style={{ marginTop: "var(--space-sm)", maxHeight: 180, overflow: "auto" }}>
            <div className="ui-card__body ui-stack ui-stack--xs">
              <div className="ui-heading-4">Chunks</div>
              {chunkDisplayItems.map((chunk, index) => (
                <div key={`chunk-${index}`} className="ui-text-small">
                  <strong>#{chunk.index ?? index}</strong> {chunk.text ?? ""}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasProperties ? (
          <>
            <div className="ui-mobile-only" style={{ marginTop: "var(--space-sm)" }}>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm nodrag"
                onClick={() => data.onOpenProperties?.(node.id)}
              >
                Set Properties
              </button>
            </div>

          </>
        ) : null}
      </div>
    </div>
  );
}

export default memo(ReactFlowNodeWrapper);

function buildModelSearchQuery(search: NonNullable<ReactFlowNodeData["node"]["modelSearch"]>): string {
  const params = new URLSearchParams();
  params.set("mode", "remote");
  params.set("query", search.query);

  if (search.kind) {
    params.set("kind", search.kind);
  }

  if (search.runtime) {
    params.set("runtime", search.runtime);
  }

  return params.toString();
}
