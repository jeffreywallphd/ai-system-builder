import type { CompositionTaxonomyDescriptor } from "@domain/taxonomy/CompositionTaxonomy";
import {
  createDefaultLocalRuntimeEnvironment,
  createExecutionEnvironmentResolution,
  createRuntimeEnvironment,
  environmentSupportsTaxonomy,
  RuntimeEnvironmentKinds,
  type ExecutionEnvironmentResolution,
  type RuntimeEnvironment,
  type RuntimeEnvironmentKind,
} from "@domain/system-runtime/RuntimeEnvironmentDomain";

export interface RuntimeEnvironmentSelectionRequest {
  readonly requestedEnvironmentId?: string;
  readonly requestedKind?: RuntimeEnvironmentKind;
  readonly executableTaxonomies: ReadonlyArray<CompositionTaxonomyDescriptor>;
  readonly requiresMcpMediatedExecution?: boolean;
  readonly requiresNestedSystems?: boolean;
}

export interface IRuntimeEnvironmentSelector {
  listEnvironments(): ReadonlyArray<RuntimeEnvironment>;
  selectEnvironment(request: RuntimeEnvironmentSelectionRequest): ExecutionEnvironmentResolution;
}

export class RuntimeEnvironmentSelector implements IRuntimeEnvironmentSelector {
  private readonly environments: ReadonlyArray<RuntimeEnvironment>;

  public constructor(environments?: ReadonlyArray<RuntimeEnvironment>) {
    const source = environments?.length ? environments : [createDefaultLocalRuntimeEnvironment()];
    const normalized = source.map((entry) => createRuntimeEnvironment(entry));

    this.environments = Object.freeze(normalized
      .sort((left, right) => `${left.isDefault ? 0 : 1}:${left.environmentId}`.localeCompare(`${right.isDefault ? 0 : 1}:${right.environmentId}`)));
  }

  public listEnvironments(): ReadonlyArray<RuntimeEnvironment> {
    return this.environments;
  }

  public selectEnvironment(request: RuntimeEnvironmentSelectionRequest): ExecutionEnvironmentResolution {
    const executableTaxonomies = request.executableTaxonomies;
    if (executableTaxonomies.length === 0) {
      return createExecutionEnvironmentResolution({
        requestedEnvironmentId: request.requestedEnvironmentId,
        requestedKind: request.requestedKind,
        status: "unsupported",
        reason: "Execution environment selection requires at least one executable taxonomy target.",
      });
    }

    const candidates = this.environments.filter((environment) => {
      if (request.requestedEnvironmentId && environment.environmentId !== request.requestedEnvironmentId.trim()) {
        return false;
      }
      if (request.requestedKind && environment.kind !== request.requestedKind) {
        return false;
      }
      if (request.requiresMcpMediatedExecution && !environment.capabilities.supportsMcpMediatedExecution) {
        return false;
      }
      if (request.requiresNestedSystems && !environment.capabilities.supportsNestedSystems) {
        return false;
      }

      return executableTaxonomies.every((taxonomy) => environmentSupportsTaxonomy({ environment, taxonomy }));
    });

    const selected = candidates[0]
      ?? this.environments.find((entry) => entry.isDefault && entry.kind === RuntimeEnvironmentKinds.local && candidates.length > 0)
      ?? candidates[0];

    if (!selected) {
      const requested = request.requestedEnvironmentId
        ? `id '${request.requestedEnvironmentId.trim()}'`
        : request.requestedKind
          ? `kind '${request.requestedKind}'`
          : "default runtime environment";
      return createExecutionEnvironmentResolution({
        requestedEnvironmentId: request.requestedEnvironmentId,
        requestedKind: request.requestedKind,
        status: "unsupported",
        reason: `No runtime environment satisfies ${requested} for the required executable taxonomy/capability set.`,
      });
    }

    return createExecutionEnvironmentResolution({
      requestedEnvironmentId: request.requestedEnvironmentId,
      requestedKind: request.requestedKind,
      selectedEnvironment: selected,
      status: "resolved",
    });
  }
}

