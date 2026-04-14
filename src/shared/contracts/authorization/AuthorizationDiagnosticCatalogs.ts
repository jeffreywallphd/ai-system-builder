import {
  RuntimeAvailabilityBlockingReasonCodes,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";

export const AuthorizationDecisionReasonCodes = Object.freeze({
  ownerOverride: "owner-override",
  matchedSharingGrant: "matched-sharing-grant",
  matchedPermissionGrant: "matched-permission-grant",
  matchedRoleGrant: "matched-role-grant",
  visibilityWorkspaceMember: "visibility-workspace-member",
  visibilityPublished: "visibility-published",
  explicitDenyPermissionGrant: "explicit-deny-permission-grant",
  noEffectivePermission: "no-effective-permission",
  resourcePolicyMetadataNotFound: "resource-policy-metadata-not-found",
  invalidActorContext: "authorization-evaluation-invalid-actor",
  invalidPermissionKey: "authorization-evaluation-invalid-permission-key",
  invalidEvaluationContext: "authorization-evaluation-invalid-context",
  scopeMismatch: "scope-mismatch",
} as const);

export type AuthorizationDecisionReasonCode =
  typeof AuthorizationDecisionReasonCodes[keyof typeof AuthorizationDecisionReasonCodes];

export const AuthorizationDecisionDenialReasonCodes = Object.freeze({
  explicitDenyPermissionGrant: AuthorizationDecisionReasonCodes.explicitDenyPermissionGrant,
  noEffectivePermission: AuthorizationDecisionReasonCodes.noEffectivePermission,
  resourcePolicyMetadataNotFound: AuthorizationDecisionReasonCodes.resourcePolicyMetadataNotFound,
  invalidActorContext: "invalid-actor-context",
  invalidPermissionKey: "invalid-permission-key",
  invalidEvaluationContext: "invalid-evaluation-context",
  scopeMismatch: AuthorizationDecisionReasonCodes.scopeMismatch,
  insufficientPermissions: "insufficient-permissions",
} as const);

export type AuthorizationDecisionDenialReasonCode =
  typeof AuthorizationDecisionDenialReasonCodes[keyof typeof AuthorizationDecisionDenialReasonCodes];

export const AuthorizationRuntimeAvailabilityReasonCodes = Object.freeze({
  runtimeGateBlocked: "runtime-gate-blocked",
  runtimeDegraded: "runtime-degraded",
  authenticationRequired: RuntimeAvailabilityBlockingReasonCodes.authenticationRequired,
  capabilityWarmupInProgress: RuntimeAvailabilityBlockingReasonCodes.capabilityWarmupInProgress,
  runtimeNotRequested: RuntimeAvailabilityBlockingReasonCodes.runtimeNotRequested,
  policyRestricted: RuntimeAvailabilityBlockingReasonCodes.policyRestricted,
  dependencyUnavailable: RuntimeAvailabilityBlockingReasonCodes.dependencyUnavailable,
  shutdownInProgress: RuntimeAvailabilityBlockingReasonCodes.shutdownInProgress,
  runtimeInitializationFailed: RuntimeAvailabilityBlockingReasonCodes.runtimeInitializationFailed,
  unknown: RuntimeAvailabilityBlockingReasonCodes.unknown,
} as const);

export type AuthorizationRuntimeAvailabilityReasonCode =
  typeof AuthorizationRuntimeAvailabilityReasonCodes[keyof typeof AuthorizationRuntimeAvailabilityReasonCodes];

export const AuthorizationTransportMappingReasonCodes = Object.freeze({
  transportAccepted: "transport-accepted",
  transportDenied: "transport-denied",
  permissionEntryMissing: "permission-entry-missing",
  transportMappingFailed: "transport-mapping-failed",
  adapterUnavailable: "authorization-adapter-unavailable",
} as const);

export type AuthorizationTransportMappingReasonCode =
  typeof AuthorizationTransportMappingReasonCodes[keyof typeof AuthorizationTransportMappingReasonCodes];

export const AuthorizationAdapterFailureReasonCodes = Object.freeze({
  repositoryLookupFailed: "authorization-repository-lookup-failed",
  unexpectedEmptyResult: "authorization-repository-unexpected-empty-result",
  dependencyResolutionFailed: "authorization-dependency-resolution-failed",
  adapterTimeout: "authorization-adapter-timeout",
  adapterUnavailable: "authorization-adapter-unavailable",
  persistenceMappingFailed: "authorization-persistence-mapping-failed",
} as const);

export type AuthorizationAdapterFailureReasonCode =
  typeof AuthorizationAdapterFailureReasonCodes[keyof typeof AuthorizationAdapterFailureReasonCodes];

export const AuthorizationContextResolutionReasonCodes = Object.freeze({
  contextSnapshotCaptured: "context-snapshot-captured",
  workspaceContextResolved: "workspace-context-resolved",
  workspaceContextUnresolved: "workspace-context-unresolved",
  workspaceContextAmbiguous: "workspace-context-ambiguous",
  workspaceContextMissing: "workspace-context-missing",
  workspaceContextInvalid: "workspace-context-invalid",
  actorContextMissing: "actor-context-missing",
  actorContextInvalid: "actor-context-invalid",
} as const);

export type AuthorizationContextResolutionReasonCode =
  typeof AuthorizationContextResolutionReasonCodes[keyof typeof AuthorizationContextResolutionReasonCodes];

export const AuthorizationDiagnosticReasonCodes = Object.freeze({
  ...AuthorizationDecisionReasonCodes,
  ...AuthorizationRuntimeAvailabilityReasonCodes,
  ...AuthorizationTransportMappingReasonCodes,
  ...AuthorizationAdapterFailureReasonCodes,
  ...AuthorizationContextResolutionReasonCodes,
} as const);

export type AuthorizationDiagnosticReasonCode =
  typeof AuthorizationDiagnosticReasonCodes[keyof typeof AuthorizationDiagnosticReasonCodes];

export const AuthorizationDiagnosticProvenanceStages = Object.freeze({
  route: "route",
  api: "api",
  useCase: "use-case",
  actorSnapshot: "actor-snapshot",
  permissionSnapshot: "permission-snapshot",
  scopeFiltering: "scope-filtering",
  evaluator: "evaluator",
  evaluatorResolution: "evaluator-resolution",
  finalDecisionEmission: "final-decision-emission",
  adapter: "adapter",
  adapterFailure: "adapter-failure",
  transportMapping: "transport-mapping",
  runtimeReadiness: "runtime-readiness",
} as const);

export type AuthorizationDiagnosticProvenanceStage =
  typeof AuthorizationDiagnosticProvenanceStages[keyof typeof AuthorizationDiagnosticProvenanceStages];

export function isKnownAuthorizationDiagnosticReasonCode(
  value: string,
): value is AuthorizationDiagnosticReasonCode {
  return Object.values(AuthorizationDiagnosticReasonCodes).includes(value as AuthorizationDiagnosticReasonCode);
}
