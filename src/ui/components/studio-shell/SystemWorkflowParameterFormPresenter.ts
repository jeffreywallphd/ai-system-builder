import type {
  StudioImageWorkflowDefinitionReadModel,
} from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import {
  ImageSystemParameterValueSources,
  validateImageSystemParameterSetContract,
  type ImageSystemParameterValidationIssue,
} from "@shared/contracts/image-workflows/ImageWorkflowParameterContracts";
import {
  ImageWorkflowParameterVisibilityOperators,
  type ImageWorkflowParameterSpecification,
  type ImageWorkflowParameterVisibilityRule,
} from "@domain/image-workflows/ImageWorkflowParameterSpecification";

export interface WorkflowParameterValidationPresentation {
  readonly issuesByParameterId: ReadonlyMap<string, ReadonlyArray<ImageSystemParameterValidationIssue>>;
  readonly globalIssues: ReadonlyArray<ImageSystemParameterValidationIssue>;
  readonly hasIssues: boolean;
}

export interface WorkflowParameterSectionPresentation {
  readonly sectionId: string;
  readonly title: string;
  readonly advanced: boolean;
  readonly parameters: ReadonlyArray<ImageWorkflowParameterSpecification>;
}

function evaluateVisibilityRule(
  rule: ImageWorkflowParameterVisibilityRule,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const currentValue = values[rule.parameterId];
  switch (rule.operator) {
    case ImageWorkflowParameterVisibilityOperators.equals:
      return currentValue === rule.value;
    case ImageWorkflowParameterVisibilityOperators.notEquals:
      return currentValue !== rule.value;
    case ImageWorkflowParameterVisibilityOperators.in:
      return Array.isArray(rule.value) ? rule.value.includes(currentValue) : false;
    case ImageWorkflowParameterVisibilityOperators.notIn:
      return Array.isArray(rule.value) ? !rule.value.includes(currentValue) : false;
    case ImageWorkflowParameterVisibilityOperators.greaterThan:
      return typeof currentValue === "number" && typeof rule.value === "number" ? currentValue > rule.value : false;
    case ImageWorkflowParameterVisibilityOperators.greaterThanOrEqual:
      return typeof currentValue === "number" && typeof rule.value === "number" ? currentValue >= rule.value : false;
    case ImageWorkflowParameterVisibilityOperators.lessThan:
      return typeof currentValue === "number" && typeof rule.value === "number" ? currentValue < rule.value : false;
    case ImageWorkflowParameterVisibilityOperators.lessThanOrEqual:
      return typeof currentValue === "number" && typeof rule.value === "number" ? currentValue <= rule.value : false;
    case ImageWorkflowParameterVisibilityOperators.exists:
      return currentValue !== undefined && currentValue !== null && currentValue !== "";
    default:
      return true;
  }
}

export function isWorkflowParameterVisible(
  specification: ImageWorkflowParameterSpecification,
  values: Readonly<Record<string, unknown>>,
): boolean {
  if (!specification.visibility || specification.visibility.rules.length === 0) {
    return true;
  }
  const ruleResults = specification.visibility.rules.map((rule) => evaluateVisibilityRule(rule, values));
  return specification.visibility.mode === "all"
    ? ruleResults.every(Boolean)
    : ruleResults.some(Boolean);
}

