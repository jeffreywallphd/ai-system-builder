import { BuildEntryService } from "./BuildEntry";
import { APP_ROUTES, ROUTE_PATHS, type AppRouteDefinition } from "./RouteConfig";
import { IntentNavigationFeatureFlag } from "../features/IntentNavigationFeatureFlag";

export const PrimaryNavigationItemKeys = Object.freeze({
  build: "build",
  explore: "explore",
  run: "run",
});

export type PrimaryNavigationItemKey = typeof PrimaryNavigationItemKeys[keyof typeof PrimaryNavigationItemKeys];

export interface PrimaryNavigationItem {
  readonly key: string;
  readonly title: string;
  readonly path: string;
  readonly isIntentPrimary: boolean;
}

export interface PrimaryNavigationModel {
  readonly isIntentNavigationEnabled: boolean;
  readonly items: ReadonlyArray<PrimaryNavigationItem>;
  readonly activeKey?: string;
}

export interface ShellNavigationContext {
  readonly pathname: string;
}

export interface ShellRouteResolution {
  readonly shellKey: PrimaryNavigationItemKey;
  readonly canonicalPath: string;
}

function toLegacyNavigationRoutes(routes: ReadonlyArray<AppRouteDefinition>): ReadonlyArray<PrimaryNavigationItem> {
  return routes
    .filter((route) => route.showInNavigation)
    .map((route) => Object.freeze({
      key: route.key,
      title: route.title,
      path: route.path,
      isIntentPrimary: false,
    }));
}

export class ShellRouteResolver {
  public resolve(pathname: string): ShellRouteResolution | undefined {
    if (pathname === ROUTE_PATHS.explore || pathname.startsWith("/explore/") || pathname === ROUTE_PATHS.registry || pathname.startsWith("/studio-shell/registry")) {
      return Object.freeze({ shellKey: PrimaryNavigationItemKeys.explore, canonicalPath: ROUTE_PATHS.explore });
    }
    if (pathname === ROUTE_PATHS.build || (pathname.startsWith("/studio-shell") && !pathname.startsWith("/studio-shell/registry")) || pathname.startsWith("/agent-studio") || pathname.startsWith("/workflows")) {
      return Object.freeze({ shellKey: PrimaryNavigationItemKeys.build, canonicalPath: ROUTE_PATHS.build });
    }
    if (pathname === ROUTE_PATHS.run || pathname.startsWith("/run") || pathname.startsWith("/tools")) {
      return Object.freeze({ shellKey: PrimaryNavigationItemKeys.run, canonicalPath: ROUTE_PATHS.run });
    }
    return undefined;
  }
}

export class IntentNavigationShell {
  private readonly routeResolver = new ShellRouteResolver();
  private readonly buildEntryService = new BuildEntryService();
  constructor(private readonly featureFlag = new IntentNavigationFeatureFlag()) {}

  public resolvePrimaryNavigation(context: ShellNavigationContext): PrimaryNavigationModel {
    const routeResolution = this.routeResolver.resolve(context.pathname);
    if (!this.featureFlag.isEnabled()) {
      return Object.freeze({
        isIntentNavigationEnabled: false,
        items: toLegacyNavigationRoutes(APP_ROUTES).filter((route) => {
          if (route.key === "build") {
            return this.buildEntryService.isBuildEntryEnabled();
          }
          if (route.key === "workflows" && this.buildEntryService.isBuildEntryEnabled()) {
            return false;
          }
          return true;
        }),
        activeKey: routeResolution?.shellKey,
      });
    }

    const buildPath = this.buildEntryService.resolveBuildEntryRoute();
    return Object.freeze({
      isIntentNavigationEnabled: true,
      activeKey: routeResolution?.shellKey,
      items: Object.freeze([
        Object.freeze({
          key: PrimaryNavigationItemKeys.build,
          title: "Build",
          path: buildPath,
          isIntentPrimary: true,
        }),
        Object.freeze({
          key: PrimaryNavigationItemKeys.explore,
          title: "Explore",
          path: ROUTE_PATHS.explore,
          isIntentPrimary: true,
        }),
        Object.freeze({
          key: PrimaryNavigationItemKeys.run,
          title: "Run",
          path: ROUTE_PATHS.run,
          isIntentPrimary: true,
        }),
      ]),
    });
  }
}
