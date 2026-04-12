import {
  type OfflineLocalExecutionClass,
  type OfflineLocalExecutionEligibilityEvaluation,
  type OfflineLocalExecutionPolicyInput,
  type OfflineResourceAuthorityBoundary,
  type OfflineResourceClass,
  OfflineAuthorityScopes,
  OfflineLocalExecutionClasses,
  OfflineNodeOperationalModes,
  OfflineResourceClasses,
  evaluateOfflineLocalExecutionEligibility,
  resolveOfflineResourceAuthorityBoundary,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { inspectHostRuntimeRole } from "@domain/hosts/HostRuntimeDomain";
import { DesktopHostRuntime } from "@hosts/HostRuntimeCatalog";

export class DesktopOfflineLocalModeProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesktopOfflineLocalModeProfileError";
  }
}

export const DesktopOfflineResynchronizationEndpointKinds = Object.freeze({
  authoritativeServerOnly: "authoritative-server-only",
});

export type DesktopOfflineResynchronizationEndpointKind =
  typeof DesktopOfflineResynchronizationEndpointKinds[keyof typeof DesktopOfflineResynchronizationEndpointKinds];

export const DesktopOfflineAllowedResourceClasses: ReadonlyArray<OfflineResourceClass> = Object.freeze([
  OfflineResourceClasses.workspaceCatalog,
  OfflineResourceClasses.workflowDefinition,
  OfflineResourceClasses.workflowDraft,
  OfflineResourceClasses.runSubmissionIntent,
  OfflineResourceClasses.localRuntimeSession,
]);

export const DesktopOfflineSupportedExecutionClasses: ReadonlyArray<OfflineLocalExecutionClass> = Object.freeze([
  OfflineLocalExecutionClasses.localWorkflowPreview,
  OfflineLocalExecutionClasses.localWorkflowValidation,
]);

export interface DesktopOfflineLocalModePolicyContext {
  readonly deploymentProfileId?: string;
}

export interface DesktopOfflineLocalModePolicyDefinition {
  readonly allowedResourceClasses?: ReadonlyArray<OfflineResourceClass>;
  readonly supportedExecutionClasses?: ReadonlyArray<OfflineLocalExecutionClass>;
  readonly resynchronizationEndpointKind?: DesktopOfflineResynchronizationEndpointKind;
  readonly policySource?: string;
}

export interface IDesktopOfflineLocalModePolicyResolverPort {
  resolvePolicy(context: DesktopOfflineLocalModePolicyContext): DesktopOfflineLocalModePolicyDefinition | undefined;
}

export interface DesktopOfflineLocalModePolicyResolutionOptions {
  readonly policyContext?: DesktopOfflineLocalModePolicyContext;
  readonly policyResolver?: IDesktopOfflineLocalModePolicyResolverPort;
}

export interface DesktopOfflineLocalModeProfileInspection {
  readonly hostId: string;
  readonly isControlPlaneClient: boolean;
  readonly isAuthoritativeControlPlane: boolean;
  readonly deploymentProfileId?: string;
  readonly policySource: string;
  readonly resynchronizationEndpointKind: DesktopOfflineResynchronizationEndpointKind;
  readonly allowedResourceClasses: ReadonlyArray<OfflineResourceClass>;
  readonly supportedExecutionClasses: ReadonlyArray<OfflineLocalExecutionClass>;
  readonly authoritativeResourceClasses: ReadonlyArray<OfflineResourceClass>;
}

export function resolveDesktopOfflineResourceBoundary(
  resourceClass: OfflineResourceClass,
  options?: DesktopOfflineLocalModePolicyResolutionOptions,
): OfflineResourceAuthorityBoundary {
  const policy = resolveDesktopOfflineLocalModePolicy(options);
  if (!policy.allowedResourceClasses.includes(resourceClass)) {
    throw new DesktopOfflineLocalModeProfileError(
      `Desktop offline profile does not allow resource class '${resourceClass}'.`,
    );
  }
  return resolveOfflineResourceAuthorityBoundary(resourceClass);
}

export function inspectDesktopOfflineLocalModeProfile(
  options?: DesktopOfflineLocalModePolicyResolutionOptions,
): DesktopOfflineLocalModeProfileInspection {
  const policy = resolveDesktopOfflineLocalModePolicy(options);
  const roleInspection = inspectHostRuntimeRole(DesktopHostRuntime);
  const authoritativeResourceClasses = policy.allowedResourceClasses.filter((resourceClass) => {
    const boundary = resolveOfflineResourceAuthorityBoundary(resourceClass);
    return boundary.authoritativeStateScope === OfflineAuthorityScopes.authoritativeServer;
  });

  return Object.freeze({
    hostId: DesktopHostRuntime.hostId,
    isControlPlaneClient: roleInspection.isControlPlaneClient,
    isAuthoritativeControlPlane: roleInspection.isAuthoritativeControlPlane,
    deploymentProfileId: normalizeOptional(options?.policyContext?.deploymentProfileId),
    policySource: policy.policySource,
    resynchronizationEndpointKind: policy.resynchronizationEndpointKind,
    allowedResourceClasses: policy.allowedResourceClasses,
    supportedExecutionClasses: policy.supportedExecutionClasses,
    authoritativeResourceClasses: Object.freeze(authoritativeResourceClasses),
  });
}

