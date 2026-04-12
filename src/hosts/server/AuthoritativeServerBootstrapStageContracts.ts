import type { HostBootConfiguration, HostRuntimeMetadata } from "@application/common/HostCompositionContracts";
import type { HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import type { HostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import { HostBootstrapStageIds, type HostBootstrapStageId } from "@hosts/bootstrap/HostBootstrapPipeline";
import type { StartupTracer } from "@hosts/bootstrap/startupTracer";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import type { SqlitePersistenceRuntime } from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import type { ComfyUiExecutionAdapterInfrastructure } from "@infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition";
import type { AuthoritativeRunExecutionAdapterRegistration } from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import type { IdentityServerHost, IdentityServerHostOptions } from "./IdentityServerHost";

export const AuthoritativeServerBootstrapStageIds = Object.freeze({
  config: "config",
  security: "security",
  persistence: "persistence",
  services: "services",
  transport: "transport",
});

export type AuthoritativeServerBootstrapStageId =
  typeof AuthoritativeServerBootstrapStageIds[keyof typeof AuthoritativeServerBootstrapStageIds];

export interface BootstrapStage<TInput, TOutput, TStageId extends string = string> {
  readonly stageId: TStageId;
  readonly description: string;
  execute(input: TInput): Promise<TOutput> | TOutput;
}

export interface BootstrapStageContractBoundary<TInput, TOutput> {
  readonly consumes: ReadonlyArray<Extract<keyof TInput, string>>;
  readonly produces: ReadonlyArray<Extract<keyof TOutput, string>>;
}

export interface BootstrapStageContract<TInput, TOutput, TStageId extends string = string> {
  readonly stageId: TStageId;
  readonly description: string;
  readonly boundary: BootstrapStageContractBoundary<TInput, TOutput>;
}

export interface AuthoritativeServerBootstrapBaseInput {
  readonly boot: HostBootConfiguration;
  readonly hostConfiguration: IdentityServerHostOptions;
}

export interface AuthoritativeServerConfigStageInput extends AuthoritativeServerBootstrapBaseInput {
  readonly startupReason: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

export interface AuthoritativeServerConfigStageOutput {
  readonly deploymentProfile: HostDeploymentProfile;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly runtimeMetadata: HostRuntimeMetadata;
  readonly startupTracer: StartupTracer;
}

export interface AuthoritativeServerSecurityStageInput extends AuthoritativeServerConfigStageOutput {
  readonly hostConfiguration: IdentityServerHostOptions;
}

export const AuthoritativeServerReadinessCheckStates = Object.freeze({
  ready: "ready",
  degraded: "degraded",
  failed: "failed",
});

export type AuthoritativeServerReadinessCheckState =
  typeof AuthoritativeServerReadinessCheckStates[keyof typeof AuthoritativeServerReadinessCheckStates];

export interface AuthoritativeServerReadinessCheck {
  readonly checkId: string;
  readonly subsystem: string;
  readonly state: AuthoritativeServerReadinessCheckState;
  readonly summary: string;
  readonly blocking: boolean;
  readonly details?: Readonly<Record<string, string>>;
}

export interface AuthoritativeServerSecurityStageOutput {
  readonly checks: ReadonlyArray<AuthoritativeServerReadinessCheck>;
}

export interface AuthoritativeServerPersistenceStageInput extends AuthoritativeServerConfigStageOutput {
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly security: AuthoritativeServerSecurityStageOutput;
}

export interface AuthoritativeServerPersistenceStageOutput {
  readonly persistenceRuntime: SqlitePersistenceRuntime;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly deploymentPolicyBootstrap: DeploymentPolicyBootstrapResolutionResult;
}

export interface AuthoritativeServerServicesStageInput extends AuthoritativeServerConfigStageOutput {
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly persistence: AuthoritativeServerPersistenceStageOutput;
}

export interface AuthoritativeServerServicesStageOutput {
  readonly serviceRegistrationPlan: HostServiceRegistrationPlan;
  readonly apiRouteRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
  readonly comfyUiExecutionAdapter?: ComfyUiExecutionAdapterInfrastructure;
  readonly runExecutionAdapterRegistration?: AuthoritativeRunExecutionAdapterRegistration;
}

export interface AuthoritativeServerTransportStageInput extends AuthoritativeServerConfigStageOutput {
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly persistence: AuthoritativeServerPersistenceStageOutput;
  readonly services: AuthoritativeServerServicesStageOutput;
}

export interface AuthoritativeServerTransportStageOutput {
  readonly startedHost: IdentityServerHost;
}

export type AuthoritativeServerConfigBootstrapStage = BootstrapStage<
  AuthoritativeServerConfigStageInput,
  AuthoritativeServerConfigStageOutput,
  typeof AuthoritativeServerBootstrapStageIds.config
>;

export type AuthoritativeServerSecurityBootstrapStage = BootstrapStage<
  AuthoritativeServerSecurityStageInput,
  AuthoritativeServerSecurityStageOutput,
  typeof AuthoritativeServerBootstrapStageIds.security
>;

export type AuthoritativeServerPersistenceBootstrapStage = BootstrapStage<
  AuthoritativeServerPersistenceStageInput,
  AuthoritativeServerPersistenceStageOutput,
  typeof AuthoritativeServerBootstrapStageIds.persistence
>;

export type AuthoritativeServerServicesBootstrapStage = BootstrapStage<
  AuthoritativeServerServicesStageInput,
  AuthoritativeServerServicesStageOutput,
  typeof AuthoritativeServerBootstrapStageIds.services
>;

export type AuthoritativeServerTransportBootstrapStage = BootstrapStage<
  AuthoritativeServerTransportStageInput,
  AuthoritativeServerTransportStageOutput,
  typeof AuthoritativeServerBootstrapStageIds.transport
>;

export const AuthoritativeServerBootstrapStageContracts = Object.freeze({
  [AuthoritativeServerBootstrapStageIds.config]: Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.config,
    description: "Resolve startup configuration, runtime metadata, and tracer prerequisites.",
    boundary: Object.freeze({
      consumes: Object.freeze(["boot", "hostConfiguration", "startupReason", "environment"]),
      produces: Object.freeze(["deploymentProfile", "environment", "enabledCapabilities", "runtimeMetadata", "startupTracer"]),
    }),
  } satisfies BootstrapStageContract<AuthoritativeServerConfigStageInput, AuthoritativeServerConfigStageOutput>),
  [AuthoritativeServerBootstrapStageIds.security]: Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.security,
    description: "Establish transport trust, certificate authority, and required secret baseline.",
    boundary: Object.freeze({
      consumes: Object.freeze(["deploymentProfile", "environment", "enabledCapabilities", "runtimeMetadata", "startupTracer", "hostConfiguration"]),
      produces: Object.freeze(["checks"]),
    }),
  } satisfies BootstrapStageContract<AuthoritativeServerSecurityStageInput, AuthoritativeServerSecurityStageOutput>),
  [AuthoritativeServerBootstrapStageIds.persistence]: Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.persistence,
    description: "Start persistence runtime and compose persistent platform services.",
    boundary: Object.freeze({
      consumes: Object.freeze(["deploymentProfile", "environment", "enabledCapabilities", "runtimeMetadata", "startupTracer", "hostConfiguration", "security"]),
      produces: Object.freeze(["persistenceRuntime", "persistentPlatformServices", "deploymentPolicyBootstrap"]),
    }),
  } satisfies BootstrapStageContract<AuthoritativeServerPersistenceStageInput, AuthoritativeServerPersistenceStageOutput>),
  [AuthoritativeServerBootstrapStageIds.services]: Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.services,
    description: "Compose startup service registrations and transport route plan dependencies.",
    boundary: Object.freeze({
      consumes: Object.freeze(["deploymentProfile", "environment", "enabledCapabilities", "runtimeMetadata", "startupTracer", "hostConfiguration", "persistence"]),
      produces: Object.freeze(["serviceRegistrationPlan", "apiRouteRegistrationPlan", "comfyUiExecutionAdapter", "runExecutionAdapterRegistration"]),
    }),
  } satisfies BootstrapStageContract<AuthoritativeServerServicesStageInput, AuthoritativeServerServicesStageOutput>),
  [AuthoritativeServerBootstrapStageIds.transport]: Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.transport,
    description: "Start transport host with composed persistence and service dependencies.",
    boundary: Object.freeze({
      consumes: Object.freeze(["deploymentProfile", "environment", "enabledCapabilities", "runtimeMetadata", "startupTracer", "hostConfiguration", "persistence", "services"]),
      produces: Object.freeze(["startedHost"]),
    }),
  } satisfies BootstrapStageContract<AuthoritativeServerTransportStageInput, AuthoritativeServerTransportStageOutput>),
});

