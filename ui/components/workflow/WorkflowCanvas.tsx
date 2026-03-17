import type { NodeDetailViewModel } from "../../presenters/NodePresenter";
import type { WorkflowResponse } from "../../application/dto/WorkflowResponse";
import ReactFlowCanvas from "./reactflow/ReactFlowCanvas";

export interface WorkflowCanvasProps {
  readonly nodes: ReadonlyArray<NodeDetailViewModel>;
  readonly workflow?: WorkflowResponse;
  readonly selectedNodeId?: string;
  readonly selectedConnectionId?: string;
  readonly fitViewNonce?: number;
  readonly isCompactViewport?: boolean;
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
  readonly onOpenNodeProperties?: (nodeId: string) => void;
  readonly onNodePropertyChange?: (
    nodeId: string,
    propertyId: string,
    value: unknown
  ) => void;
  readonly nodeExecutionOutputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export default function WorkflowCanvas({
  nodes,
  workflow,
  selectedNodeId,
  selectedConnectionId,
  fitViewNonce,
  isCompactViewport,
  onSelectNode,
  onSelectConnection,
  onClearSelection,
  onMoveNodeCommit,
  onConnectNodes,
  onOpenNodeProperties,
  onNodePropertyChange,
  nodeExecutionOutputs,
}: WorkflowCanvasProps): JSX.Element {
  return (
    <section className="ui-canvas-surface">
      <ReactFlowCanvas
        nodes={nodes}
        workflow={workflow}
        selectedNodeId={selectedNodeId}
        selectedConnectionId={selectedConnectionId}
        fitViewNonce={fitViewNonce}
        isCompactViewport={isCompactViewport}
        onSelectNode={onSelectNode}
        onSelectConnection={onSelectConnection}
        onClearSelection={onClearSelection}
        onMoveNodeCommit={onMoveNodeCommit}
        onConnectNodes={onConnectNodes}
        onOpenNodeProperties={onOpenNodeProperties}
        onNodePropertyChange={onNodePropertyChange}
        nodeExecutionOutputs={nodeExecutionOutputs}
      />

      {nodes.length === 0 ? (
        <div className="ui-canvas-empty">
          <div className="ui-empty-state">
            <div className="ui-heading-4">Canvas Ready</div>
            <p className="ui-text-secondary">
              Open the menu and add a node from the palette to start building.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
