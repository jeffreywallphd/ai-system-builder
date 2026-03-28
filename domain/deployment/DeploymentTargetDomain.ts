export class DeploymentTargetId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): DeploymentTargetId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("DeploymentTargetId cannot be empty.");
    }
    return new DeploymentTargetId(normalized);
  }
}

export const DeploymentTargetTypes = Object.freeze({
  local: "local",
  cloud: "cloud",
  edge: "edge",
});

export type DeploymentTargetType = typeof DeploymentTargetTypes[keyof typeof DeploymentTargetTypes];

export interface DeploymentTargetCapabilities {
  readonly supportsNestedSystems: boolean;
  readonly maxDependencyDepth: number;
  readonly supportedRuntimeEnvironments: ReadonlyArray<string>;
  readonly providedRuntimeRequirements: ReadonlyArray<string>;
  readonly supportedExportTargets: ReadonlyArray<string>;
  readonly supportedDeploymentSettings: ReadonlyArray<string>;
  readonly supportedRuntimeSettings: ReadonlyArray<string>;
}

export interface DeploymentTarget {
  readonly targetId: DeploymentTargetId;
  readonly name: string;
  readonly type: DeploymentTargetType;
  readonly capabilities: DeploymentTargetCapabilities;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))]);
}

export function createDeploymentTarget(input: {
  readonly targetId: string;
  readonly name: string;
  readonly type: DeploymentTargetType;
  readonly capabilities: DeploymentTargetCapabilities;
}): DeploymentTarget {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Deployment target name is required.");
  }

  return Object.freeze({
    targetId: DeploymentTargetId.from(input.targetId),
    name,
    type: input.type,
    capabilities: Object.freeze({
      supportsNestedSystems: input.capabilities.supportsNestedSystems,
      maxDependencyDepth: Math.max(0, Math.floor(input.capabilities.maxDependencyDepth)),
      supportedRuntimeEnvironments: normalizeStringList(input.capabilities.supportedRuntimeEnvironments),
      providedRuntimeRequirements: normalizeStringList(input.capabilities.providedRuntimeRequirements),
      supportedExportTargets: normalizeStringList(input.capabilities.supportedExportTargets),
      supportedDeploymentSettings: normalizeStringList(input.capabilities.supportedDeploymentSettings),
      supportedRuntimeSettings: normalizeStringList(input.capabilities.supportedRuntimeSettings),
    }),
  });
}
