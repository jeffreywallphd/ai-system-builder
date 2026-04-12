import type { WorkspaceAuthorizationRoleKey } from "@domain/authorization/AuthorizationRoleDefinitions";

export const UiSurfaceKeys = Object.freeze({
  desktopAdmin: "desktop-admin",
  desktopOperational: "desktop-operational",
  thinClientOperational: "thin-client-operational",
  adminLite: "admin-lite",
});

export type UiSurfaceKey = typeof UiSurfaceKeys[keyof typeof UiSurfaceKeys];

export const UiRouteGroupKeys = Object.freeze({
  authentication: "authentication",
  primary: "primary",
  studio: "studio",
  operations: "operations",
  administration: "administration",
  onboarding: "onboarding",
  system: "system",
});

export type UiRouteGroupKey = typeof UiRouteGroupKeys[keyof typeof UiRouteGroupKeys];

export const WorkspaceContextRequirement = Object.freeze({
  none: "none",
  optional: "optional",
  required: "required",
});

export type WorkspaceContextRequirement = typeof WorkspaceContextRequirement[keyof typeof WorkspaceContextRequirement];

export const ShellSectionKeys = Object.freeze({
  build: "build",
  explore: "explore",
  run: "run",
});

export type ShellSectionKey = typeof ShellSectionKeys[keyof typeof ShellSectionKeys];

export interface RouteAccessMetadata {
  readonly eligibleSurfaces: ReadonlyArray<UiSurfaceKey>;
  readonly requiredRoles?: ReadonlyArray<WorkspaceAuthorizationRoleKey>;
  readonly requiredCapabilities?: ReadonlyArray<string>;
  readonly workspaceContext: WorkspaceContextRequirement;
}

export interface RouteNavigationMetadata {
  readonly showInPrimaryNavigation?: boolean;
  readonly showInSettingsNavigation?: boolean;
  readonly showInCommandPalette?: boolean;
  readonly commandPaletteLabel?: string;
  readonly commandPaletteDescription?: string;
  readonly commandPaletteKeywords?: ReadonlyArray<string>;
  readonly commandPaletteOrder?: number;
  readonly shellSection?: ShellSectionKey;
}

export interface SurfaceRouteMetadata<TKey extends string = string> {
  readonly key: TKey;
  readonly path: string;
  readonly title: string;
  readonly group: UiRouteGroupKey;
  readonly access: RouteAccessMetadata;
  readonly navigation: RouteNavigationMetadata;
}

export interface SurfaceAvailabilityContext {
  readonly surface: UiSurfaceKey;
  readonly roleKeys?: ReadonlyArray<WorkspaceAuthorizationRoleKey>;
  readonly capabilityKeys?: ReadonlyArray<string>;
  readonly hasWorkspaceContext?: boolean;
  readonly strict?: boolean;
}

function hasAnyRole(
  requiredRoles: ReadonlyArray<WorkspaceAuthorizationRoleKey> | undefined,
  roleKeys: ReadonlyArray<WorkspaceAuthorizationRoleKey> | undefined,
  strict: boolean,
): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  if (!roleKeys || roleKeys.length === 0) {
    return !strict;
  }

  return requiredRoles.some((requiredRole) => roleKeys.includes(requiredRole));
}

function hasAllCapabilities(
  requiredCapabilities: ReadonlyArray<string> | undefined,
  capabilityKeys: ReadonlyArray<string> | undefined,
  strict: boolean,
): boolean {
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    return true;
  }
  if (!capabilityKeys || capabilityKeys.length === 0) {
    return !strict;
  }

  return requiredCapabilities.every((requiredCapability) => capabilityKeys.includes(requiredCapability));
}

function hasWorkspaceContextAccess(
  requirement: WorkspaceContextRequirement,
  hasWorkspaceContext: boolean | undefined,
  strict: boolean,
): boolean {
  if (requirement === WorkspaceContextRequirement.none) {
    return true;
  }
  if (hasWorkspaceContext === true) {
    return true;
  }
  if (hasWorkspaceContext === false) {
    return requirement === WorkspaceContextRequirement.optional;
  }
  return !strict;
}

export function isRouteAvailableForSurface<TKey extends string>(
  route: SurfaceRouteMetadata<TKey>,
  context: SurfaceAvailabilityContext,
): boolean {
  const strict = context.strict ?? false;

  if (!route.access.eligibleSurfaces.includes(context.surface)) {
    return false;
  }

  if (!hasAnyRole(route.access.requiredRoles, context.roleKeys, strict)) {
    return false;
  }

  if (!hasAllCapabilities(route.access.requiredCapabilities, context.capabilityKeys, strict)) {
    return false;
  }

  return hasWorkspaceContextAccess(route.access.workspaceContext, context.hasWorkspaceContext, strict);
}

export function filterRoutesForSurface<TKey extends string>(
  routes: ReadonlyArray<SurfaceRouteMetadata<TKey>>,
  context: SurfaceAvailabilityContext,
): ReadonlyArray<SurfaceRouteMetadata<TKey>> {
  return Object.freeze(routes.filter((route) => isRouteAvailableForSurface(route, context)));
}
