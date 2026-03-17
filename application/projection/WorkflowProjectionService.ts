import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { FormField } from "./models/FormField";
import type { FormSchema } from "./models/FormSchema";
import type { FormSection } from "./models/FormSection";

export class WorkflowProjectionService {
  public projectToForm(workflow: IWorkflow): FormSchema {
    const sections = new Map<string, FormSection>();

    for (const node of workflow.nodes) {
      for (const property of node.properties) {
        const visibility = property.projection?.authorVisibility ?? (property.isAdvanced ? "advanced" : "basic");
        const expose = property.projection?.exposeInAuthorForm ?? visibility !== "hidden";

        if (!expose) {
          continue;
        }

        const sectionId = property.projection?.group ?? node.id;
        const existing = sections.get(sectionId) ?? {
          id: sectionId,
          title: property.projection?.group ?? node.title ?? node.definition.title,
          description: node.notes,
          order: node.position?.y ?? 0,
          fields: [],
        };

        const field: FormField = {
          id: `${node.id}.${property.id}`,
          nodeId: node.id,
          propertyId: property.id,
          label: property.projection?.label ?? property.name,
          description: property.projection?.description ?? property.description,
          type: property.projection?.fieldTypeHint ?? property.type,
          required: Boolean(property.constraints?.required),
          order: property.projection?.order ?? property.order,
          sectionId,
          defaultValue: property.defaultValue,
          value: property.value,
          options: property.options,
          visibility,
        };

        sections.set(sectionId, {
          ...existing,
          fields: [...existing.fields, field].sort((a, b) => a.order - b.order),
        });
      }
    }

    return {
      workflowId: workflow.id,
      title: workflow.metadata.name,
      description: workflow.metadata.description,
      sections: [...sections.values()].sort((a, b) => a.order - b.order),
    };
  }

  public applyFormInput(
    workflow: IWorkflow,
    values: Readonly<Record<string, unknown>>
  ): IWorkflow {
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