export const AuthoritativeServerBootstrapStageHostBindings = Object.freeze({
  [AuthoritativeServerBootstrapStageIds.config]: HostBootstrapStageIds.configuration,
  [AuthoritativeServerBootstrapStageIds.security]: HostBootstrapStageIds.security,
  [AuthoritativeServerBootstrapStageIds.persistence]: HostBootstrapStageIds.persistence,
  [AuthoritativeServerBootstrapStageIds.services]: HostBootstrapStageIds.dependencies,
  [AuthoritativeServerBootstrapStageIds.transport]: HostBootstrapStageIds.featureRegistration,
} satisfies Record<AuthoritativeServerBootstrapStageId, HostBootstrapStageId>);

export function listAuthoritativeServerBootstrapStageContracts(): ReadonlyArray<
  BootstrapStageContract<unknown, unknown, AuthoritativeServerBootstrapStageId>
> {
  return Object.freeze([
    AuthoritativeServerBootstrapStageContracts[AuthoritativeServerBootstrapStageIds.config],
    AuthoritativeServerBootstrapStageContracts[AuthoritativeServerBootstrapStageIds.security],
    AuthoritativeServerBootstrapStageContracts[AuthoritativeServerBootstrapStageIds.persistence],
    AuthoritativeServerBootstrapStageContracts[AuthoritativeServerBootstrapStageIds.services],
    AuthoritativeServerBootstrapStageContracts[AuthoritativeServerBootstrapStageIds.transport],
  ]);
}
