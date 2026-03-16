import NodeCanvasNode from "../nodes/NodeCanvasNode";
import type { NodeDetailViewModel } from "../../presenters/NodePresenter";
import type { NodeDragPosition } from "./useNodeDrag";

export interface WorkflowCanvasProps {
  readonly nodes: ReadonlyArray<NodeDetailViewModel>;
  readonly selectedNodeId?: string;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onMoveNode?: (nodeId: string, position: NodeDragPosition) => void;
  readonly onMoveNodeCommit?: (nodeId: string, position: NodeDragPosition) => void;
}

export default function WorkflowCanvas({
  nodes,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onMoveNodeCommit,
}: WorkflowCanvasProps): JSX.Element {
  return (
    <section className="ui-panel ui-panel--accent ui-glow-accent">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Canvas</div>
          <div className="ui-panel__subtitle">
            Place, inspect, and reposition workflow nodes.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        {nodes.length === 0 ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">
              Add a node from the palette to begin building the workflow canvas.
            </p>
          </div>
        ) : (
          <div className="ui-workflow-canvas ui-scrollbar">
            {nodes.map((node) => (
              <NodeCanvasNode
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                onSelect={onSelectNode}
                onPositionChange={onMoveNode}
                onPositionCommit={onMoveNodeCommit}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
