import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { ToolDefinition } from "./models/ToolDefinition";
import { WorkflowApplicationProjectionService } from "./WorkflowApplicationProjectionService";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface WorkflowToolIdentity {
  readonly id: string;
  readonly slug: string;
}

export class WorkflowToolProjectionService {
  public constructor(
    private readonly applicationProjectionService: WorkflowApplicationProjectionService =
      new WorkflowApplicationProjectionService()
  ) {}

  /**
   * Tool identity stays workflow-derived:
   * - id: stable internal identifier, always the workflow id.
   * - slug: route-friendly published identifier from metadata.toolSlug when present,
   *   otherwise derived from the published title/name, with workflow id as the final fallback.
   */
  public resolveToolIdentity(workflow: IWorkflow): WorkflowToolIdentity {
    const title = workflow.metadata.toolTitle ?? workflow.metadata.name;
    const slug =
      slugify(workflow.metadata.toolSlug ?? "") ||
      slugify(title) ||
      slugify(workflow.id) ||
      workflow.id;

    return {
      id: workflow.id,
      slug,
    };
  }

  public projectToTool(workflow: IWorkflow): ToolDefinition {
    const title = workflow.metadata.toolTitle ?? workflow.metadata.name;
    const identity = this.resolveToolIdentity(workflow);

    return {
      id: identity.id,
      workflowId: workflow.id,
      slug: identity.slug,
      title,
      description: workflow.metadata.toolDescription ?? workflow.metadata.description,
      category: workflow.metadata.toolCategory,
      sections: this.applicationProjectionService.projectSections(workflow, "tool"),
    };
  }

  public applyToolInput(workflow: IWorkflow, values: Readonly<Record<string, unknown>>): IWorkflow {
    return this.applicationProjectionService.applyInput(workflow, values);
  }
}

