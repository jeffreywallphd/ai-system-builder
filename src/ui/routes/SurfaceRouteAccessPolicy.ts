import type { WorkspaceAuthorizationRoleKey } from "@domain/authorization/AuthorizationRoleDefinitions";
import type { IdentityAuthPersistedSession } from "../shared/identity/IdentityAuthSessionStore";
import {
  UiSurfaceKeys,
  isRouteAvailableForSurface,
  type SurfaceAvailabilityContext,
  type UiSurfaceKey,
} from "../shared/navigation/SurfaceNavigationMetadata";
import {
  APP_ROUTE_SURFACE_METADATA,
  resolveRouteSurfaceMetadataByPath,
  type AppSurfaceRouteMetadata,
} from "./SurfaceRouteMetadataCatalog";

export interface SurfaceRouteAccessPolicyOptions {
  readonly strict?: boolean;
  readonly preferredSurface?: UiSurfaceKey;
  readonly fallbackSurface?: UiSurfaceKey;
}

const memberBaselineCapabilities = Object.freeze([
  "workflow.share",
  "node-trust.read",
  "system.read",
]);

const adminCapabilitySet = Object.freeze(
  [...new Set(
    APP_ROUTE_SURFACE_METADATA.flatMap((route) => route.access.requiredCapabilities ?? [])
  )],
);

export function resolveNavigationAvailabilityContextForSession(
  session: IdentityAuthPersistedSession | undefined,
  options: SurfaceRouteAccessPolicyOptions = {},
): SurfaceAvailabilityContext {
  const strict = options.strict ?? true;
  const roleKeys = deriveRoleKeys(session);
  const isAdmin = roleKeys.includes("owner") || roleKeys.includes("admin") || session?.initialCapabilityState?.canAdministrate === true;
  const capabilityKeys = isAdmin
    ? adminCapabilitySet
    : roleKeys.includes("member")
      ? memberBaselineCapabilities
      : Object.freeze([]);

  return Object.freeze({
    surface: options.preferredSurface ?? options.fallbackSurface ?? UiSurfaceKeys.desktopOperational,
    strict,
    roleKeys,
    capabilityKeys,
    hasWorkspaceContext: resolveHasWorkspaceContext(session),
  });
}

export function isRoutePathAccessibleForSession(
  pathname: string,
  session: IdentityAuthPersistedSession | undefined,
  options: SurfaceRouteAccessPolicyOptions = {},
): boolean {
  const route = resolveRouteSurfaceMetadataByPath(pathname);
  if (!route) {
    return true;
  }

  const strict = options.strict ?? true;
  const contexts = resolveCandidateContexts(route, session, strict, options);
  return contexts.some((context) => isRouteAvailableForSurface(route, context));
}

function resolveCandidateContexts(
  route: AppSurfaceRouteMetadata,
  session: IdentityAuthPersistedSession | undefined,
  strict: boolean,
  options: SurfaceRouteAccessPolicyOptions,
): ReadonlyArray<SurfaceAvailabilityContext> {
  const surfaces = resolveCandidateSurfaces(session, options);
  const roleKeys = deriveRoleKeys(session);
  const isAdmin = roleKeys.includes("owner") || roleKeys.includes("admin") || session?.initialCapabilityState?.canAdministrate === true;
  const capabilityKeys = resolveCapabilityKeys(route, isAdmin, roleKeys);
  const hasWorkspaceContext = resolveHasWorkspaceContext(session);

  return Object.freeze(
    surfaces.map((surface) => Object.freeze({
      surface,
      strict,
      roleKeys,
      capabilityKeys,
      hasWorkspaceContext,
    })),
  );
}

function resolveCandidateSurfaces(
  session: IdentityAuthPersistedSession | undefined,
  options: SurfaceRouteAccessPolicyOptions,
): ReadonlyArray<UiSurfaceKey> {
  if (options.preferredSurface) {
    return Object.freeze([options.preferredSurface]);
  }

  if (session?.sessionAccessChannel === "desktop") {
    return Object.freeze([UiSurfaceKeys.desktopAdmin, UiSurfaceKeys.desktopOperational]);
  }
  if (session?.sessionAccessChannel === "thin-client") {
    return Object.freeze([UiSurfaceKeys.adminLite, UiSurfaceKeys.thinClientOperational]);
  }

  return Object.freeze([options.fallbackSurface ?? UiSurfaceKeys.desktopOperational]);
}

function resolveCapabilityKeys(
  route: AppSurfaceRouteMetadata,
  isAdmin: boolean,
  roleKeys: ReadonlyArray<WorkspaceAuthorizationRoleKey>,
): ReadonlyArray<string> {
  if (isAdmin) {
    return adminCapabilitySet;
  }
  if (!route.access.requiredCapabilities || route.access.requiredCapabilities.length < 1) {
    return roleKeys.includes("member") ? memberBaselineCapabilities : Object.freeze([]);
  }

  const required = new Set(route.access.requiredCapabilities);
  const derived = memberBaselineCapabilities.filter((capability) => required.has(capability));
  return Object.freeze(derived);
}

function deriveRoleKeys(session: IdentityAuthPersistedSession | undefined): ReadonlyArray<WorkspaceAuthorizationRoleKey> {
  if (!session) {
    return Object.freeze([]);
  }

  const resolvedWorkspaceId = session.workspaceContext?.resolvedWorkspaceId
    ?? session.workspaceContext?.requestedWorkspaceId
    ?? session.initialCapabilityState?.workspaceId;
  const resolvedWorkspace = resolvedWorkspaceId
    ? session.workspaceContext?.workspaces.find((workspace) => workspace.workspaceId === resolvedWorkspaceId)
    : undefined;

  const roles = new Set<WorkspaceAuthorizationRoleKey>([
    ...(resolvedWorkspace?.effectiveRoles ?? []),
    ...(session.initialCapabilityState?.effectiveRoles ?? []),
  ]);

  return Object.freeze([...roles]);
}

function resolveHasWorkspaceContext(session: IdentityAuthPersistedSession | undefined): boolean {
  if (!session) {
    return false;
  }
  return Boolean(
    session.workspaceContext?.resolvedWorkspaceId
    || session.workspaceContext?.requestedWorkspaceId
    || session.initialCapabilityState?.workspaceId,
  );
}
