import type { HostBootstrapStageId } from "@hosts/bootstrap/HostBootstrapPipeline";
import { HostBootstrapStageIds } from "@hosts/bootstrap/HostBootstrapPipeline";
import type { AuthoritativeServerBootstrapStageId } from "../../AuthoritativeServerBootstrapStageContracts";
import { AuthoritativeServerBootstrapStageIds } from "../../AuthoritativeServerBootstrapStageContracts";
import {
  AuthoritativeServerCompositionModuleIds,
  type AuthoritativeServerCompositionModuleId,
} from "./AuthoritativeServerCompositionModuleContracts";

export interface AuthoritativeServerCompositionModuleDescriptor {
  readonly moduleId: AuthoritativeServerCompositionModuleId;
  readonly contractType: string;
  readonly summary: string;
  readonly ownedSharedBootstrapStages: ReadonlyArray<HostBootstrapStageId>;
  readonly ownedAuthoritativeStages: ReadonlyArray<AuthoritativeServerBootstrapStageId>;
  readonly dependsOn: ReadonlyArray<AuthoritativeServerCompositionModuleId>;
  readonly producedArtifacts: ReadonlyArray<string>;
  readonly disposalResponsibilities: ReadonlyArray<string>;
}

export const AuthoritativeServerCompositionModuleMap = Object.freeze([
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.startupConfiguration,
    contractType: "ServerStartupConfigurationCompositionModuleContract",
    summary: "Resolve startup profile/environment/capabilities and tracer/runtime metadata inputs.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.configuration]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.config]),
    dependsOn: Object.freeze([]),
    producedArtifacts: Object.freeze([
      "deploymentProfile",
      "environment",
      "enabledCapabilities",
      "runtimeMetadata",
      "startupTracer",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.securityBootstrap,
    contractType: "ServerSecurityBootstrapCompositionModuleContract",
    summary: "Compose secrets, certificate authority readiness, and transport trust baseline state.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.security]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.security]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
    ]),
    producedArtifacts: Object.freeze([
      "securityBootstrap",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
    contractType: "ServerPersistenceBootstrapCompositionModuleContract",
    summary: "Start persistence runtime and compose authoritative persistent platform services.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.persistence]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.persistence]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
      AuthoritativeServerCompositionModuleIds.securityBootstrap,
    ]),
    producedArtifacts: Object.freeze([
      "persistenceRuntime",
      "persistentPlatformServices",
    ]),
    disposalResponsibilities: Object.freeze([
      "dispose persistent platform services",
      "dispose sqlite persistence runtime",
    ]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.policyBootstrap,
    contractType: "ServerPolicyBootstrapCompositionModuleContract",
    summary: "Resolve deployment policy bootstrap and policy evaluation startup context.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.persistence]),
    ownedAuthoritativeStages: Object.freeze([]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
    ]),
    producedArtifacts: Object.freeze([
      "deploymentPolicyBootstrap",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.servicePlan,
    contractType: "ServerServicePlanCompositionModuleContract",
    summary: "Compose and validate authoritative control-plane service registration coverage.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.dependencies]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.services]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
    ]),
    producedArtifacts: Object.freeze([
      "serviceRegistrationPlan",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.routePlan,
    contractType: "ServerRoutePlanCompositionModuleContract",
    summary: "Compose and validate authoritative API route-family registration coverage.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.dependencies]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.services]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
    ]),
    producedArtifacts: Object.freeze([
      "apiRouteRegistrationPlan",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.executionAdapter,
    contractType: "ServerExecutionAdapterCompositionModuleContract",
    summary: "Compose optional execution adapter infrastructure and run-execution adapter registration.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.dependencies]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.services]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
    ]),
    producedArtifacts: Object.freeze([
      "executionInfrastructureEnabled",
      "comfyUiExecutionAdapter",
      "runExecutionAdapterRegistration",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.controlPlaneApi,
    contractType: "ServerControlPlaneApiCompositionModuleContract",
    summary: "Assemble control-plane API startup options from bounded upstream composition module outputs.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.featureRegistration]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.transport]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
      AuthoritativeServerCompositionModuleIds.securityBootstrap,
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
      AuthoritativeServerCompositionModuleIds.policyBootstrap,
      AuthoritativeServerCompositionModuleIds.servicePlan,
      AuthoritativeServerCompositionModuleIds.routePlan,
      AuthoritativeServerCompositionModuleIds.executionAdapter,
    ]),
    producedArtifacts: Object.freeze([
      "hostStartupOptions",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.orchestrationRecovery,
    contractType: "ServerOrchestrationRecoveryCompositionModuleContract",
    summary: "Run pre-listen orchestration and audit startup reconciliation with explicit issue reporting.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.featureRegistration]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.transport]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
      AuthoritativeServerCompositionModuleIds.policyBootstrap,
    ]),
    producedArtifacts: Object.freeze([
      "orchestrationRecoverySummary",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.transport,
    contractType: "ServerTransportCompositionModuleContract",
    summary: "Start and own the authoritative transport runtime lifecycle from composed control-plane startup options.",
    ownedSharedBootstrapStages: Object.freeze([HostBootstrapStageIds.featureRegistration]),
    ownedAuthoritativeStages: Object.freeze([AuthoritativeServerBootstrapStageIds.transport]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.controlPlaneApi,
      AuthoritativeServerCompositionModuleIds.orchestrationRecovery,
    ]),
    producedArtifacts: Object.freeze([
      "startedHost",
    ]),
    disposalResponsibilities: Object.freeze([
      "close runtime host transport",
    ]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
  Object.freeze({
    moduleId: AuthoritativeServerCompositionModuleIds.diagnostics,
    contractType: "ServerDiagnosticsCompositionModuleContract",
    summary: "Provide startup spans, summary emission, and baseline recording contracts shared by all modules.",
    ownedSharedBootstrapStages: Object.freeze([]),
    ownedAuthoritativeStages: Object.freeze([]),
    dependsOn: Object.freeze([
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
    ]),
    producedArtifacts: Object.freeze([
      "diagnosticsHooks",
    ]),
    disposalResponsibilities: Object.freeze([]),
  } satisfies AuthoritativeServerCompositionModuleDescriptor),
]);

export function listAuthoritativeServerCompositionModules(): ReadonlyArray<AuthoritativeServerCompositionModuleDescriptor> {
  return AuthoritativeServerCompositionModuleMap;
}
