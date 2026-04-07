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

export interface DesktopOfflineLocalModeProfileInspection {
  readonly hostId: string;
  readonly isControlPlaneClient: boolean;
  readonly isAuthoritativeControlPlane: boolean;
  readonly allowedResourceClasses: ReadonlyArray<OfflineResourceClass>;
  readonly supportedExecutionClasses: ReadonlyArray<OfflineLocalExecutionClass>;
  readonly authoritativeResourceClasses: ReadonlyArray<OfflineResourceClass>;
}

export function resolveDesktopOfflineResourceBoundary(
  resourceClass: OfflineResourceClass,
): OfflineResourceAuthorityBoundary {
  if (!DesktopOfflineAllowedResourceClasses.includes(resourceClass)) {
    throw new DesktopOfflineLocalModeProfileError(
      `Desktop offline profile does not allow resource class '${resourceClass}'.`,
    );
  }
  return resolveOfflineResourceAuthorityBoundary(resourceClass);
}

export function inspectDesktopOfflineLocalModeProfile(): DesktopOfflineLocalModeProfileInspection {
  const roleInspection = inspectHostRuntimeRole(DesktopHostRuntime);
  const authoritativeResourceClasses = DesktopOfflineAllowedResourceClasses.filter((resourceClass) => {
    const boundary = resolveOfflineResourceAuthorityBoundary(resourceClass);
    return boundary.authoritativeStateScope === OfflineAuthorityScopes.authoritativeServer;
  });

  return Object.freeze({
    hostId: DesktopHostRuntime.hostId,
    isControlPlaneClient: roleInspection.isControlPlaneClient,
    isAuthoritativeControlPlane: roleInspection.isAuthoritativeControlPlane,
    allowedResourceClasses: DesktopOfflineAllowedResourceClasses,
    supportedExecutionClasses: DesktopOfflineSupportedExecutionClasses,
    authoritativeResourceClasses: Object.freeze(authoritativeResourceClasses),
  });
}

export function evaluateDesktopOfflineLocalExecutionEligibility(
  input: Omit<OfflineLocalExecutionPolicyInput, "nodeOperationalMode">,
): OfflineLocalExecutionEligibilityEvaluation {
  if (!DesktopOfflineSupportedExecutionClasses.includes(input.executionClass as OfflineLocalExecutionClass)) {
    throw new DesktopOfflineLocalModeProfileError(
      `Desktop offline profile does not allow execution class '${input.executionClass}'.`,
    );
  }

  return evaluateOfflineLocalExecutionEligibility({
    ...input,
    nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
  });
}

export function assertDesktopOfflineLocalModeAuthorityBoundary(): void {
  const inspection = inspectDesktopOfflineLocalModeProfile();
  if (!inspection.isControlPlaneClient) {
    throw new DesktopOfflineLocalModeProfileError("Desktop offline profile requires control-plane-client host role.");
  }
  if (inspection.isAuthoritativeControlPlane) {
    throw new DesktopOfflineLocalModeProfileError(
      "Desktop offline profile cannot operate as authoritative control plane.",
    );
  }
}
