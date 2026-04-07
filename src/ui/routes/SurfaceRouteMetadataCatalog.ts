import {
  ShellSectionKeys,
  UiRouteGroupKeys,
  UiSurfaceKeys,
  WorkspaceContextRequirement,
  isRouteAvailableForSurface,
  type ShellSectionKey,
  type SurfaceAvailabilityContext,
  type SurfaceRouteMetadata,
} from "../shared/navigation/SurfaceNavigationMetadata";
import { APP_ROUTES, ROUTE_PATHS, type AppRouteDefinition } from "./RouteConfig";

export type AppRouteKey = AppRouteDefinition["key"];

export type AppSurfaceRouteMetadata = SurfaceRouteMetadata<AppRouteKey>;

interface RouteMetadataOverride {
  readonly group?: AppSurfaceRouteMetadata["group"];
  readonly navigation?: Partial<AppSurfaceRouteMetadata["navigation"]>;
  readonly access?: Partial<AppSurfaceRouteMetadata["access"]>;
}

const defaultEligibleSurfaces = Object.freeze([
  UiSurfaceKeys.desktopAdmin,
  UiSurfaceKeys.desktopOperational,
  UiSurfaceKeys.thinClientOperational,
  UiSurfaceKeys.adminLite,
]);

const routeMetadataOverrides: Readonly<Record<string, RouteMetadataOverride>> = Object.freeze({
  build: Object.freeze({
    group: UiRouteGroupKeys.primary,
    navigation: Object.freeze({
      showInPrimaryNavigation: true,
      shellSection: ShellSectionKeys.build,
      showInCommandPalette: true,
      commandPaletteOrder: 10,
      commandPaletteLabel: "Build",
      commandPaletteDescription: "Open Build.",
      commandPaletteKeywords: Object.freeze(["go", "open", "build"]),
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.thinClientOperational,
      ]),
      workspaceContext: WorkspaceContextRequirement.none,
    }),
  }),
  workflows: Object.freeze({
    group: UiRouteGroupKeys.primary,
    navigation: Object.freeze({
      showInPrimaryNavigation: true,
      shellSection: ShellSectionKeys.build,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
      ]),
    }),
  }),
  explore: Object.freeze({
    group: UiRouteGroupKeys.primary,
    navigation: Object.freeze({
      shellSection: ShellSectionKeys.explore,
      showInCommandPalette: true,
      commandPaletteOrder: 30,
      commandPaletteLabel: "Explore",
      commandPaletteDescription: "Open Explore.",
      commandPaletteKeywords: Object.freeze(["go", "open", "explore", "library"]),
    }),
  }),
  registry: Object.freeze({
    group: UiRouteGroupKeys.primary,
    navigation: Object.freeze({
      shellSection: ShellSectionKeys.explore,
    }),
  }),
  run: Object.freeze({
    group: UiRouteGroupKeys.primary,
    navigation: Object.freeze({
      shellSection: ShellSectionKeys.run,
      showInCommandPalette: true,
      commandPaletteOrder: 20,
      commandPaletteLabel: "Run",
      commandPaletteDescription: "Open Run.",
      commandPaletteKeywords: Object.freeze(["go", "open", "run", "test"]),
    }),
  }),
  tools: Object.freeze({
    group: UiRouteGroupKeys.primary,
    navigation: Object.freeze({
      shellSection: ShellSectionKeys.run,
    }),
  }),
  dataset-studio: Object.freeze({
    group: UiRouteGroupKeys.studio,
    navigation: Object.freeze({
      showInCommandPalette: true,
      commandPaletteOrder: 40,
      commandPaletteLabel: "Data",
      commandPaletteDescription: "Open Data Studio.",
      commandPaletteKeywords: Object.freeze(["go", "open", "data", "dataset", "dataset studio"]),
    }),
  }),
  settings: Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInCommandPalette: true,
      commandPaletteOrder: 50,
      commandPaletteLabel: "Manage",
      commandPaletteDescription: "Open Manage.",
      commandPaletteKeywords: Object.freeze(["go", "open", "manage", "settings"]),
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.adminLite,
      ]),
    }),
  }),
  "authorization-sharing": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["workflow.share", "asset.share"]),
      workspaceContext: WorkspaceContextRequirement.optional,
    }),
  }),
  "authorization-sharing-thin": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.thinClientOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin", "member"]),
      requiredCapabilities: Object.freeze(["workflow.share"]),
      workspaceContext: WorkspaceContextRequirement.optional,
    }),
  }),
  "authorization-reporting": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["log.read"]),
      workspaceContext: WorkspaceContextRequirement.optional,
    }),
  }),
  "storage-admin": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["storage-instance.manage"]),
      workspaceContext: WorkspaceContextRequirement.required,
    }),
  }),
  "workspace-admin": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["system.manage"]),
      workspaceContext: WorkspaceContextRequirement.required,
    }),
  }),
  "node-enrollment-review": Object.freeze({
    group: UiRouteGroupKeys.operations,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["node-trust.manage"]),
    }),
  }),
  "node-inventory": Object.freeze({
    group: UiRouteGroupKeys.operations,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin", "member"]),
      requiredCapabilities: Object.freeze(["node-trust.read"]),
    }),
  }),
  "workspace-thin-membership": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.thinClientOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin", "member"]),
      requiredCapabilities: Object.freeze(["system.read"]),
      workspaceContext: WorkspaceContextRequirement.required,
    }),
  }),
  "trusted-devices": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["system.manage"]),
    }),
  }),
  "identity-admin": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
      showInCommandPalette: true,
      commandPaletteOrder: 60,
      commandPaletteLabel: "Identity admin",
      commandPaletteDescription: "Open Identity administration.",
      commandPaletteKeywords: Object.freeze(["go", "open", "identity", "admin", "accounts"]),
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.desktopOperational,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["system.manage"]),
    }),
  }),
  "secrets-admin": Object.freeze({
    group: UiRouteGroupKeys.administration,
    navigation: Object.freeze({
      showInSettingsNavigation: true,
    }),
    access: Object.freeze({
      eligibleSurfaces: Object.freeze([
        UiSurfaceKeys.desktopAdmin,
        UiSurfaceKeys.adminLite,
      ]),
      requiredRoles: Object.freeze(["owner", "admin"]),
      requiredCapabilities: Object.freeze(["secret-metadata.manage"]),
    }),
  }),
});