export function evaluateDesktopOfflineLocalExecutionEligibility(
  input: Omit<OfflineLocalExecutionPolicyInput, "nodeOperationalMode">,
  options?: DesktopOfflineLocalModePolicyResolutionOptions,
): OfflineLocalExecutionEligibilityEvaluation {
  const policy = resolveDesktopOfflineLocalModePolicy(options);
  if (!policy.supportedExecutionClasses.includes(input.executionClass as OfflineLocalExecutionClass)) {
    throw new DesktopOfflineLocalModeProfileError(
      `Desktop offline profile does not allow execution class '${input.executionClass}'.`,
    );
  }

  return evaluateOfflineLocalExecutionEligibility({
    ...input,
    nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
  });
}

export function assertDesktopOfflineLocalModeAuthorityBoundary(
  options?: DesktopOfflineLocalModePolicyResolutionOptions,
): void {
  const inspection = inspectDesktopOfflineLocalModeProfile(options);
  if (!inspection.isControlPlaneClient) {
    throw new DesktopOfflineLocalModeProfileError("Desktop offline profile requires control-plane-client host role.");
  }
  if (inspection.isAuthoritativeControlPlane) {
    throw new DesktopOfflineLocalModeProfileError(
      "Desktop offline profile cannot operate as authoritative control plane.",
    );
  }
}

interface ResolvedDesktopOfflineLocalModePolicy {
  readonly allowedResourceClasses: ReadonlyArray<OfflineResourceClass>;
  readonly supportedExecutionClasses: ReadonlyArray<OfflineLocalExecutionClass>;
  readonly resynchronizationEndpointKind: DesktopOfflineResynchronizationEndpointKind;
  readonly policySource: string;
}

const DefaultDesktopOfflineLocalModePolicySource = "desktop-offline-local-mode:baseline:v1";

function resolveDesktopOfflineLocalModePolicy(
  options?: DesktopOfflineLocalModePolicyResolutionOptions,
): ResolvedDesktopOfflineLocalModePolicy {
  const overridePolicy = options?.policyResolver?.resolvePolicy(options.policyContext ?? {});
  const allowedResourceClasses = normalizeAllowedResourceClasses(overridePolicy?.allowedResourceClasses);
  const supportedExecutionClasses = normalizeSupportedExecutionClasses(overridePolicy?.supportedExecutionClasses);
  const resynchronizationEndpointKind = normalizeResynchronizationEndpointKind(
    overridePolicy?.resynchronizationEndpointKind,
  );
  const policySource = normalizeOptional(overridePolicy?.policySource) ?? DefaultDesktopOfflineLocalModePolicySource;

  return Object.freeze({
    allowedResourceClasses,
    supportedExecutionClasses,
    resynchronizationEndpointKind,
    policySource,
  });
}

function normalizeAllowedResourceClasses(
  value: ReadonlyArray<OfflineResourceClass> | undefined,
): ReadonlyArray<OfflineResourceClass> {
  if (!value) {
    return DesktopOfflineAllowedResourceClasses;
  }

  const normalized = dedupeStrings(value).map((entry) => {
    if (!DesktopOfflineAllowedResourceClasses.includes(entry as OfflineResourceClass)) {
      throw new DesktopOfflineLocalModeProfileError(
        `Desktop offline deployment policy cannot broaden resource class '${entry}'.`,
      );
    }
    return entry as OfflineResourceClass;
  });

  return Object.freeze(normalized);
}

function normalizeSupportedExecutionClasses(
  value: ReadonlyArray<OfflineLocalExecutionClass> | undefined,
): ReadonlyArray<OfflineLocalExecutionClass> {
  if (!value) {
    return DesktopOfflineSupportedExecutionClasses;
  }

  const normalized = dedupeStrings(value).map((entry) => {
    if (!DesktopOfflineSupportedExecutionClasses.includes(entry as OfflineLocalExecutionClass)) {
      throw new DesktopOfflineLocalModeProfileError(
        `Desktop offline deployment policy cannot broaden execution class '${entry}'.`,
      );
    }
    return entry as OfflineLocalExecutionClass;
  });

  return Object.freeze(normalized);
}

function normalizeResynchronizationEndpointKind(
  value: DesktopOfflineResynchronizationEndpointKind | undefined,
): DesktopOfflineResynchronizationEndpointKind {
  if (!value) {
    return DesktopOfflineResynchronizationEndpointKinds.authoritativeServerOnly;
  }

  if (value !== DesktopOfflineResynchronizationEndpointKinds.authoritativeServerOnly) {
    throw new DesktopOfflineLocalModeProfileError(
      `Desktop offline profile does not support resynchronization endpoint '${value}'.`,
    );
  }

  return value;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function dedupeStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]);
}
