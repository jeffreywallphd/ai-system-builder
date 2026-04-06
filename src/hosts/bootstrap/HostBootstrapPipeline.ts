import type { HostBootConfiguration } from "../../application/common/HostCompositionContracts";
import type { HostCapabilityFlag } from "../../domain/hosts/HostRuntimeDomain";

export class HostBootstrapPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostBootstrapPipelineError";
  }
}

export const HostBootstrapStageIds = Object.freeze({
  configuration: "configuration",
  dependencies: "dependencies",
  logging: "logging",
  security: "security",
  persistence: "persistence",
  featureRegistration: "feature-registration",
});

export type HostBootstrapStageId = typeof HostBootstrapStageIds[keyof typeof HostBootstrapStageIds];

export interface HostDeploymentProfile {
  readonly profileId: string;
  readonly environmentName: string;
  readonly releaseChannel: string;
  readonly region?: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface HostStartupLifecycleHooks {
  onStageStarting?(event: {
    readonly hostId: string;
    readonly stageId: string;
    readonly sequence: number;
    readonly startedAt: string;
  }): void | Promise<void>;
  onStageCompleted?(event: {
    readonly hostId: string;
    readonly stageId: string;
    readonly sequence: number;
    readonly startedAt: string;
    readonly completedAt: string;
  }): void | Promise<void>;
  onStageFailed?(event: {
    readonly hostId: string;
    readonly stageId: string;
    readonly sequence: number;
    readonly startedAt: string;
    readonly failedAt: string;
    readonly error: unknown;
  }): void | Promise<void>;
  onPipelineCompleted?(event: {
    readonly hostId: string;
    readonly completedAt: string;
    readonly executedStageIds: ReadonlyArray<string>;
  }): void | Promise<void>;
}

export interface HostStartupContext<THostConfiguration = Readonly<Record<string, unknown>>> {
  readonly boot: HostBootConfiguration;
  readonly deploymentProfile: HostDeploymentProfile;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly hostConfiguration: THostConfiguration;
  readonly lifecycleHooks: HostStartupLifecycleHooks;
  getArtifact<TValue>(key: string): TValue | undefined;
  setArtifact<TValue>(key: string, value: TValue): void;
  listArtifactKeys(): ReadonlyArray<string>;
}

export type HostBootstrapStageHandler = (context: HostStartupContext) => void | Promise<void>;

export interface HostBootstrapStage {
  readonly stageId: string;
  readonly description: string;
  readonly run: HostBootstrapStageHandler;
}

export interface HostSpecificBootstrapStage extends HostBootstrapStage {
  readonly runAfterStageId?: HostBootstrapStageId;
}

export type HostBootstrapReusableStageHandlers = Partial<Record<HostBootstrapStageId, HostBootstrapStageHandler>>;

export interface HostBootstrapStageExecution {
  readonly sequence: number;
  readonly stageId: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly status: "completed" | "failed";
  readonly error?: unknown;
}

export interface HostBootstrapPipelineResult {
  readonly stageHistory: ReadonlyArray<HostBootstrapStageExecution>;
  readonly executedStageIds: ReadonlyArray<string>;
}

const CanonicalHostBootstrapStageOrder = Object.freeze([
  HostBootstrapStageIds.configuration,
  HostBootstrapStageIds.dependencies,
  HostBootstrapStageIds.logging,
  HostBootstrapStageIds.security,
  HostBootstrapStageIds.persistence,
  HostBootstrapStageIds.featureRegistration,
]);

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HostBootstrapPipelineError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new HostBootstrapPipelineError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeMetadata(value: Readonly<Record<string, string | undefined>> | undefined): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  for (const [key, metadataValue] of Object.entries(value ?? {})) {
    const metadataKey = key.trim();
    if (!metadataKey) {
      continue;
    }
    const metadataEntry = metadataValue?.trim();
    if (metadataEntry) {
      normalized[metadataKey] = metadataEntry;
    }
  }
  return Object.freeze(normalized);
}

function normalizeEnvironment(
  value: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  return Object.freeze({ ...value });
}

