import type {
  IWorkflow,
  IWorkflowAuditInfo,
  IWorkflowMetadata,
  IWorkflowRuntimeProfile,
  WorkflowExecutionPolicy,
  WorkflowStatus,
} from "@domain/workflows/interfaces/IWorkflow";
import type { INode } from "@domain/nodes/interfaces/INode";
import type { IWorkflowConnection } from "@domain/workflows/interfaces/IWorkflowConnection";
import { Workflow } from "@domain/workflows/Workflow";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "@domain/workflows/WorkflowMetadata";

export interface ICreateWorkflowRequest {
  readonly id?: string;
  readonly metadata: IWorkflowMetadata;
  readonly status?: WorkflowStatus;
  readonly isEnabled?: boolean;
  readonly runtimeProfile?: IWorkflowRuntimeProfile;
  readonly executionPolicy?: WorkflowExecutionPolicy;
  readonly audit?: IWorkflowAuditInfo;
  readonly nodes?: ReadonlyArray<INode>;
  readonly connections?: ReadonlyArray<IWorkflowConnection>;
  readonly validateOnCreate?: boolean;
}

export interface ICreateWorkflowResult {
  readonly workflow: IWorkflow;
}

export class CreateWorkflowUseCase {
  private readonly createId: () => string;

  constructor(createId?: () => string) {
    this.createId = createId ?? defaultIdFactory;
  }

  public execute(request: ICreateWorkflowRequest): ICreateWorkflowResult {
    const workflow = new Workflow({
      id: request.id?.trim() || this.createId(),
      metadata: WorkflowMetadata.from(request.metadata),
      status: request.status ?? "draft",
      isEnabled: request.isEnabled ?? true,
      runtimeProfile: WorkflowRuntimeProfile.from(request.runtimeProfile),
      executionPolicy: request.executionPolicy ?? "acyclic-only",
      audit:
        WorkflowAuditInfo.from(request.audit) ??
        new WorkflowAuditInfo().touch(),
      nodes: request.nodes ?? [],
      connections: request.connections ?? [],
    });

    if (request.validateOnCreate) {
      const validation = workflow.validate();

      if (!validation.isValid) {
        throw new Error(
          `Workflow creation failed validation: ${validation.messages.join(" | ")}`
        );
      }
    }

    return Object.freeze({ workflow });
  }
}

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