export function createWorkflowParameterInitialValues(input: {
  readonly workflow: StudioImageWorkflowDefinitionReadModel;
  readonly existingValues?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  const nextValues: Record<string, unknown> = {};
  for (const specification of input.workflow.parameterSpecifications) {
    const existingValue = input.existingValues?.[specification.parameterId];
    if (existingValue !== undefined) {
      nextValues[specification.parameterId] = existingValue;
      continue;
    }
    const defaultValue = input.workflow.parameterDefaults?.[specification.parameterId];
    nextValues[specification.parameterId] = defaultValue ?? specification.defaultValue ?? "";
  }
  return Object.freeze(nextValues);
}

function resolveSpecificationOrder(specification: ImageWorkflowParameterSpecification): number {
  return specification.ui.order ?? Number.MAX_SAFE_INTEGER;
}

function resolveSectionId(specification: ImageWorkflowParameterSpecification): string {
  const normalized = specification.ui.group?.trim().toLowerCase();
  if (!normalized) {
    return "general";
  }
  return normalized.replace(/\s+/g, "-");
}

function toSectionTitle(sectionId: string): string {
  if (sectionId === "general") {
    return "Core settings";
  }
  return sectionId
    .split("-")
    .filter((entry) => entry.length > 0)
    .map((entry) => `${entry.charAt(0).toUpperCase()}${entry.slice(1)}`)
    .join(" ");
}

export function groupWorkflowParameterSections(workflow: StudioImageWorkflowDefinitionReadModel): ReadonlyArray<WorkflowParameterSectionPresentation> {
  const ordered = [...workflow.parameterSpecifications].sort((left, right) => {
    const orderDelta = resolveSpecificationOrder(left) - resolveSpecificationOrder(right);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return left.parameterId.localeCompare(right.parameterId);
  });

  const sectionOrder: string[] = [];
  const parametersBySection = new Map<string, Array<ImageWorkflowParameterSpecification>>();
  const sectionAdvanced = new Map<string, boolean>();

  for (const specification of ordered) {
    const sectionId = resolveSectionId(specification);
    if (!parametersBySection.has(sectionId)) {
      sectionOrder.push(sectionId);
      parametersBySection.set(sectionId, []);
      sectionAdvanced.set(sectionId, false);
    }
    parametersBySection.get(sectionId)?.push(specification);
    sectionAdvanced.set(sectionId, (sectionAdvanced.get(sectionId) ?? false) || specification.ui.advanced === true);
  }

  return Object.freeze(sectionOrder.map((sectionId) => Object.freeze({
    sectionId,
    title: toSectionTitle(sectionId),
    advanced: sectionAdvanced.get(sectionId) === true,
    parameters: Object.freeze(parametersBySection.get(sectionId) ?? []),
  })));
}

export function coerceWorkflowParameterInputValue(
  specification: ImageWorkflowParameterSpecification,
  rawValue: string | boolean,
): unknown {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (specification.valueKind === "integer") {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : rawValue;
  }
  if (specification.valueKind === "float") {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : rawValue;
  }
  if (specification.valueKind === "boolean") {
    return trimmed.toLowerCase() === "true";
  }
  return rawValue;
}

function createValidatedValueMap(input: {
  readonly workflow: StudioImageWorkflowDefinitionReadModel;
  readonly values: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  const nextValues: Record<string, unknown> = {};
  for (const specification of input.workflow.parameterSpecifications) {
    const existingValue = input.values[specification.parameterId];
    if (existingValue !== undefined) {
      nextValues[specification.parameterId] = existingValue;
      continue;
    }
    const workflowDefaultValue = input.workflow.parameterDefaults?.[specification.parameterId];
    if (workflowDefaultValue !== undefined) {
      nextValues[specification.parameterId] = workflowDefaultValue;
      continue;
    }
    if (specification.defaultValue !== undefined) {
      nextValues[specification.parameterId] = specification.defaultValue;
    }
  }
  return Object.freeze(nextValues);
}

export function createWorkflowParameterBaselineValues(input: {
  readonly workflow: StudioImageWorkflowDefinitionReadModel;
  readonly values: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  return createValidatedValueMap(input);
}

export function validateWorkflowParameterValues(input: {
  readonly workflow: StudioImageWorkflowDefinitionReadModel;
  readonly values: Readonly<Record<string, unknown>>;
}): WorkflowParameterValidationPresentation {
  const validatedValues = createValidatedValueMap(input);
  const valueEntries = Object.entries(validatedValues).map(([parameterId, value]) => Object.freeze({
    parameterId,
    value,
    source: ImageSystemParameterValueSources.baseline,
  }));
  const result = validateImageSystemParameterSetContract({
    parameterSpecifications: input.workflow.parameterSpecifications,
    values: valueEntries,
  });
  const issuesByParameterId = new Map<string, ImageSystemParameterValidationIssue[]>();
  const knownParameterIds = new Set(input.workflow.parameterSpecifications.map((specification) => specification.parameterId));
  const globalIssues: ImageSystemParameterValidationIssue[] = [];
  for (const issue of result.issues) {
    if (!knownParameterIds.has(issue.parameterId)) {
      globalIssues.push(issue);
      continue;
    }
    const current = issuesByParameterId.get(issue.parameterId) ?? [];
    current.push(issue);
    issuesByParameterId.set(issue.parameterId, current);
  }
  return Object.freeze({
    issuesByParameterId,
    globalIssues: Object.freeze(globalIssues),
    hasIssues: result.issues.length > 0,
  });
}