function createCanonicalStage(stageId: HostBootstrapStageId, run: HostBootstrapStageHandler): HostBootstrapStage {
  return Object.freeze({
    stageId,
    description: `${stageId} initialization stage`,
    run,
  });
}

export function createHostDeploymentProfile(input: {
  readonly profileId: string;
  readonly environmentName: string;
  readonly releaseChannel: string;
  readonly region?: string;
  readonly metadata?: Readonly<Record<string, string | undefined>>;
}): HostDeploymentProfile {
  return Object.freeze({
    profileId: normalizeRequired(input.profileId, "Host deployment profile profileId"),
    environmentName: normalizeRequired(input.environmentName, "Host deployment profile environmentName"),
    releaseChannel: normalizeRequired(input.releaseChannel, "Host deployment profile releaseChannel"),
    region: input.region?.trim() || undefined,
    metadata: normalizeMetadata(input.metadata),
  });
}

export function createHostStartupContext<THostConfiguration = Readonly<Record<string, unknown>>>(input: {
  readonly boot: HostBootConfiguration;
  readonly deploymentProfile: HostDeploymentProfile;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly enabledCapabilities?: ReadonlyArray<HostCapabilityFlag>;
  readonly hostConfiguration: THostConfiguration;
  readonly lifecycleHooks?: HostStartupLifecycleHooks;
}): HostStartupContext<THostConfiguration> {
  const capabilities = new Set<HostCapabilityFlag>();
  for (const capability of input.enabledCapabilities ?? input.boot.host.capabilities) {
    if (!input.boot.host.capabilities.includes(capability)) {
      throw new HostBootstrapPipelineError(
        `Host startup context capability '${String(capability)}' is not declared by host '${input.boot.host.hostId}'.`,
      );
    }
    capabilities.add(capability);
  }
  const artifacts = new Map<string, unknown>();
  const hooks = input.lifecycleHooks ?? {};

  return Object.freeze({
    boot: input.boot,
    deploymentProfile: input.deploymentProfile,
    environment: normalizeEnvironment(input.environment),
    enabledCapabilities: Object.freeze([...capabilities.values()]),
    hostConfiguration: input.hostConfiguration,
    lifecycleHooks: hooks,
    getArtifact<TValue>(key: string): TValue | undefined {
      return artifacts.get(normalizeRequired(key, "Host startup artifact key")) as TValue | undefined;
    },
    setArtifact<TValue>(key: string, value: TValue): void {
      artifacts.set(normalizeRequired(key, "Host startup artifact key"), value);
    },
    listArtifactKeys(): ReadonlyArray<string> {
      return Object.freeze([...artifacts.keys()]);
    },
  });
}

export function composeHostBootstrapPipeline(input: {
  readonly reusableStageHandlers?: HostBootstrapReusableStageHandlers;
  readonly hostSpecificStages?: ReadonlyArray<HostSpecificBootstrapStage>;
}): ReadonlyArray<HostBootstrapStage> {
  const reusableStageHandlers = input.reusableStageHandlers ?? {};
  const coreStages = Object.freeze([
    createCanonicalStage(HostBootstrapStageIds.configuration, reusableStageHandlers[HostBootstrapStageIds.configuration] ?? (() => {})),
    createCanonicalStage(HostBootstrapStageIds.dependencies, reusableStageHandlers[HostBootstrapStageIds.dependencies] ?? (() => {})),
    createCanonicalStage(HostBootstrapStageIds.logging, reusableStageHandlers[HostBootstrapStageIds.logging] ?? (() => {})),
    createCanonicalStage(HostBootstrapStageIds.security, reusableStageHandlers[HostBootstrapStageIds.security] ?? (() => {})),
    createCanonicalStage(HostBootstrapStageIds.persistence, reusableStageHandlers[HostBootstrapStageIds.persistence] ?? (() => {})),
    createCanonicalStage(
      HostBootstrapStageIds.featureRegistration,
      reusableStageHandlers[HostBootstrapStageIds.featureRegistration] ?? (() => {}),
    ),
  ]);

  const appendedByStage = new Map<HostBootstrapStageId, HostBootstrapStage[]>();
  const trailingStages: HostBootstrapStage[] = [];
  const stageIds = new Set<string>();

  for (const stage of coreStages) {
    stageIds.add(stage.stageId);
  }

  for (const stage of input.hostSpecificStages ?? []) {
    const stageId = normalizeRequired(stage.stageId, "Host-specific bootstrap stage stageId");
    if (stageIds.has(stageId)) {
      throw new HostBootstrapPipelineError(`Host bootstrap stage '${stageId}' is duplicated.`);
    }
    stageIds.add(stageId);

    const normalizedStage = Object.freeze({
      stageId,
      description: normalizeRequired(stage.description, `Host-specific bootstrap stage '${stageId}' description`),
      run: stage.run,
    });

    if (!stage.runAfterStageId) {
      trailingStages.push(normalizedStage);
      continue;
    }

    if (!CanonicalHostBootstrapStageOrder.includes(stage.runAfterStageId)) {
      throw new HostBootstrapPipelineError(
        `Host-specific bootstrap stage '${stageId}' references unsupported runAfterStageId '${String(stage.runAfterStageId)}'.`,
      );
    }
    const afterStages = appendedByStage.get(stage.runAfterStageId) ?? [];
    afterStages.push(normalizedStage);
    appendedByStage.set(stage.runAfterStageId, afterStages);
  }

  const composedStages: HostBootstrapStage[] = [];
  for (const stage of coreStages) {
    composedStages.push(stage);
    const appended = appendedByStage.get(stage.stageId as HostBootstrapStageId) ?? [];
    composedStages.push(...appended);
  }
  composedStages.push(...trailingStages);

  return Object.freeze(composedStages);
}

