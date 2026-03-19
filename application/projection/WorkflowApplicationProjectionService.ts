import type { INodeProperty, PropertyVisibilityLevel } from "../../domain/nodes/interfaces/INodeProperty";
import type {
  IWorkflow,
  IWorkflowContextConfiguration,
  IWorkflowContextPackageReference,
} from "../../domain/workflows/interfaces/IWorkflow";
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
    presentation: "default",
  });
}

function normalizeContextPackageReferences(
  references: unknown
): ReadonlyArray<IWorkflowContextPackageReference> {
  if (!Array.isArray(references)) {
    return Object.freeze([]);
  }

  const deduped = new Map<string, IWorkflowContextPackageReference>();

  for (const entry of references) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const packageId = typeof record.packageId === "string" ? record.packageId.trim() : "";
    if (!packageId || deduped.has(packageId)) {
      continue;
    }

    const normalizeArray = (candidate: unknown): ReadonlyArray<string> | undefined => {
      if (!Array.isArray(candidate)) {
        return undefined;
      }

      const values = [
        ...new Set(candidate.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)),
      ];
      return values.length > 0 ? Object.freeze(values) : undefined;
    };

    deduped.set(
      packageId,
      Object.freeze({
        packageId,
        alias: typeof record.alias === "string" && record.alias.trim() ? record.alias.trim() : undefined,
        version: typeof record.version === "string" && record.version.trim() ? record.version.trim() : undefined,
        includeFragmentIds: normalizeArray(record.includeFragmentIds),
        excludeFragmentIds: normalizeArray(record.excludeFragmentIds),
        isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : true,
      })
    );
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeSelectedPackageIds(
  values: unknown,
  packageReferences: ReadonlyArray<IWorkflowContextPackageReference>
): ReadonlyArray<string> {
  const requestedIds = Array.isArray(values)
    ? [...new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))]
    : packageReferences
        .filter((reference) => reference.isEnabled !== false)
        .map((reference) => reference.packageId);

  const enabledReferences = packageReferences.filter((reference) => reference.isEnabled !== false);
  return Object.freeze(
    enabledReferences
      .filter((reference) => requestedIds.includes(reference.packageId))
      .map((reference) => reference.packageId)
  );
}

function parseStringArray(value: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : undefined;
  }

  return undefined;
}

function createNextContextConfiguration(
  existing: IWorkflowContextConfiguration | undefined,
  patch: Partial<IWorkflowContextConfiguration>
): IWorkflowContextConfiguration {
  const nextPackageReferences = patch.packageReferences
    ? normalizeContextPackageReferences(patch.packageReferences)
    : existing?.packageReferences ?? Object.freeze([]);
  const selectedPackageIds = normalizeSelectedPackageIds(
    patch.selectedPackageIds ?? existing?.selectedPackageIds,
    nextPackageReferences
  );

  return {
    ...existing,
    ...patch,
    packageReferences: nextPackageReferences,
    selectedPackageIds,
  };
}

