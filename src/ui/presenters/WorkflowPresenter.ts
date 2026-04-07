import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { IWorkflowExecutionEvent } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IWorkflowValidationResult } from "../../domain/services/interfaces/IWorkflowValidator";
import type { WorkflowResponse } from "../../application/dto/WorkflowResponse";
import { ValidationPresenter, type ValidationSummaryViewModel } from "./ValidationPresenter";
import { NodePresenter, type NodeDetailViewModel } from "./NodePresenter";
import { toTitleCase } from "./PresenterFormatting";

export interface WorkflowHeaderViewModel {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly isEnabled: boolean;
  readonly isExecutable: boolean;
  readonly isDirty?: boolean;
  readonly selectedNodeId?: string;
  readonly selectedConnectionId?: string;
  readonly executionState?: string;
}

export interface WorkflowListItemViewModel {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly nodeCount: number;
  readonly connectionCount: number;
  readonly isEnabled: boolean;
  readonly isExecutable: boolean;
  readonly hasCycles: boolean;
}

export interface WorkflowEditorViewModel {
  readonly header: WorkflowHeaderViewModel;
  readonly workflow: WorkflowResponse;
  readonly selectedNode?: NodeDetailViewModel;
  readonly validation: ValidationSummaryViewModel;
}

export class WorkflowPresenter {
  private readonly validationPresenter: ValidationPresenter;
  private readonly nodePresenter: NodePresenter;

  constructor(
    validationPresenter?: ValidationPresenter,
    nodePresenter?: NodePresenter
  ) {
    this.validationPresenter = validationPresenter ?? new ValidationPresenter();
    this.nodePresenter = nodePresenter ?? new NodePresenter();
  }

  public present(
    workflow: IWorkflow,
    options: {
      readonly validation?: IWorkflowValidationResult;
      readonly selectedNodeId?: string;
      readonly selectedConnectionId?: string;
      readonly isDirty?: boolean;
      readonly lastExecutionEvent?: IWorkflowExecutionEvent;
    } = {}
  ): WorkflowEditorViewModel {
    const selectedNode = options.selectedNodeId
      ? workflow.getNode(options.selectedNodeId)
      : undefined;

    return Object.freeze({
      header: this.presentHeader(workflow, {
        validation: options.validation,
        isDirty: options.isDirty,
        selectedNodeId: options.selectedNodeId,
        selectedConnectionId: options.selectedConnectionId,
        lastExecutionEvent: options.lastExecutionEvent,
      }),
      workflow: this.toResponse(workflow, options.validation),
      selectedNode: selectedNode
        ? this.nodePresenter.presentNode(selectedNode)
        : undefined,
      validation: this.validationPresenter.present(options.validation),
    });
  }

  public presentHeader(
    workflow: IWorkflow,
    options: {
      readonly validation?: IWorkflowValidationResult;
      readonly isDirty?: boolean;
      readonly selectedNodeId?: string;
      readonly selectedConnectionId?: string;
      readonly lastExecutionEvent?: IWorkflowExecutionEvent;
    } = {}
  ): WorkflowHeaderViewModel {
    const isExecutable =
      options.validation?.isValid !== undefined
        ? workflow.isEnabled && options.validation.isValid
        : workflow.isExecutable();

    return Object.freeze({
      id: workflow.id,
      title: workflow.metadata.name,
      description: workflow.metadata.description,
      status: toTitleCase(workflow.status),
      isEnabled: workflow.isEnabled,
      isExecutable,
      isDirty: options.isDirty,
      selectedNodeId: options.selectedNodeId,
      selectedConnectionId: options.selectedConnectionId,
      executionState: options.lastExecutionEvent
        ? toTitleCase(options.lastExecutionEvent.status)
        : undefined,
    });
  }

  public presentList(
    workflows: ReadonlyArray<IWorkflow>
  ): ReadonlyArray<WorkflowListItemViewModel> {
    return Object.freeze(workflows.map((workflow) => this.presentListItem(workflow)));
  }

  public presentListItem(workflow: IWorkflow): WorkflowListItemViewModel {
    const graph = workflow.toGraph();

    return Object.freeze({
      id: workflow.id,
      title: workflow.metadata.name,
      description: workflow.metadata.description,
      status: toTitleCase(workflow.status),
      nodeCount: workflow.nodes.length,
      connectionCount: workflow.connections.length,
      isEnabled: workflow.isEnabled,
      isExecutable: workflow.isExecutable(),
      hasCycles: graph.hasCycles(),
    });
  }

