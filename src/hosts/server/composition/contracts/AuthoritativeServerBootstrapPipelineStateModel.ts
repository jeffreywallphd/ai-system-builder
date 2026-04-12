import type { HostBootstrapStageId } from "@hosts/bootstrap/HostBootstrapPipeline";
import { HostBootstrapStageIds } from "@hosts/bootstrap/HostBootstrapPipeline";
import type { AuthoritativeServerBootstrapStageId } from "../../AuthoritativeServerBootstrapStageContracts";
import { AuthoritativeServerBootstrapStageIds } from "../../AuthoritativeServerBootstrapStageContracts";
import {
  AuthoritativeServerCompositionModuleIds,
  type AuthoritativeServerCompositionModuleId,
} from "./AuthoritativeServerCompositionModuleContracts";

export const AuthoritativeServerBootstrapPipelineStageIds = Object.freeze({
  configurationLoad: "configuration-load",
  securityMaterialResolution: "security-material-resolution",
  persistenceInitialization: "persistence-initialization",
  migrationExecution: "migration-execution",
  subsystemComposition: "subsystem-composition",
  readinessVerification: "readiness-verification",
  transportStartup: "transport-startup",
  shutdownPreparation: "shutdown-preparation",
});

export type AuthoritativeServerBootstrapPipelineStageId =
  typeof AuthoritativeServerBootstrapPipelineStageIds[keyof typeof AuthoritativeServerBootstrapPipelineStageIds];

export const AuthoritativeServerBootstrapStageExecutionStates = Object.freeze({
  pending: "pending",
  running: "running",
  success: "success",
  failed: "failed",
  skipped: "skipped",
});

export type AuthoritativeServerBootstrapStageExecutionState =
  typeof AuthoritativeServerBootstrapStageExecutionStates[keyof typeof AuthoritativeServerBootstrapStageExecutionStates];

export const AuthoritativeServerBootstrapReadinessStates = Object.freeze({
  notReady: "not-ready",
  ready: "ready",
  degraded: "degraded",
});

export type AuthoritativeServerBootstrapReadinessState =
  typeof AuthoritativeServerBootstrapReadinessStates[keyof typeof AuthoritativeServerBootstrapReadinessStates];

export const AuthoritativeServerBootstrapStageAdoptionStates = Object.freeze({
  active: "active",
  planned: "planned",
});

export type AuthoritativeServerBootstrapStageAdoptionState =
  typeof AuthoritativeServerBootstrapStageAdoptionStates[keyof typeof AuthoritativeServerBootstrapStageAdoptionStates];

export interface AuthoritativeServerBootstrapStageFailure {
  readonly name: string;
  readonly message: string;
}

export interface AuthoritativeServerBootstrapPipelineStageDefinition {
  readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
  readonly sequence: number;
  readonly description: string;
  readonly adoptionState: AuthoritativeServerBootstrapStageAdoptionState;
  readonly ownedModules: ReadonlyArray<AuthoritativeServerCompositionModuleId>;
  readonly hostBootstrapBindings: ReadonlyArray<HostBootstrapStageId>;
  readonly authoritativeStageBindings: ReadonlyArray<AuthoritativeServerBootstrapStageId>;
}

export interface AuthoritativeServerBootstrapPipelineStageStatus {
  readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
  readonly sequence: number;
  readonly executionState: AuthoritativeServerBootstrapStageExecutionState;
  readonly readinessState: AuthoritativeServerBootstrapReadinessState;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly durationMs?: number;
  readonly failure?: AuthoritativeServerBootstrapStageFailure;
}

export interface AuthoritativeServerBootstrapPipelineState {
  readonly stages: ReadonlyArray<AuthoritativeServerBootstrapPipelineStageStatus>;
  readonly readiness: AuthoritativeServerBootstrapReadinessState;
}

