export type McpToolSideEffectClass = "none" | "read" | "write" | "network" | "system";

export interface McpToolAuthRequirement {
  readonly kind: "none" | "optional" | "required";
  readonly scheme?: string;
  readonly scopes?: ReadonlyArray<string>;
}

export interface McpToolCostProfile {
  readonly relativeCost?: "low" | "medium" | "high";
  readonly estimatedUnitCost?: number;
  readonly billingUnit?: string;
}

export interface McpToolExecutionCharacteristics {
  readonly expectedLatencyMs?: number;
  readonly timeoutMs?: number;
  readonly deterministic?: boolean;
}

export interface McpToolExecutionBinding {
  readonly serverId: string;
  readonly toolName: string;
}

export interface McpToolDefinition {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly description?: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema?: Readonly<Record<string, unknown>>;
  readonly sideEffects: McpToolSideEffectClass;
  readonly auth: McpToolAuthRequirement;
  readonly tags: ReadonlyArray<string>;
  readonly categories: ReadonlyArray<string>;
  readonly execution?: McpToolExecutionCharacteristics;
  readonly cost?: McpToolCostProfile;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly binding?: McpToolExecutionBinding;
}

export interface McpToolDefinitionValidationIssue {
  readonly code:
    | "missing-id"
    | "missing-version"
    | "missing-display-name"
    | "invalid-input-schema"
    | "invalid-output-schema"
    | "invalid-auth"
    | "invalid-side-effects"
    | "invalid-binding";
  readonly message: string;
  readonly path?: string;
}

export interface McpToolDefinitionValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<McpToolDefinitionValidationIssue>;
}

export function validateMcpToolDefinition(
  definition: Partial<McpToolDefinition>,
): McpToolDefinitionValidationResult {
  const issues: McpToolDefinitionValidationIssue[] = [];

  if (!definition.id?.trim()) {
    issues.push({ code: "missing-id", message: "Tool definition requires a stable id.", path: "id" });
  }
  if (!definition.version?.trim()) {
    issues.push({ code: "missing-version", message: "Tool definition requires a version.", path: "version" });
  }
  if (!definition.displayName?.trim()) {
    issues.push({ code: "missing-display-name", message: "Tool definition requires a displayName.", path: "displayName" });
  }
  if (!isSchemaRecord(definition.inputSchema)) {
    issues.push({ code: "invalid-input-schema", message: "Tool definition requires an object-shaped input schema.", path: "inputSchema" });
  }
  if (definition.outputSchema !== undefined && !isSchemaRecord(definition.outputSchema)) {
    issues.push({ code: "invalid-output-schema", message: "Tool outputSchema must be an object when provided.", path: "outputSchema" });
  }

  if (!definition.auth || !["none", "optional", "required"].includes(definition.auth.kind)) {
    issues.push({ code: "invalid-auth", message: "Tool auth.kind must be none, optional, or required.", path: "auth.kind" });
  }

  if (!definition.sideEffects || !["none", "read", "write", "network", "system"].includes(definition.sideEffects)) {
    issues.push({ code: "invalid-side-effects", message: "Tool sideEffects is invalid.", path: "sideEffects" });
  }

  if (definition.binding) {
    if (!definition.binding.serverId?.trim() || !definition.binding.toolName?.trim()) {
      issues.push({ code: "invalid-binding", message: "Tool binding requires non-empty serverId and toolName.", path: "binding" });
    }
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function normalizeMcpToolDefinition(definition: McpToolDefinition): McpToolDefinition {
  return Object.freeze({
    id: definition.id.trim(),
    version: definition.version.trim(),
    displayName: definition.displayName.trim(),
    description: definition.description?.trim() || undefined,
    inputSchema: cloneRecord(definition.inputSchema) ?? Object.freeze({ type: "object" }),
    outputSchema: cloneRecord(definition.outputSchema),
    sideEffects: definition.sideEffects,
    auth: Object.freeze({
      kind: definition.auth.kind,
      scheme: definition.auth.scheme?.trim() || undefined,
      scopes: Object.freeze([...(definition.auth.scopes ?? [])].map((value) => value.trim()).filter(Boolean)),
    }),
    tags: Object.freeze([...definition.tags].map((value) => value.trim()).filter(Boolean)),
    categories: Object.freeze([...definition.categories].map((value) => value.trim()).filter(Boolean)),
    execution: definition.execution
      ? Object.freeze({
          expectedLatencyMs: normalizePositiveInt(definition.execution.expectedLatencyMs),
          timeoutMs: normalizePositiveInt(definition.execution.timeoutMs),
          deterministic: definition.execution.deterministic,
        })
      : undefined,
    cost: definition.cost
      ? Object.freeze({
          relativeCost: definition.cost.relativeCost,
          estimatedUnitCost: typeof definition.cost.estimatedUnitCost === "number" ? definition.cost.estimatedUnitCost : undefined,
          billingUnit: definition.cost.billingUnit?.trim() || undefined,
        })
      : undefined,
    metadata: cloneRecord(definition.metadata),
    binding: definition.binding
      ? Object.freeze({ serverId: definition.binding.serverId.trim(), toolName: definition.binding.toolName.trim() })
      : undefined,
  });
}

function isSchemaRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isSchemaRecord(value)) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function normalizePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}
