import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { ToolDefinition } from "./models/ToolDefinition";
import type { ToolSection } from "./models/ToolSection";

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export class WorkflowToolProjectionService {
  public projectToTool(workflow: IWorkflow): ToolDefinition {
    const sections = new Map<string, ToolSection>();

    for (const node of workflow.nodes) {
      for (const property of node.properties) {
        const visibility = property.projection?.toolVisibility ?? (property.isAdvanced ? "advanced" : "basic");
        const expose = property.projection?.exposeInTool ?? visibility !== "hidden";

        if (!expose) {
          continue;
        }

        const sectionId = property.projection?.group ?? node.id;
        const existing = sections.get(sectionId) ?? {
          id: sectionId,
          title: property.projection?.group ?? node.title ?? node.definition.title,
          order: node.position?.y ?? 0,
          fields: [],
        };

        sections.set(sectionId, {
          ...existing,
          fields: [
            ...existing.fields,
            {
              id: `${node.id}.${property.id}`,
              nodeId: node.id,
              propertyId: property.id,
              label: property.projection?.label ?? property.name,
              description: property.projection?.description ?? property.description,
              type: property.projection?.fieldTypeHint ?? property.type,
              required: Boolean(property.constraints?.required),
              order: property.projection?.order ?? property.order,
              defaultValue: property.defaultValue,
              value: property.value,
              options: property.options,
              visibility,
            },
          ].sort((a, b) => a.order - b.order),
        });
      }
    }

    const title = workflow.metadata.toolTitle ?? workflow.metadata.name;

    return {
      id: workflow.metadata.toolSlug ?? slugify(workflow.id),
      workflowId: workflow.id,
      slug: workflow.metadata.toolSlug ?? slugify(title),
      title,
      description: workflow.metadata.toolDescription ?? workflow.metadata.description,
      category: workflow.metadata.toolCategory,
      sections: [...sections.values()].sort((a, b) => a.order - b.order),
    };
  }

  public applyToolInput(workflow: IWorkflow, values: Readonly<Record<string, unknown>>): IWorkflow {
    let updated = workflow;
    for (const [key, value] of Object.entries(values)) {
      const [nodeId, propertyId] = key.split(".");
      if (!nodeId || !propertyId) {
        continue;
      }
      const node = updated.getNode(nodeId);
      if (!node || !node.getProperty(propertyId)) {
        continue;
      }
      updated = updated.updateNode(node.withPropertyValue(propertyId, value));
    }
    return updated;
  }
}
