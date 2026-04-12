import type { HostBootConfiguration } from "@application/common/HostCompositionContracts";
import { HostCapabilityFlags, type HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import { createHostDeploymentProfile, type HostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";

export class HostStartupConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostStartupConfigurationError";
  }
}

export const HostDeploymentProfileIds = Object.freeze({
  home: "home",
  classroom: "classroom",
  organization: "organization",
});

export type HostDeploymentProfileId =
  typeof HostDeploymentProfileIds[keyof typeof HostDeploymentProfileIds];

export const HostStartupEnvironmentKeys = Object.freeze({
  deploymentProfile: "AI_LOOM_DEPLOYMENT_PROFILE",
  environmentName: "AI_LOOM_ENVIRONMENT_NAME",
  releaseChannel: "AI_LOOM_RELEASE_CHANNEL",
  region: "AI_LOOM_DEPLOYMENT_REGION",
  enabledCapabilities: "AI_LOOM_ENABLED_CAPABILITIES",
});

export interface HostStartupDeploymentProfileOverrides {
  readonly profileId?: string;
  readonly environmentName?: string;
  readonly releaseChannel?: string;
  readonly region?: string;
  readonly metadata?: Readonly<Record<string, string | undefined>>;
}

export interface HostProfileAwareStartupOverrides {
  readonly deploymentProfile?: HostStartupDeploymentProfileOverrides;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly enabledCapabilities?: ReadonlyArray<HostCapabilityFlag>;
}

export interface ResolvedHostStartupConfiguration {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly deploymentProfile: HostDeploymentProfile;
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
}

const CanonicalDeploymentProfileIds = new Set<string>(Object.values(HostDeploymentProfileIds));
const CanonicalReleaseChannels = new Set<string>(["stable", "beta", "canary", "development", "ci"]);

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  return Object.freeze({ ...environment });
}

function normalizeDeploymentProfileId(value: string | undefined): HostDeploymentProfileId | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("deployment-profile:")) {
    return normalizeDeploymentProfileId(normalized.slice("deployment-profile:".length));
  }
  if (!CanonicalDeploymentProfileIds.has(normalized)) {
    throw new HostStartupConfigurationError(
      `Deployment profile '${normalized}' is unsupported. Supported profiles: ${Object.values(HostDeploymentProfileIds).join(", ")}.`,
    );
  }

  return normalized as HostDeploymentProfileId;
}

function normalizeEnvironmentName(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  if (!/^[a-z0-9][a-z0-9-_.]{1,63}$/i.test(normalized)) {
    throw new HostStartupConfigurationError(
      `Environment name '${normalized}' is invalid. Use alphanumeric, dash, underscore, or dot characters.`,
    );
  }
  return normalized.toLowerCase();
}

function normalizeReleaseChannel(
  value: string | undefined,
  environmentName: string,
): string {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return environmentName === "production" ? "stable" : "development";
  }
  if (!CanonicalReleaseChannels.has(normalized)) {
    throw new HostStartupConfigurationError(
      `Release channel '${normalized}' is unsupported. Supported channels: ${[...CanonicalReleaseChannels.values()].join(", ")}.`,
    );
  }
  return normalized;
}

function parseCapabilitiesFromEnvironment(
  value: string | undefined,
): ReadonlyArray<HostCapabilityFlag> | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  const capabilities = new Set<HostCapabilityFlag>();
  for (const raw of normalized.split(",")) {
    const capability = raw.trim() as HostCapabilityFlag;
    if (!capability) {
      continue;
    }
    if (!Object.values(HostCapabilityFlags).includes(capability)) {
      throw new HostStartupConfigurationError(
        `Capability '${capability}' is unsupported in '${HostStartupEnvironmentKeys.enabledCapabilities}'.`,
      );
    }
    capabilities.add(capability);
  }

  return Object.freeze([...capabilities.values()]);
}

function resolveEnabledCapabilities(input: {
  readonly host: HostBootConfiguration["host"];
  readonly overrideCapabilities?: ReadonlyArray<HostCapabilityFlag>;
  readonly environmentCapabilities?: ReadonlyArray<HostCapabilityFlag>;
}): ReadonlyArray<HostCapabilityFlag> {
  const requestedCapabilities = input.overrideCapabilities
    ?? input.environmentCapabilities
    ?? input.host.capabilities;
  const hostCapabilities = new Set<HostCapabilityFlag>(input.host.capabilities);

  const enabledCapabilities = new Set<HostCapabilityFlag>();
  for (const capability of requestedCapabilities) {
    if (!hostCapabilities.has(capability)) {
      throw new HostStartupConfigurationError(
        `Enabled capability '${capability}' is not declared by host '${input.host.hostId}'.`,
      );
    }
    enabledCapabilities.add(capability);
  }

  if (enabledCapabilities.size < 1) {
    throw new HostStartupConfigurationError(
      `Host '${input.host.hostId}' must enable at least one declared capability during startup composition.`,
    );
  }

  return Object.freeze([...enabledCapabilities.values()]);
}

export function resolveHostStartupConfiguration(input: {
  readonly boot: HostBootConfiguration;
  readonly startup?: HostProfileAwareStartupOverrides;
  readonly defaultDeploymentProfileId?: HostDeploymentProfileId;
}): ResolvedHostStartupConfiguration {
  const environment = normalizeEnvironment(input.startup?.environment ?? input.boot.environment);
  const profileId = normalizeDeploymentProfileId(
    input.startup?.deploymentProfile?.profileId
      ?? environment[HostStartupEnvironmentKeys.deploymentProfile]
      ?? input.defaultDeploymentProfileId
      ?? HostDeploymentProfileIds.organization,
  );
  if (!profileId) {
    throw new HostStartupConfigurationError("Host deployment profile could not be resolved.");
  }

  const environmentName = normalizeEnvironmentName(
    input.startup?.deploymentProfile?.environmentName
      ?? environment[HostStartupEnvironmentKeys.environmentName]
      ?? environment.NODE_ENV
      ?? "development",
  );
  if (!environmentName) {
    throw new HostStartupConfigurationError("Host environment name could not be resolved.");
  }

  const releaseChannel = normalizeReleaseChannel(
    input.startup?.deploymentProfile?.releaseChannel ?? environment[HostStartupEnvironmentKeys.releaseChannel],
    environmentName,
  );
  const deploymentProfile = createHostDeploymentProfile({
    profileId,
    environmentName,
    releaseChannel,
    region: input.startup?.deploymentProfile?.region
      ?? normalizeOptional(environment[HostStartupEnvironmentKeys.region]),
    metadata: input.startup?.deploymentProfile?.metadata,
  });

  const environmentCapabilities = parseCapabilitiesFromEnvironment(
    environment[HostStartupEnvironmentKeys.enabledCapabilities],
  );
  const enabledCapabilities = resolveEnabledCapabilities({
    host: input.boot.host,
    overrideCapabilities: input.startup?.enabledCapabilities,
    environmentCapabilities,
  });

  return Object.freeze({
    environment,
    deploymentProfile,
    enabledCapabilities,
  });
}

