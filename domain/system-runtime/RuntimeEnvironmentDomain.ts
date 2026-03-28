import type { CompositionTaxonomyDescriptor, TaxonomyStructuralKind } from "../taxonomy/CompositionTaxonomy";

export const RuntimeEnvironmentKinds = Object.freeze({
  local: "local",
  mcp: "mcp",
  remote: "remote",
});

export type RuntimeEnvironmentKind = typeof RuntimeEnvironmentKinds[keyof typeof RuntimeEnvironmentKinds];

export interface RuntimeEnvironmentCapabilities {
  readonly supportsStructuralKinds: ReadonlyArray<TaxonomyStructuralKind>;
  readonly supportsNestedSystems: boolean;
  readonly supportsMcpMediatedExecution: boolean;
}

export interface RuntimeEnvironment {
  readonly environmentId: string;
  readonly kind: RuntimeEnvironmentKind;
  readonly displayName: string;
  readonly isDefault?: boolean;
  readonly capabilities: RuntimeEnvironmentCapabilities;
}

export interface ExecutionEnvironmentResolution {
  readonly requestedEnvironmentId?: string;
  readonly requestedKind?: RuntimeEnvironmentKind;
  readonly selectedEnvironment?: RuntimeEnvironment;
  readonly status: "resolved" | "unsupported";
  readonly reason?: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeStructuralKinds(value: ReadonlyArray<TaxonomyStructuralKind>): ReadonlyArray<TaxonomyStructuralKind> {
  const unique = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Runtime environment capabilities must include at least one supported structural kind.");
  }

  return Object.freeze(unique as TaxonomyStructuralKind[]);
}

export function createRuntimeEnvironment(input: RuntimeEnvironment): RuntimeEnvironment {
  return Object.freeze({
    environmentId: normalizeRequired(input.environmentId, "Runtime environment id"),
    kind: input.kind,
    displayName: normalizeRequired(input.displayName, "Runtime environment display name"),
    isDefault: input.isDefault ?? false,
    capabilities: Object.freeze({
      supportsStructuralKinds: normalizeStructuralKinds(input.capabilities.supportsStructuralKinds),
      supportsNestedSystems: input.capabilities.supportsNestedSystems,
      supportsMcpMediatedExecution: input.capabilities.supportsMcpMediatedExecution,
    }),
  });
}

export function createExecutionEnvironmentResolution(input: ExecutionEnvironmentResolution): ExecutionEnvironmentResolution {
  if (input.status === "resolved" && !input.selectedEnvironment) {
    throw new Error("Resolved execution environment selections require a selected environment.");
  }
  if (input.status === "unsupported" && !input.reason?.trim()) {
    throw new Error("Unsupported execution environment selections require a reason.");
  }

  return Object.freeze({
    requestedEnvironmentId: input.requestedEnvironmentId?.trim() || undefined,
    requestedKind: input.requestedKind,
    selectedEnvironment: input.selectedEnvironment,
    status: input.status,
    reason: input.reason?.trim() || undefined,
  });
}

export function environmentSupportsTaxonomy(input: {
  readonly environment: RuntimeEnvironment;
  readonly taxonomy: CompositionTaxonomyDescriptor;
}): boolean {
  return input.environment.capabilities.supportsStructuralKinds.includes(input.taxonomy.structuralKind);
}

export function createDefaultLocalRuntimeEnvironment(): RuntimeEnvironment {
  return createRuntimeEnvironment({
    environmentId: "runtime:local-default",
    kind: RuntimeEnvironmentKinds.local,
    displayName: "Local Runtime Host",
    isDefault: true,
    capabilities: {
      supportsStructuralKinds: ["atomic", "composite", "system"],
      supportsNestedSystems: true,
      supportsMcpMediatedExecution: true,
    },
  });
}
