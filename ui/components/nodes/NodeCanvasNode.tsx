import NodePort from "./NodePort";
import type { NodeDetailViewModel } from "../../presenters/NodePresenter";
import { useNodeDrag, type NodeDragPosition } from "../workflow/useNodeDrag";

export interface NodeCanvasNodeProps {
  readonly node: NodeDetailViewModel;
  readonly isSelected?: boolean;
  readonly disabled?: boolean;
  readonly onSelect?: (nodeId: string) => void;
  readonly onPositionChange?: (nodeId: string, position: NodeDragPosition) => void;
  readonly onPositionCommit?: (nodeId: string, position: NodeDragPosition) => void;
}

export default function NodeCanvasNode({
  node,
  isSelected,
  disabled,
  onSelect,
  onPositionChange,
  onPositionCommit,
}: NodeCanvasNodeProps): JSX.Element {
  const drag = useNodeDrag({
    nodeId: node.id,
    initialPosition: {
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
    },
    disabled,
    gridSize: 8,
    bounds: {
      minX: 0,
      minY: 0,
    },
    onDragMove: onPositionChange,
    onDragEnd: onPositionCommit,
  });

  return (
    <article
      className={`ui-node-canvas-node${isSelected ? " ui-node-canvas-node--selected" : ""}${
        drag.isDragging ? " ui-node-canvas-node--dragging" : ""
      }${!node.isEnabled ? " ui-node-canvas-node--disabled" : ""}`}
      style={{
        left: `${drag.position.x}px`,
        top: `${drag.position.y}px`,
      }}
      onClick={() => onSelect?.(node.id)}
    >
      <div className="ui-node-canvas-node__header" {...drag.dragHandleProps}>
        <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
          <div className="ui-node-canvas-node__title">{node.title}</div>
          <div className="ui-text-small ui-subtle" style={{ overflowWrap: "anywhere" }}>
            {node.definitionTitle}
          </div>
        </div>

        <div className="ui-chips" data-node-drag-ignore="true">
          <span className="ui-badge ui-badge--neutral">{node.category}</span>
          {node.isModelAware ? (
            <span className="ui-badge ui-badge--model">Model</span>
          ) : null}
        </div>
      </div>

      <div className="ui-node-canvas-node__body" data-node-drag-ignore="true">
        <div className="ui-node-canvas-node__ports">
          <div className="ui-stack ui-stack--xs">
            {node.inputPorts.length > 0 ? (
              node.inputPorts.map((port) => (
                <NodePort key={port.id} port={port} side="input" />
              ))
            ) : (
              <div className="ui-subtle ui-text-small">No inputs</div>
            )}
          </div>

          <div className="ui-stack ui-stack--xs">
            {node.outputPorts.length > 0 ? (
              node.outputPorts.map((port) => (
                <NodePort key={port.id} port={port} side="output" />
              ))
            ) : (
              <div className="ui-subtle ui-text-small" style={{ textAlign: "right" }}>
                No outputs
              </div>
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
    </article>
  );
}