export async function executeHostBootstrapPipeline(input: {
  readonly context: HostStartupContext;
  readonly stages: ReadonlyArray<HostBootstrapStage>;
}): Promise<HostBootstrapPipelineResult> {
  const stageHistory: HostBootstrapStageExecution[] = [];
  const executedStageIds: string[] = [];

  for (const [index, stage] of input.stages.entries()) {
    const startedAt = normalizeIsoTimestamp(new Date().toISOString(), "Host bootstrap stage startedAt");
    await input.context.lifecycleHooks.onStageStarting?.({
      hostId: input.context.boot.host.hostId,
      stageId: stage.stageId,
      sequence: index + 1,
      startedAt,
    });

    try {
      await stage.run(input.context);
      const completedAt = normalizeIsoTimestamp(new Date().toISOString(), "Host bootstrap stage completedAt");
      stageHistory.push(Object.freeze({
        sequence: index + 1,
        stageId: stage.stageId,
        startedAt,
        completedAt,
        status: "completed",
      }));
      executedStageIds.push(stage.stageId);
      await input.context.lifecycleHooks.onStageCompleted?.({
        hostId: input.context.boot.host.hostId,
        stageId: stage.stageId,
        sequence: index + 1,
        startedAt,
        completedAt,
      });
    } catch (error) {
      const failedAt = normalizeIsoTimestamp(new Date().toISOString(), "Host bootstrap stage failedAt");
      const failedRecord = Object.freeze({
        sequence: index + 1,
        stageId: stage.stageId,
        startedAt,
        failedAt,
        status: "failed" as const,
        error,
      });
      stageHistory.push(failedRecord);
      await input.context.lifecycleHooks.onStageFailed?.({
        hostId: input.context.boot.host.hostId,
        stageId: stage.stageId,
        sequence: index + 1,
        startedAt,
        failedAt,
        error,
      });

      const pipelineError = new HostBootstrapPipelineError(
        `Host bootstrap stage '${stage.stageId}' failed for host '${input.context.boot.host.hostId}'.`,
      ) as HostBootstrapPipelineError & { cause?: unknown };
      pipelineError.cause = error;
      throw pipelineError;
    }
  }

  const completedAt = normalizeIsoTimestamp(new Date().toISOString(), "Host bootstrap completedAt");
  await input.context.lifecycleHooks.onPipelineCompleted?.({
    hostId: input.context.boot.host.hostId,
    completedAt,
    executedStageIds: Object.freeze([...executedStageIds]),
  });

  return Object.freeze({
    stageHistory: Object.freeze(stageHistory),
    executedStageIds: Object.freeze(executedStageIds),
  });
}
