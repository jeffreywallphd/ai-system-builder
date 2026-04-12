import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import type { HostBootConfiguration, HostRuntimeMetadata } from "@application/common/HostCompositionContracts";
import type { HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import type { HostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import type { StartupSpan, StartupTracer } from "@hosts/bootstrap/startupTracer";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import type { ComfyUiExecutionAdapterInfrastructure } from "@infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition";
import type { AuthoritativeRunExecutionAdapterRegistration } from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { SqlitePersistenceRuntime } from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import type {
  AuthoritativeServerConfigStageOutput,
  AuthoritativeServerSecurityStageOutput,
} from "../../AuthoritativeServerBootstrapStageContracts";
import type { AuthoritativeServerStartupBaselineRecordResult } from "../../AuthoritativeServerStartupBaselineRecorder";
import type { IdentityServerHost, IdentityServerHostOptions } from "../../IdentityServerHost";

export const AuthoritativeServerCompositionModuleIds = Object.freeze({
  startupConfiguration: "ServerStartupConfigurationCompositionModule",
  securityBootstrap: "ServerSecurityBootstrapCompositionModule",
  persistenceBootstrap: "ServerPersistenceBootstrapCompositionModule",
  policyBootstrap: "ServerPolicyBootstrapCompositionModule",
  servicePlan: "ServerServicePlanCompositionModule",
  routePlan: "ServerRoutePlanCompositionModule",
  executionAdapter: "ServerExecutionAdapterCompositionModule",
  controlPlaneApi: "ServerControlPlaneApiCompositionModule",
  orchestrationRecovery: "ServerOrchestrationRecoveryCompositionModule",
  transport: "ServerTransportCompositionModule",
  diagnostics: "ServerDiagnosticsCompositionModule",
});

export type AuthoritativeServerCompositionModuleId =
  typeof AuthoritativeServerCompositionModuleIds[keyof typeof AuthoritativeServerCompositionModuleIds];

export type MaybePromise<T> = T | Promise<T>;

export interface AuthoritativeServerCompositionLifecycleHooks {
  readonly onComposeStarting?: (input: {
    readonly moduleId: AuthoritativeServerCompositionModuleId;
  }) => MaybePromise<void>;
  readonly onComposeCompleted?: (input: {
    readonly moduleId: AuthoritativeServerCompositionModuleId;
  }) => MaybePromise<void>;
  readonly onDisposing?: (input: {
    readonly moduleId: AuthoritativeServerCompositionModuleId;
    readonly reason: string;
  }) => MaybePromise<void>;
}

export interface AuthoritativeServerCompositionDisposable {
  dispose(reason: string): MaybePromise<void>;
}

export interface AuthoritativeServerCompositionModuleContract<
  TModuleId extends AuthoritativeServerCompositionModuleId,
  TInput,
  TOutput,
> {
  readonly moduleId: TModuleId;
  readonly description: string;
  compose(input: TInput): MaybePromise<TOutput>;
}

export interface ServerStartupConfigurationCompositionModuleInput {
  readonly boot: HostBootConfiguration;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly startupReason: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export type ServerStartupConfigurationCompositionModuleOutput = AuthoritativeServerConfigStageOutput;

export interface ServerSecurityBootstrapCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export type ServerSecurityBootstrapCompositionModuleOutput = AuthoritativeServerSecurityStageOutput;

export interface ServerPersistenceBootstrapCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly securityBootstrap: ServerSecurityBootstrapCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerPersistenceBootstrapCompositionModuleOutput
  extends AuthoritativeServerCompositionDisposable {
  readonly persistenceRuntime: SqlitePersistenceRuntime;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
}

export interface ServerPolicyBootstrapCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly persistenceBootstrap: ServerPersistenceBootstrapCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerPolicyBootstrapCompositionModuleOutput {
  readonly deploymentPolicyBootstrap: DeploymentPolicyBootstrapResolutionResult;
}

export interface ServerServicePlanCompositionModuleInput {
  readonly boot: HostBootConfiguration;
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerServicePlanCompositionModuleOutput {
  readonly serviceRegistrationPlan: HostServiceRegistrationPlan;
}

export interface ServerRoutePlanCompositionModuleInput {
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerRoutePlanCompositionModuleOutput {
  readonly apiRouteRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
}

export interface ServerExecutionAdapterCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly enabled: boolean;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerExecutionAdapterCompositionModuleOutput {
  readonly executionInfrastructureEnabled: boolean;
  readonly comfyUiExecutionAdapter?: ComfyUiExecutionAdapterInfrastructure;
  readonly runExecutionAdapterRegistration?: AuthoritativeRunExecutionAdapterRegistration;
}

export interface ServerControlPlaneApiCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly securityBootstrap: ServerSecurityBootstrapCompositionModuleOutput;
  readonly persistenceBootstrap: ServerPersistenceBootstrapCompositionModuleOutput;
  readonly policyBootstrap: ServerPolicyBootstrapCompositionModuleOutput;
  readonly servicePlan: ServerServicePlanCompositionModuleOutput;
  readonly routePlan: ServerRoutePlanCompositionModuleOutput;
  readonly executionAdapter: ServerExecutionAdapterCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerControlPlaneApiCompositionModuleOutput {
  readonly hostStartupOptions: Pick<
    IdentityServerHostOptions,
    "deploymentProfile"
    | "deploymentPolicyBootstrap"
    | "persistentPlatformServices"
    | "routeRegistrationPlan"
    | "runExecutionAdapters"
    | "startupTracer"
  >;
}

export interface ServerOrchestrationRecoveryIssue {
  readonly code: string;
  readonly message: string;
}

export interface ServerOrchestrationRecoveryCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerOrchestrationRecoveryCompositionModuleOutput {
  readonly completed: boolean;
  readonly issues: ReadonlyArray<ServerOrchestrationRecoveryIssue>;
}

export interface ServerTransportCompositionModuleInput {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly controlPlaneApi: ServerControlPlaneApiCompositionModuleOutput;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerTransportCompositionModuleOutput
  extends AuthoritativeServerCompositionDisposable {
  readonly startedHost: IdentityServerHost;
}

export interface ServerDiagnosticsStartupSummaryInput {
  readonly hostId: string;
  readonly startupReason: string;
  readonly outcome: "succeeded" | "failed";
  readonly traceId?: string;
  readonly startupCorrelationId?: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly startupFailure?: Readonly<Record<string, string>>;
}

export interface ServerDiagnosticsHooks {
  readonly startupTracer: StartupTracer;
  readonly startSpan: (
    name: string,
    metadata?: Readonly<Record<string, unknown>>,
  ) => StartupSpan;
  readonly emitStartupSummary: (
    input: ServerDiagnosticsStartupSummaryInput,
  ) => MaybePromise<void>;
  readonly recordStartupBaseline?: (measurement: {
    readonly hostId: string;
    readonly startupReason: string;
    readonly outcome: "succeeded" | "failed";
    readonly durationMs: number;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly traceId?: string;
    readonly startupCorrelationId?: string;
    readonly pipelineStageDurations: Readonly<Record<string, number>>;
    readonly authoritativeStageDurations: Readonly<Record<string, number>>;
  }) => MaybePromise<AuthoritativeServerStartupBaselineRecordResult | void>;
}

export interface ServerDiagnosticsCompositionModuleInput {
  readonly boot: HostBootConfiguration;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleOutput;
  readonly lifecycleHooks?: AuthoritativeServerCompositionLifecycleHooks;
}

export interface ServerDiagnosticsCompositionModuleOutput {
  readonly hooks: ServerDiagnosticsHooks;
}

export interface ServerStartupConfigurationCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.startupConfiguration,
  ServerStartupConfigurationCompositionModuleInput,
  ServerStartupConfigurationCompositionModuleOutput
> {}

export interface ServerSecurityBootstrapCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.securityBootstrap,
  ServerSecurityBootstrapCompositionModuleInput,
  ServerSecurityBootstrapCompositionModuleOutput
> {}

export interface ServerPersistenceBootstrapCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
  ServerPersistenceBootstrapCompositionModuleInput,
  ServerPersistenceBootstrapCompositionModuleOutput
> {}

export interface ServerPolicyBootstrapCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.policyBootstrap,
  ServerPolicyBootstrapCompositionModuleInput,
  ServerPolicyBootstrapCompositionModuleOutput
> {}

export interface ServerServicePlanCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.servicePlan,
  ServerServicePlanCompositionModuleInput,
  ServerServicePlanCompositionModuleOutput
> {}

export interface ServerRoutePlanCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.routePlan,
  ServerRoutePlanCompositionModuleInput,
  ServerRoutePlanCompositionModuleOutput
> {}

export interface ServerExecutionAdapterCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.executionAdapter,
  ServerExecutionAdapterCompositionModuleInput,
  ServerExecutionAdapterCompositionModuleOutput
> {}

export interface ServerControlPlaneApiCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.controlPlaneApi,
  ServerControlPlaneApiCompositionModuleInput,
  ServerControlPlaneApiCompositionModuleOutput
> {}

export interface ServerOrchestrationRecoveryCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.orchestrationRecovery,
  ServerOrchestrationRecoveryCompositionModuleInput,
  ServerOrchestrationRecoveryCompositionModuleOutput
> {}

export interface ServerTransportCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.transport,
  ServerTransportCompositionModuleInput,
  ServerTransportCompositionModuleOutput
> {}

export interface ServerDiagnosticsCompositionModuleContract extends AuthoritativeServerCompositionModuleContract<
  typeof AuthoritativeServerCompositionModuleIds.diagnostics,
  ServerDiagnosticsCompositionModuleInput,
  ServerDiagnosticsCompositionModuleOutput
> {}

export interface AuthoritativeServerCompositionAssemblyContract {
  readonly startupConfiguration: ServerStartupConfigurationCompositionModuleContract;
  readonly securityBootstrap: ServerSecurityBootstrapCompositionModuleContract;
  readonly persistenceBootstrap: ServerPersistenceBootstrapCompositionModuleContract;
  readonly policyBootstrap: ServerPolicyBootstrapCompositionModuleContract;
  readonly servicePlan: ServerServicePlanCompositionModuleContract;
  readonly routePlan: ServerRoutePlanCompositionModuleContract;
  readonly executionAdapter: ServerExecutionAdapterCompositionModuleContract;
  readonly controlPlaneApi: ServerControlPlaneApiCompositionModuleContract;
  readonly orchestrationRecovery: ServerOrchestrationRecoveryCompositionModuleContract;
  readonly transport: ServerTransportCompositionModuleContract;
  readonly diagnostics: ServerDiagnosticsCompositionModuleContract;
}

export interface AuthoritativeServerCompositionRuntimeInputs {
  readonly boot: HostBootConfiguration;
  readonly hostConfiguration: IdentityServerHostOptions;
  readonly startupReason: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly deploymentProfile: HostDeploymentProfile;
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly runtimeMetadata: HostRuntimeMetadata;
}
