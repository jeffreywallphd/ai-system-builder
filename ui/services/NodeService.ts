import type { INode } from "../../domain/nodes/interfaces/INode";
import type { INodeDefinition } from "../../domain/nodes/interfaces/INodeDefinition";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { IWorkflowConnection } from "../../domain/workflows/interfaces/IWorkflowConnection";
import type { INodeCatalogSearchCriteria } from "../../application/ports/interfaces/INodeCatalogProvider";
import type { INodeCatalogProvider } from "../../application/ports/interfaces/INodeCatalogProvider";
import {
  CreateNodeUseCase,
  type ICreateNodeRequest,
  type ICreateNodeResult,
} from "../../application/nodes/CreateNodeUseCase";
import {
  ConnectNodesUseCase,
  type IConnectNodesRequest,
  type IConnectNodesResult,
} from "../../application/nodes/ConnectNodesUseCase";
import {
  ListAvailableNodesUseCase,
  type IListAvailableNodesRequest,
  type IListAvailableNodesResult,
} from "../../application/nodes/ListAvailableNodesUseCase";

export interface INodeServiceOptions {
  readonly createNodeUseCase: CreateNodeUseCase;
  readonly connectNodesUseCase: ConnectNodesUseCase;
  readonly listAvailableNodesUseCase: ListAvailableNodesUseCase;
  readonly nodeCatalogProvider: INodeCatalogProvider;
}

export class NodeService {
  private readonly createNodeUseCase: CreateNodeUseCase;
  private readonly connectNodesUseCase: ConnectNodesUseCase;
  private readonly listAvailableNodesUseCase: ListAvailableNodesUseCase;
  private readonly nodeCatalogProvider: INodeCatalogProvider;

  constructor(options: INodeServiceOptions) {
    this.createNodeUseCase = options.createNodeUseCase;
    this.connectNodesUseCase = options.connectNodesUseCase;
    this.listAvailableNodesUseCase = options.listAvailableNodesUseCase;
    this.nodeCatalogProvider = options.nodeCatalogProvider;
  }

  public async listAvailableNodes(
    criteria?: INodeCatalogSearchCriteria
  ): Promise<ReadonlyArray<INodeDefinition>> {
    const request: IListAvailableNodesRequest = { criteria };
    const result: IListAvailableNodesResult =
      await this.listAvailableNodesUseCase.execute(request);

    return result.definitions;
  }

  public async getDefinitionById(id: string): Promise<INodeDefinition | undefined> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("NodeService.getDefinitionById requires a non-empty id.");
    }

    return this.nodeCatalogProvider.getDefinitionById(normalizedId);
  }

  public async getDefinitionByType(
    type: string
  ): Promise<INodeDefinition | undefined> {
    const normalizedType = type.trim();

    if (!normalizedType) {
      throw new Error("NodeService.getDefinitionByType requires a non-empty type.");
    }

    return this.nodeCatalogProvider.getDefinitionByType(normalizedType);
  }

  public async getCategories(): Promise<ReadonlyArray<string>> {
    return this.nodeCatalogProvider.getCategories();
  }

  public async createNode(
    request: ICreateNodeRequest
  ): Promise<ICreateNodeResult> {
    return this.createNodeUseCase.execute(request);
  }

  public connectNodes(request: IConnectNodesRequest): IConnectNodesResult {
    return this.connectNodesUseCase.execute(request);
  }

  public removeNode(workflow: IWorkflow, nodeId: string): IWorkflow {
    const normalizedNodeId = nodeId.trim();

    if (!normalizedNodeId) {
      throw new Error("NodeService.removeNode requires a nodeId.");
    }

    return workflow.removeNode(normalizedNodeId);
  }

  public removeConnection(workflow: IWorkflow, connectionId: string): IWorkflow {
    const normalizedConnectionId = connectionId.trim();

    if (!normalizedConnectionId) {
      throw new Error("NodeService.removeConnection requires a connectionId.");
    }

    return workflow.removeConnection(normalizedConnectionId);
  }

  public moveNode(
    workflow: IWorkflow,
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ): IWorkflow {
    const node = this.requireNode(workflow, nodeId);
    return workflow.updateNode(node.withPosition(position));
  }

  public resizeNode(
    workflow: IWorkflow,
    nodeId: string,
    size: { readonly width: number; readonly height: number }
  ): IWorkflow {
    const node = this.requireNode(workflow, nodeId);
    return workflow.updateNode(node.withSize(size));
  }

  public renameNode(workflow: IWorkflow, nodeId: string, title: string): IWorkflow {
    const node = this.requireNode(workflow, nodeId);
    return workflow.updateNode(node.withTitle(title.trim()));
  }

  public setNodeNotes(
    workflow: IWorkflow,
    nodeId: string,
    notes: string | undefined
  ): IWorkflow {
    const node = this.requireNode(workflow, nodeId);
    return workflow.updateNode(node.withNotes(notes?.trim() || ""));
  }

  public setNodeEnabled(
    workflow: IWorkflow,
    nodeId: string,
    isEnabled: boolean
  ): IWorkflow {
    const node = this.requireNode(workflow, nodeId);
    return workflow.updateNode(node.withEnabled(isEnabled));
  }

  public setNodeCollapsed(
    workflow: IWorkflow,
    nodeId: string,
    isCollapsed: boolean
  ): IWorkflow {
    const node = this.requireNode(workflow, nodeId);
    return workflow.updateNode(node.withCollapsed(isCollapsed));
  }

  public getNode(workflow: IWorkflow, nodeId: string): INode | undefined {
    return workflow.getNode(nodeId.trim());
  }

  public getConnection(
    workflow: IWorkflow,
    connectionId: string
  ): IWorkflowConnection | undefined {
    return workflow.getConnection(connectionId.trim());
  }

  private requireNode(workflow: IWorkflow, nodeId: string): INode {
    const normalizedNodeId = nodeId.trim();

    if (!normalizedNodeId) {
      throw new Error("NodeService requires a non-empty nodeId.");
    }

    const node = workflow.getNode(normalizedNodeId);

    if (!node) {
      throw new Error(`Node '${normalizedNodeId}' was not found.`);
    }

    return node;
  }
}