function appendContextSection(
  sections: Map<string, ProjectedSection>,
  workflow: IWorkflow,
  surface: WorkflowProjectionSurface
): void {
  const contextConfiguration = workflow.metadata.contextConfiguration;
  const packageReferences = normalizeContextPackageReferences(contextConfiguration?.packageReferences);

  if (!contextConfiguration && packageReferences.length === 0) {
    return;
  }

  const enabledPackageReferences = packageReferences.filter((reference) => reference.isEnabled !== false);
  const packageOptions = enabledPackageReferences.map((reference) => ({
    label: reference.alias ?? reference.packageId,
    value: reference.packageId,
  }));
  const selectedPackageIds = normalizeSelectedPackageIds(
    contextConfiguration?.selectedPackageIds,
    packageReferences
  );
  const contextFields: ProjectedField[] = [];

  if (surface === "author") {
    contextFields.push(
      Object.freeze({
        id: "workflow.context.packageReferences",
        nodeId: "workflow",
        propertyId: "context.packageReferences",
        label: "Context packages",
        description: "Attach reusable context packages in the exact order they should be assembled, with aliases and fragment filters.",
        type: "generic",
        required: false,
        isEditable: true,
        order: 0,
        sectionId: "workflow-context",
        value: packageReferences,
        visibility: "basic",
        shouldClampToRange: false,
        presentation: "context-package-references",
      }),
      Object.freeze({
        id: "workflow.context.selectedPackageIds",
        nodeId: "workflow",
        propertyId: "context.selectedPackageIds",
        label: "Default package selection",
        description: "Choose which enabled packages are selected by default when authors or tools run this workflow.",
        type: "multi-select",
        required: false,
        isEditable: true,
        order: 1,
        sectionId: "workflow-context",
        value: selectedPackageIds,
        options: packageOptions,
        visibility: "basic",
        shouldClampToRange: false,
        presentation: "context-package-selection",
      }),
      Object.freeze({
        id: "workflow.context.visibilityMode",
        nodeId: "workflow",
        propertyId: "context.visibilityMode",
        label: "Visible context detail",
        description: "Allow only reader-safe context or include advanced fragments too.",
        type: "select",
        required: false,
        isEditable: true,
        order: 2,
        sectionId: "workflow-context",
        value: contextConfiguration?.visibilityMode ?? "advanced",
        options: Object.freeze([
          { label: "Reader-safe", value: "basic" },
          { label: "Full author detail", value: "advanced" },
        ]),
        visibility: "basic",
        shouldClampToRange: false,
        presentation: "context-visibility",
      }),
      Object.freeze({
        id: "workflow.context.maxCharacters",
        nodeId: "workflow",
        propertyId: "context.maxCharacters",
        label: "Character budget",
        description: "Approximate maximum number of characters reserved for assembled context.",
        type: "integer",
        required: false,
        isEditable: true,
        order: 3,
        sectionId: "workflow-context",
        value: contextConfiguration?.maxCharacters,
        visibility: "advanced",
        min: 0,
        step: 1,
        shouldClampToRange: true,
        presentation: "default",
      }),
      Object.freeze({
        id: "workflow.context.maxTokens",
        nodeId: "workflow",
        propertyId: "context.maxTokens",
        label: "Token budget",
        description: "Approximate maximum number of tokens reserved for assembled context.",
        type: "integer",
        required: false,
        isEditable: true,
        order: 4,
        sectionId: "workflow-context",
        value: contextConfiguration?.maxTokens,
        visibility: "advanced",
        min: 0,
        step: 1,
        shouldClampToRange: true,
        presentation: "default",
      }),
      Object.freeze({
        id: "workflow.context.trimPartialFragments",
        nodeId: "workflow",
        propertyId: "context.trimPartialFragments",
        label: "Allow partial fragment trim",
        description: "Allow the final fragment to be shortened to fit the remaining context budget.",
        type: "boolean",
        required: false,
        isEditable: true,
        order: 5,
        sectionId: "workflow-context",
        value: contextConfiguration?.trimPartialFragments ?? true,
        visibility: "advanced",
        shouldClampToRange: false,
        presentation: "default",
      })
    );
  } else {
    if (packageOptions.length > 1) {
      contextFields.push(
        Object.freeze({
          id: "workflow.context.selectedPackageIds",
          nodeId: "workflow",
          propertyId: "context.selectedPackageIds",
          label: "Knowledge to use",
          description: "Pick which saved knowledge packs should guide this run.",
          type: "multi-select",
          required: false,
          isEditable: true,
          order: 0,
          sectionId: "workflow-context",
          value: selectedPackageIds,
          options: packageOptions,
          visibility: "basic",
          shouldClampToRange: false,
          presentation: "context-package-selection",
        })
      );
    }

    if (packageOptions.length > 0) {
      contextFields.push(
        Object.freeze({
          id: "workflow.context.visibilityMode",
          nodeId: "workflow",
          propertyId: "context.visibilityMode",
          label: "Context detail",
          description: "Choose whether the run uses only reader-safe context or the fuller authoring set.",
          type: "select",
          required: false,
          isEditable: true,
          order: packageOptions.length > 1 ? 1 : 0,
          sectionId: "workflow-context",
          value: contextConfiguration?.visibilityMode ?? "advanced",
          options: Object.freeze([
            { label: "Reader-safe", value: "basic" },
            { label: "Full detail", value: "advanced" },
          ]),
          visibility: "basic",
          shouldClampToRange: false,
          presentation: "context-visibility",
        })
      );
    }
  }

  if (contextFields.length === 0) {
    return;
  }

  sections.set("workflow-context", {
    id: "workflow-context",
    title: surface === "author" ? "Workflow Context" : "Knowledge & Context",
    description:
      surface === "author"
        ? "Authoring controls for reusable context packages, package ordering, default selection, and budgeting."
        : "Simple controls for choosing which saved knowledge guides this tool run.",
    order: Number.MAX_SAFE_INTEGER - 100,
    fields: contextFields,
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

    appendContextSection(sections, workflow, surface);

    return Object.freeze([...sections.values()].sort((left, right) => left.order - right.order));
  }

  public applyInput(
    workflow: IWorkflow,
    values: Readonly<Record<string, unknown>>
  ): IWorkflow {
    let updated = workflow;
    let nextContextConfiguration = workflow.metadata.contextConfiguration;

    for (const [key, value] of Object.entries(values)) {
      if (key.startsWith("workflow.context.")) {
        const field = key.slice("workflow.context.".length);

        switch (field) {
          case "packageReferences":
            nextContextConfiguration = createNextContextConfiguration(nextContextConfiguration, {
              packageReferences: value as ReadonlyArray<IWorkflowContextPackageReference>,
            });
            break;
          case "selectedPackageIds":
            nextContextConfiguration = createNextContextConfiguration(nextContextConfiguration, {
              selectedPackageIds: parseStringArray(value),
            });
            break;
          case "visibilityMode":
            nextContextConfiguration = createNextContextConfiguration(nextContextConfiguration, {
              visibilityMode: value === "basic" ? "basic" : value === "advanced" ? "advanced" : undefined,
            });
            break;
          case "maxCharacters":
            nextContextConfiguration = createNextContextConfiguration(nextContextConfiguration, {
              maxCharacters: parseInteger(value),
            });
            break;
          case "maxTokens":
            nextContextConfiguration = createNextContextConfiguration(nextContextConfiguration, {
              maxTokens: parseInteger(value),
            });
            break;
          case "trimPartialFragments":
            nextContextConfiguration = createNextContextConfiguration(nextContextConfiguration, {
              trimPartialFragments: value !== false,
            });
            break;
          default:
            break;
        }
        continue;
      }

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

    if (nextContextConfiguration !== workflow.metadata.contextConfiguration) {
      updated = updated.withMetadata({
        ...updated.metadata,
        contextConfiguration: nextContextConfiguration,
      });
    }

    return updated;
  }
}
