import type { IWorkflowRepository } from "@application/ports/interfaces/IWorkflowRepository";
import type { IToolCapabilityCatalog } from "@application/ports/interfaces/IToolCapabilityCatalog";
import { WorkflowToolProjectionService } from "@application/projection/WorkflowToolProjectionService";
import type { ToolCapabilityDescriptor } from "@application/tools/models/ToolCapabilityDescriptor";
import {
  buildToolCapabilityId,
  createToolCapabilityDescriptor,
} from "@application/tools/models/ToolCapabilityDescriptor";
import type { ProjectedField } from "@application/projection/models/ProjectedField";

export const WORKFLOW_TOOL_CAPABILITY_PROVIDER = Object.freeze({
  kind: "workflow",
  id: "workflow-projection",
  label: "Workflow Tools",
} as const);

function toJsonSchemaType(field: ProjectedField): string {
  switch (field.type) {
    case "number":
    case "range":
      return "number";
    case "toggle":
      return "boolean";
    case "json":
      return "object";
    case "multiselect":
      return "array";
    default:
      return "string";
  }
}

function buildInputSchema(fields: ReadonlyArray<ProjectedField>): Readonly<Record<string, unknown>> {
  const properties = Object.fromEntries(
    fields.map((field) => {
      const property: Record<string, unknown> = {
        type: toJsonSchemaType(field),
        title: field.label,
      };

      if (field.description) {
        property.description = field.description;
      }
      if (field.defaultValue !== undefined) {
        property.default = field.defaultValue;
      }
      if (field.options && field.options.length > 0) {
        property.enum = field.options.map((option) => option.value);
      }
      if (field.min !== undefined) {
        property.minimum = field.min;
      }
      if (field.max !== undefined) {
        property.maximum = field.max;
      }

      return [field.id, Object.freeze(property)];
    })
  );

  return Object.freeze({
    type: "object",
    properties: Object.freeze(properties),
    required: Object.freeze(fields.filter((field) => field.required).map((field) => field.id)),
  });
}

export class WorkflowProjectedToolCapabilityCatalog implements IToolCapabilityCatalog {
  constructor(
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowToolProjectionService: WorkflowToolProjectionService
  ) {}

  public async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
    const summaries = await this.workflowRepository.list();
    const capabilities: ToolCapabilityDescriptor[] = [];

    for (const summary of summaries) {
      let workflow;
      try {
        workflow = await this.workflowRepository.load(summary.id);
      } catch {
        continue;
      }
      if (!workflow) {
        continue;
      }

      const definition = this.workflowToolProjectionService.projectToTool(workflow);
      const fields = definition.sections.flatMap((section) => [...section.fields]);
      capabilities.push(
        createToolCapabilityDescriptor({
          id: buildToolCapabilityId("workflow", definition.workflowId),
          identity: Object.freeze({
            stableId: definition.id,
            providerScopedId: definition.workflowId,
          }),
          routingName: definition.slug ?? definition.title,
          displayName: definition.title,
          description: definition.description,
          provider: WORKFLOW_TOOL_CAPABILITY_PROVIDER,
          source: Object.freeze({
            kind: "workflow",
            workflowId: definition.workflowId,
            workflowToolId: definition.id,
            workflowToolSlug: definition.slug,
          }),
          publication: Object.freeze({
            isPublished: true,
            title: definition.title,
            description: definition.description,
            category: definition.category,
            slug: definition.slug,
          }),
          inputSchema: buildInputSchema(fields),
          metadata: Object.freeze({
            sectionCount: definition.sections.length,
            fieldCount: fields.length,
          }),
        })
      );
    }

    return Object.freeze(capabilities);
  }
}

