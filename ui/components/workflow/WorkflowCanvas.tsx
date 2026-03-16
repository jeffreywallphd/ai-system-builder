import type { NodeDetailViewModel } from "../../presenters/NodePresenter";
import type { WorkflowResponse } from "../../application/dto/WorkflowResponse";
import ReactFlowCanvas from "./reactflow/ReactFlowCanvas";

export interface WorkflowCanvasProps {
  readonly nodes: ReadonlyArray<NodeDetailViewModel>;
  readonly workflow?: WorkflowResponse;
  readonly selectedNodeId?: string;
  readonly selectedConnectionId?: string;
  readonly fitViewNonce?: number;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onSelectConnection?: (connectionId: string) => void;
  readonly onClearSelection?: () => void;
  readonly onMoveNodeCommit?: (
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ) => void;
  readonly onConnectNodes?: (request: {
    readonly sourceNodeId: string;
    readonly sourcePortId: string;
    readonly targetNodeId: string;
    readonly targetPortId: string;
  }) => void;
}

export default function WorkflowCanvas({
  nodes,
  workflow,
  selectedNodeId,
  selectedConnectionId,
  fitViewNonce,
  onSelectNode,
  onSelectConnection,
  onClearSelection,
  onMoveNodeCommit,
  onConnectNodes,
}: WorkflowCanvasProps): JSX.Element {
  return (
    <section className="ui-panel ui-panel--accent ui-glow-accent">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Canvas</div>
          <div className="ui-panel__subtitle">
            Place, connect, and reposition workflow nodes.
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
          <ReactFlowCanvas
            nodes={nodes}
            workflow={workflow}
            selectedNodeId={selectedNodeId}
            selectedConnectionId={selectedConnectionId}
            fitViewNonce={fitViewNonce}
            onSelectNode={onSelectNode}
            onSelectConnection={onSelectConnection}
            onClearSelection={onClearSelection}
            onMoveNodeCommit={onMoveNodeCommit}
            onConnectNodes={onConnectNodes}
          />
        )}
      </div>
    </section>
  );
}