function inferDefaultGroup(path: string): AppSurfaceRouteMetadata["group"] {
  if (path.startsWith("/auth/")) {
    return UiRouteGroupKeys.authentication;
  }
  if (path.startsWith("/settings/")) {
    return UiRouteGroupKeys.administration;
  }
  if (path.startsWith("/studio-shell/") || path.startsWith("/agent-studio")) {
    return UiRouteGroupKeys.studio;
  }
  if (path.startsWith("/workspaces/")) {
    return UiRouteGroupKeys.onboarding;
  }
  if (path === ROUTE_PATHS.notFound) {
    return UiRouteGroupKeys.system;
  }
  return UiRouteGroupKeys.operations;
}

function inferDefaultShellSection(path: string): ShellSectionKey | undefined {
  if (path === ROUTE_PATHS.build || path.startsWith("/workflows") || path.startsWith("/studio-shell/workflow") || path.startsWith("/agent-studio")) {
    return ShellSectionKeys.build;
  }
  if (path === ROUTE_PATHS.explore || path === ROUTE_PATHS.registry || path.startsWith("/studio-shell/registry")) {
    return ShellSectionKeys.explore;
  }
  if (path === ROUTE_PATHS.run || path.startsWith("/run") || path.startsWith("/tools")) {
    return ShellSectionKeys.run;
  }
  return undefined;
}

function normalizeMetadata(route: AppRouteDefinition): AppSurfaceRouteMetadata {
  const override = routeMetadataOverrides[route.key];
  const baseNavigation = Object.freeze({
    showInPrimaryNavigation: route.showInNavigation ?? false,
    shellSection: inferDefaultShellSection(route.path),
  });
  const baseAccess = Object.freeze({
    eligibleSurfaces: defaultEligibleSurfaces,
    workspaceContext: WorkspaceContextRequirement.none,
  });

  return Object.freeze({
    key: route.key,
    path: route.path,
    title: route.title,
    group: override?.group ?? inferDefaultGroup(route.path),
    navigation: Object.freeze({
      ...baseNavigation,
      ...override?.navigation,
    }),
    access: Object.freeze({
      ...baseAccess,
      ...override?.access,
    }),
  });
}

export const APP_ROUTE_SURFACE_METADATA: ReadonlyArray<AppSurfaceRouteMetadata> = Object.freeze(
  APP_ROUTES.map((route) => normalizeMetadata(route)),
);

export function getRouteSurfaceMetadata(key: AppRouteKey): AppSurfaceRouteMetadata | undefined {
  return APP_ROUTE_SURFACE_METADATA.find((route) => route.key === key);
}

export function resolveRouteSurfaceMetadataByPath(pathname: string): AppSurfaceRouteMetadata | undefined {
  return APP_ROUTE_SURFACE_METADATA.find((route) => {
    if (route.path === pathname) {
      return true;
    }
    if (route.path.includes("/:")) {
      const patternSegments = route.path.split("/").filter((segment) => segment.length > 0);
      const pathSegments = pathname.split("/").filter((segment) => segment.length > 0);
      if (patternSegments.length !== pathSegments.length) {
        return false;
      }
      return patternSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
    }
    return false;
  });
}

export interface SurfaceNavigationContext extends SurfaceAvailabilityContext {
  readonly showInPrimaryNavigation?: boolean;
}

export function listPrimaryNavigationRouteMetadata(
  context: SurfaceAvailabilityContext,
): ReadonlyArray<AppSurfaceRouteMetadata> {
  return Object.freeze(
    APP_ROUTE_SURFACE_METADATA.filter((route) => (
      route.navigation.showInPrimaryNavigation && isRouteAvailableForSurface(route, context)
    )),
  );
}

export function listSettingsShortcutRouteMetadata(
  context: SurfaceAvailabilityContext,
): ReadonlyArray<AppSurfaceRouteMetadata> {
  return Object.freeze(
    APP_ROUTE_SURFACE_METADATA.filter((route) => (
      route.navigation.showInSettingsNavigation && isRouteAvailableForSurface(route, context)
    )),
  );
}

export interface CommandPaletteRouteEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly keywords: ReadonlyArray<string>;
  readonly launchPath: string;
  readonly order: number;
}

export function listCommandPaletteRouteEntries(
  context: SurfaceAvailabilityContext,
): ReadonlyArray<CommandPaletteRouteEntry> {
  return Object.freeze(
    APP_ROUTE_SURFACE_METADATA
      .filter((route) => (
        route.navigation.showInCommandPalette && isRouteAvailableForSurface(route, context)
      ))
      .map((route) => Object.freeze({
        id: `nav:${route.key}`,
        label: route.navigation.commandPaletteLabel ?? route.title,
        description: route.navigation.commandPaletteDescription ?? `Open ${route.title}.`,
        keywords: route.navigation.commandPaletteKeywords ?? Object.freeze(["go", "open", route.title.toLowerCase()]),
        launchPath: route.path,
        order: route.navigation.commandPaletteOrder ?? 1000,
      }))
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label)),
  );
}