export const AuthoritativeServerBootstrapPipelineStageDefinitions = Object.freeze([
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.configurationLoad,
    sequence: 1,
    description: "Resolve startup configuration, deployment profile, runtime metadata, and tracing prerequisites.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
      AuthoritativeServerCompositionModuleIds.diagnostics,
    ]),
    hostBootstrapBindings: Object.freeze([HostBootstrapStageIds.configuration]),
    authoritativeStageBindings: Object.freeze([AuthoritativeServerBootstrapStageIds.config]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.securityMaterialResolution,
    sequence: 2,
    description: "Resolve transport trust and required secret material readiness before persistence and transport activation.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.securityBootstrap,
    ]),
    hostBootstrapBindings: Object.freeze([HostBootstrapStageIds.security]),
    authoritativeStageBindings: Object.freeze([AuthoritativeServerBootstrapStageIds.security]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.persistenceInitialization,
    sequence: 3,
    description: "Initialize persistence runtime and compose persistent platform services for control-plane startup dependencies.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
    ]),
    hostBootstrapBindings: Object.freeze([HostBootstrapStageIds.persistence]),
    authoritativeStageBindings: Object.freeze([AuthoritativeServerBootstrapStageIds.persistence]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.migrationExecution,
    sequence: 4,
    description: "Execute persistence migrations and baseline data-shape checks before policy and transport composition.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
    ]),
    hostBootstrapBindings: Object.freeze([HostBootstrapStageIds.persistence]),
    authoritativeStageBindings: Object.freeze([AuthoritativeServerBootstrapStageIds.persistence]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.subsystemComposition,
    sequence: 5,
    description: "Compose policy, service/route plans, optional execution adapters, and control-plane API startup options.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.policyBootstrap,
      AuthoritativeServerCompositionModuleIds.servicePlan,
      AuthoritativeServerCompositionModuleIds.routePlan,
      AuthoritativeServerCompositionModuleIds.executionAdapter,
      AuthoritativeServerCompositionModuleIds.controlPlaneApi,
      AuthoritativeServerCompositionModuleIds.orchestrationRecovery,
    ]),
    hostBootstrapBindings: Object.freeze([
      HostBootstrapStageIds.dependencies,
      HostBootstrapStageIds.featureRegistration,
    ]),
    authoritativeStageBindings: Object.freeze([
      AuthoritativeServerBootstrapStageIds.services,
      AuthoritativeServerBootstrapStageIds.transport,
    ]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.readinessVerification,
    sequence: 6,
    description: "Verify startup coverage assertions and readiness signals before exposing the transport as ready.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.servicePlan,
      AuthoritativeServerCompositionModuleIds.routePlan,
      AuthoritativeServerCompositionModuleIds.diagnostics,
    ]),
    hostBootstrapBindings: Object.freeze([HostBootstrapStageIds.featureRegistration]),
    authoritativeStageBindings: Object.freeze([]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.transportStartup,
    sequence: 7,
    description: "Start authoritative transport/runtime host using the composed startup options and verified readiness dependencies.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.active,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.transport,
    ]),
    hostBootstrapBindings: Object.freeze([HostBootstrapStageIds.featureRegistration]),
    authoritativeStageBindings: Object.freeze([AuthoritativeServerBootstrapStageIds.transport]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
  Object.freeze({
    stageId: AuthoritativeServerBootstrapPipelineStageIds.shutdownPreparation,
    sequence: 8,
    description: "Prepare deterministic shutdown/disposal contracts so startup-owned resources have explicit cleanup boundaries.",
    adoptionState: AuthoritativeServerBootstrapStageAdoptionStates.planned,
    ownedModules: Object.freeze([
      AuthoritativeServerCompositionModuleIds.transport,
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
      AuthoritativeServerCompositionModuleIds.diagnostics,
    ]),
    hostBootstrapBindings: Object.freeze([]),
    authoritativeStageBindings: Object.freeze([]),
  } satisfies AuthoritativeServerBootstrapPipelineStageDefinition),
]);

export function listAuthoritativeServerBootstrapPipelineStages(): ReadonlyArray<AuthoritativeServerBootstrapPipelineStageDefinition> {
  return AuthoritativeServerBootstrapPipelineStageDefinitions;
}

export function createAuthoritativeServerBootstrapPipelineState(): AuthoritativeServerBootstrapPipelineState {
  const stages = AuthoritativeServerBootstrapPipelineStageDefinitions.map((definition) => Object.freeze({
    stageId: definition.stageId,
    sequence: definition.sequence,
    executionState: AuthoritativeServerBootstrapStageExecutionStates.pending,
    readinessState: AuthoritativeServerBootstrapReadinessStates.notReady,
  } satisfies AuthoritativeServerBootstrapPipelineStageStatus));
  return Object.freeze({
    stages: Object.freeze(stages),
    readiness: deriveAuthoritativeServerBootstrapReadiness(stages),
  });
}

export function updateAuthoritativeServerBootstrapPipelineStageState(input: {
  readonly state: AuthoritativeServerBootstrapPipelineState;
  readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
  readonly executionState: AuthoritativeServerBootstrapStageExecutionState;
  readonly readinessState?: AuthoritativeServerBootstrapReadinessState;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly durationMs?: number;
  readonly failure?: AuthoritativeServerBootstrapStageFailure;
}): AuthoritativeServerBootstrapPipelineState {
  const updatedStages = input.state.stages.map((stage) => {
    if (stage.stageId !== input.stageId) {
      return stage;
    }
    return Object.freeze({
      stageId: stage.stageId,
      sequence: stage.sequence,
      executionState: input.executionState,
      readinessState: input.readinessState ?? stage.readinessState,
      startedAt: input.startedAt ?? stage.startedAt,
      completedAt: input.completedAt ?? stage.completedAt,
      failedAt: input.failedAt ?? stage.failedAt,
      durationMs: input.durationMs ?? stage.durationMs,
      failure: input.failure ?? stage.failure,
    } satisfies AuthoritativeServerBootstrapPipelineStageStatus);
  });
  return Object.freeze({
    stages: Object.freeze(updatedStages),
    readiness: deriveAuthoritativeServerBootstrapReadiness(updatedStages),
  });
}

export function deriveAuthoritativeServerBootstrapReadiness(
  stages: ReadonlyArray<AuthoritativeServerBootstrapPipelineStageStatus>,
): AuthoritativeServerBootstrapReadinessState {
  if (stages.some((stage) => stage.executionState === AuthoritativeServerBootstrapStageExecutionStates.failed)) {
    return AuthoritativeServerBootstrapReadinessStates.degraded;
  }
  const transportStartupStage = stages.find(
    (stage) => stage.stageId === AuthoritativeServerBootstrapPipelineStageIds.transportStartup,
  );
  const readinessVerificationStage = stages.find(
    (stage) => stage.stageId === AuthoritativeServerBootstrapPipelineStageIds.readinessVerification,
  );
  if (
    transportStartupStage?.executionState === AuthoritativeServerBootstrapStageExecutionStates.success
    && readinessVerificationStage?.executionState === AuthoritativeServerBootstrapStageExecutionStates.success
  ) {
    return AuthoritativeServerBootstrapReadinessStates.ready;
  }
  return AuthoritativeServerBootstrapReadinessStates.notReady;
}

