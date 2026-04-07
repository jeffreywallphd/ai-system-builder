import {
  type OfflineResourceAuthorityBoundary,
  type OfflineResourceClass,
  OfflineAuthorityScopes,
  OfflineResourceClasses,
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

export interface DesktopOfflineLocalModeProfileInspection {
  readonly hostId: string;
  readonly isControlPlaneClient: boolean;
  readonly isAuthoritativeControlPlane: boolean;
  readonly allowedResourceClasses: ReadonlyArray<OfflineResourceClass>;
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
    authoritativeResourceClasses: Object.freeze(authoritativeResourceClasses),
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
