import { BuildEntryService } from "./BuildEntry";
import { ROUTE_PATHS } from "./RouteConfig";
import { IntentNavigationFeatureFlag } from "../features/IntentNavigationFeatureFlag";
import { listPrimaryNavigationRouteMetadata, resolveRouteSurfaceMetadataByPath } from "./SurfaceRouteMetadataCatalog";
import { UiSurfaceKeys } from "../shared/navigation/SurfaceNavigationMetadata";

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

function toLegacyNavigationRoutes(): ReadonlyArray<PrimaryNavigationItem> {
  const routes = listPrimaryNavigationRouteMetadata({ surface: UiSurfaceKeys.desktopOperational });
  return routes
    .map((route) => Object.freeze({
      key: route.key,
      title: route.title,
      path: route.path,
      isIntentPrimary: false,
    }));
}

export class ShellRouteResolver {
  public resolve(pathname: string): ShellRouteResolution | undefined {
    const routeMetadata = resolveRouteSurfaceMetadataByPath(pathname);
    const shellSection = routeMetadata?.navigation.shellSection;
    if (shellSection === PrimaryNavigationItemKeys.explore) {
      return Object.freeze({ shellKey: PrimaryNavigationItemKeys.explore, canonicalPath: ROUTE_PATHS.explore });
    }
    if (shellSection === PrimaryNavigationItemKeys.build) {
      return Object.freeze({ shellKey: PrimaryNavigationItemKeys.build, canonicalPath: ROUTE_PATHS.build });
    }
    if (shellSection === PrimaryNavigationItemKeys.run) {
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
        items: toLegacyNavigationRoutes().filter((route) => {
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
