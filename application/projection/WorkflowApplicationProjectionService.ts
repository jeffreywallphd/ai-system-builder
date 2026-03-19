import type { INodeProperty, PropertyVisibilityLevel } from "../../domain/nodes/interfaces/INodeProperty";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { ProjectedField } from "./models/ProjectedField";
import type { ProjectedSection } from "./models/ProjectedSection";

export type WorkflowProjectionSurface = "author" | "tool";

function resolveVisibility(
  property: INodeProperty,
  surface: WorkflowProjectionSurface
): PropertyVisibilityLevel {
  if (surface === "tool") {
    return property.projection?.toolVisibility ?? (property.isAdvanced ? "advanced" : "basic");
  }

  return property.projection?.authorVisibility ?? (property.isAdvanced ? "advanced" : "basic");
}

function shouldExpose(property: INodeProperty, surface: WorkflowProjectionSurface): boolean {
  const visibility = resolveVisibility(property, surface);

  if (surface === "tool") {
    return property.projection?.exposeInTool ?? visibility !== "hidden";
  }

  return property.projection?.exposeInAuthorForm ?? visibility !== "hidden";
}

function toProjectedField(
  nodeId: string,
  property: INodeProperty,
  sectionId: string,
  surface: WorkflowProjectionSurface
): ProjectedField {
  return Object.freeze({
    id: `${nodeId}.${property.id}`,
    nodeId,
    propertyId: property.id,
    label: property.projection?.label ?? property.name,
    description: property.projection?.description ?? property.description,
    type: property.projection?.fieldTypeHint ?? property.type,
    required: Boolean(property.constraints?.required),
    isEditable: property.isEditable,
    order: property.projection?.order ?? property.order,
    sectionId,
    defaultValue: property.defaultValue,
    value: property.value,
    options: property.options,
    visibility: resolveVisibility(property, surface),
    min: property.constraints?.range?.min ?? property.constraints?.min,
    max: property.constraints?.range?.max ?? property.constraints?.max,
    step: property.constraints?.range?.step,
    shouldClampToRange: property.constraints?.range?.clamp ?? false,
  });
}

export class WorkflowApplicationProjectionService {
  public projectSections(
    workflow: IWorkflow,
    surface: WorkflowProjectionSurface
  ): ReadonlyArray<ProjectedSection> {
    const sections = new Map<string, ProjectedSection>();

    for (const node of workflow.nodes) {
      for (const property of node.properties) {
        if (!shouldExpose(property, surface)) {
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

        sections.set(sectionId, {
          ...existing,
          fields: [...existing.fields, toProjectedField(node.id, property, sectionId, surface)].sort(
            (left, right) => left.order - right.order
          ),
        });
      }
    }

    return Object.freeze([...sections.values()].sort((left, right) => left.order - right.order));
  }

  public applyInput(
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
