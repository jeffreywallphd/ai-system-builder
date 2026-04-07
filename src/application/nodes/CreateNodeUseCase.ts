import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { INodeDefinition } from "../../../domain/nodes/interfaces/INodeDefinition";
import type { INodeExecutionProfile, INodePosition, INodeSize } from "../../../domain/nodes/interfaces/INode";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { INodeCatalogProvider } from "../ports/interfaces/INodeCatalogProvider";

export interface ICreateNodeRequest {
  readonly workflow: IWorkflow;
  readonly definitionId?: string;
  readonly definitionType?: string;
  readonly nodeId?: string;
  readonly title?: string;
  readonly notes?: string;
  readonly position?: INodePosition;
  readonly size?: INodeSize;
  readonly propertyValues?: Readonly<Record<string, unknown>>;
  readonly executionProfile?: INodeExecutionProfile;
  readonly isEnabled?: boolean;
  readonly isCollapsed?: boolean;
  /**
   * Whether to validate the node before adding it to the workflow.
   * Defaults to false so users can place nodes and fix required fields later.
   */
  readonly validateNode?: boolean;
}

export interface ICreateNodeResult {
  readonly workflow: IWorkflow;
  readonly node: INode;
  readonly definition: INodeDefinition;
}

export class CreateNodeUseCase {
  private readonly nodeCatalogProvider: INodeCatalogProvider;
  private readonly createId: () => string;

  constructor(
    nodeCatalogProvider: INodeCatalogProvider,
    createId?: () => string
  ) {
    this.nodeCatalogProvider = nodeCatalogProvider;
    this.createId = createId ?? defaultIdFactory;
  }

  public async execute(request: ICreateNodeRequest): Promise<ICreateNodeResult> {
    const definition = await this.resolveDefinition(request);

    const nodeId = request.nodeId?.trim() || this.createId();

    if (request.workflow.hasNode(nodeId)) {
      throw new Error(`Workflow already contains node '${nodeId}'.`);
    }

    let node = definition.createInstance(nodeId);

    if (request.title?.trim()) {
      node = node.withTitle(request.title.trim());
    }

    if (request.notes?.trim()) {
      node = node.withNotes(request.notes.trim());
    }

    if (request.position) {
      node = node.withPosition(request.position);
    }

    if (request.size) {
      node = node.withSize(request.size);
    }

    if (request.executionProfile) {
      node = node.withExecutionProfile(request.executionProfile);
    }

    if (request.isEnabled !== undefined) {
      node = node.withEnabled(request.isEnabled);
    }

    if (request.isCollapsed !== undefined) {
      node = node.withCollapsed(request.isCollapsed);
    }

    if (request.propertyValues) {
      for (const [propertyId, value] of Object.entries(request.propertyValues)) {
        if (!node.getProperty(propertyId)) {
          throw new Error(
            `Node definition '${definition.type}' does not contain property '${propertyId}'.`
          );
        }

        node = node.withPropertyValue(propertyId, value);
      }
    }

    if (request.validateNode ?? false) {
      const validation = node.validate();

      if (!validation.isValid) {
        throw new Error(
          `Created node '${node.id}' is invalid: ${validation.messages.join(" | ")}`
        );
      }
    }

    const workflow = request.workflow.addNode(node);

    return Object.freeze({
      workflow,
      node,
      definition,
    });
  }

  private async resolveDefinition(
    request: ICreateNodeRequest
  ): Promise<INodeDefinition> {
    if (request.definitionId?.trim()) {
      const definition = await this.nodeCatalogProvider.getDefinitionById(
        request.definitionId.trim()
      );

      if (!definition) {
        throw new Error(
          `Node definition '${request.definitionId.trim()}' was not found.`
        );
      }

      return definition;
    }

    if (request.definitionType?.trim()) {
      const definition = await this.nodeCatalogProvider.getDefinitionByType(
        request.definitionType.trim()
      );

      if (!definition) {
        throw new Error(
          `Node definition type '${request.definitionType.trim()}' was not found.`
        );
      }

      return definition;
    }

    throw new Error(
      "CreateNodeUseCase requires either definitionId or definitionType."
    );
  }
}

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