  public toResponse(
    workflow: IWorkflow,
    validation?: IWorkflowValidationResult
  ): WorkflowResponse {
    const graph = workflow.toGraph();
    const effectiveValidation = validation ?? workflow.validate();

    return Object.freeze({
      id: workflow.id,
      metadata: Object.freeze({
        name: workflow.metadata.name,
        description: workflow.metadata.description,
        author: workflow.metadata.author,
        tags: workflow.metadata.tags,
        version: workflow.metadata.version,
      }),
      status: workflow.status,
      isEnabled: workflow.isEnabled,
      executionPolicy: workflow.executionPolicy,
      runtimeProfile: workflow.runtimeProfile
        ? Object.freeze({
            preferredRuntime: workflow.runtimeProfile.preferredRuntime,
            allowedRuntimes: workflow.runtimeProfile.allowedRuntimes,
          })
        : undefined,
      audit: workflow.audit
        ? Object.freeze({
            createdAt: workflow.audit.createdAt?.toISOString(),
            updatedAt: workflow.audit.updatedAt?.toISOString(),
          })
        : undefined,
      nodes: Object.freeze(
        workflow.nodes.map((node) =>
          Object.freeze({
            id: node.id,
            definitionId: node.definition.id,
            definitionType: node.definition.type,
            definitionTitle: node.definition.title,
            category: node.definition.category,
            executionKind: node.definition.executionKind,
            title: node.title,
            notes: node.notes,
            position: node.position
              ? Object.freeze({
                  x: node.position.x,
                  y: node.position.y,
                })
              : undefined,
            size: node.size
              ? Object.freeze({
                  width: node.size.width,
                  height: node.size.height,
                })
              : undefined,
            properties: Object.freeze(
              [...node.properties]
                .sort((left, right) => left.order - right.order)
                .map((property) =>
                  Object.freeze({
                    id: property.id,
                    name: property.name,
                    type: property.type,
                    value: property.value,
                    isAdvanced: property.isAdvanced,
                    isEditable: property.isEditable,
                    isPersisted: property.isPersisted,
                    order: property.order,
                  })
                )
            ),
            inputPorts: Object.freeze(
              [...node.inputPorts]
                .sort((left, right) => left.order - right.order)
                .map((port) =>
                  Object.freeze({
                    id: port.id,
                    name: port.name,
                    direction: port.direction,
                    cardinality: port.cardinality,
                    isControlPort: port.isControlPort,
                    order: port.order,
                    valueTypes: Object.freeze([...(port.compatibility.valueTypes ?? [])]),
                  })
                )
            ),
            outputPorts: Object.freeze(
              [...node.outputPorts]
                .sort((left, right) => left.order - right.order)
                .map((port) =>
                  Object.freeze({
                    id: port.id,
                    name: port.name,
                    direction: port.direction,
                    cardinality: port.cardinality,
                    isControlPort: port.isControlPort,
                    order: port.order,
                    valueTypes: Object.freeze([...(port.compatibility.valueTypes ?? [])]),
                  })
                )
            ),
            executionProfile: node.executionProfile
              ? Object.freeze({
                  runtime: node.executionProfile.runtime,
                  tasks: node.executionProfile.tasks,
                })
              : undefined,
            isEnabled: node.isEnabled,
            isCollapsed: node.isCollapsed,
            isExecutable: node.isExecutable(),
            isModelAware: node.isModelAware(),
          })
        )
      ),
      connections: Object.freeze(
        workflow.connections.map((connection) =>
          Object.freeze({
            id: connection.id,
            source: Object.freeze({
              nodeId: connection.source.nodeId,
              portId: connection.source.portId,
            }),
            target: Object.freeze({
              nodeId: connection.target.nodeId,
              portId: connection.target.portId,
            }),
            kind: connection.kind,
            state: connection.state,
            isEnabled: connection.isEnabled,
            order: connection.order,
            metadata: connection.metadata
              ? Object.freeze({
                  label: connection.metadata.label,
                  description: connection.metadata.description,
                  tags: connection.metadata.tags,
                })
              : undefined,
          })
        )
      ),
      graph: Object.freeze({
        entryNodeIds: Object.freeze(graph.getEntryNodes().map((node) => node.id)),
        exitNodeIds: Object.freeze(graph.getExitNodes().map((node) => node.id)),
        hasCycles: graph.hasCycles(),
      }),
      validation: Object.freeze({
        isValid: effectiveValidation.isValid,
        messages: Object.freeze(
          effectiveValidation.messages.map((message) =>
            Object.freeze({
              code: message.code,
              severity: message.severity,
              scope: message.scope,
              message: message.message,
              target: message.target
                ? Object.freeze({
                    workflowId: message.target.workflowId,
                    nodeId: message.target.nodeId,
                    connectionId: message.target.connectionId,
                    portId: message.target.portId,
                    propertyId: message.target.propertyId,
                  })
                : undefined,
            })
          )
        ),
        invalidNodeIds: Object.freeze([...(effectiveValidation.invalidNodeIds ?? [])]),
        invalidConnectionIds: Object.freeze([
          ...(effectiveValidation.invalidConnectionIds ?? []),
        ]),
      }),
      isExecutable: workflow.isEnabled && effectiveValidation.isValid,
    });
  }
}
