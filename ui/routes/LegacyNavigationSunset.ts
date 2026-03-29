import { IntentNavigationFeatureFlag } from "../features/IntentNavigationFeatureFlag";
import {
  LegacyNavigationCompatibilityModes,
  LegacyNavigationFeatureFlag,
  type LegacyNavigationCompatibilityMode,
} from "../features/LegacyNavigationFeatureFlag";
import { ROUTE_PATHS } from "./RouteConfig";

export const LegacyNavigationEntryStates = Object.freeze({
  visible: "visible",
  hidden: "hidden",
  redirect: "redirect",
});

export type LegacyNavigationEntryState = typeof LegacyNavigationEntryStates[keyof typeof LegacyNavigationEntryStates];

export const LegacyNavigationEntries = Object.freeze({
  create: "create",
  compose: "compose",
  workflows: "workflows",
  tools: "tools",
  models: "models",
  context: "context",
  mcp: "mcp",
  services: "services",
  assets: "assets",
  agentStudio: "agent-studio",
  studioShell: "studio-shell",
});

export type LegacyNavigationEntry = typeof LegacyNavigationEntries[keyof typeof LegacyNavigationEntries];

const legacyEntryByRouteKey: Readonly<Record<string, LegacyNavigationEntry | undefined>> = Object.freeze({
  workflows: LegacyNavigationEntries.workflows,
  tools: LegacyNavigationEntries.tools,
  models: LegacyNavigationEntries.models,
  context: LegacyNavigationEntries.context,
  mcp: LegacyNavigationEntries.mcp,
  services: LegacyNavigationEntries.services,
  assets: LegacyNavigationEntries.assets,
  "agent-studio": LegacyNavigationEntries.agentStudio,
  "studio-shell": LegacyNavigationEntries.studioShell,
});

const canonicalDestinations: Readonly<Record<LegacyNavigationEntry, string>> = Object.freeze({
  [LegacyNavigationEntries.create]: ROUTE_PATHS.build,
  [LegacyNavigationEntries.compose]: ROUTE_PATHS.build,
  [LegacyNavigationEntries.workflows]: ROUTE_PATHS.build,
  [LegacyNavigationEntries.tools]: ROUTE_PATHS.run,
  [LegacyNavigationEntries.models]: ROUTE_PATHS.explore,
  [LegacyNavigationEntries.context]: ROUTE_PATHS.explore,
  [LegacyNavigationEntries.mcp]: ROUTE_PATHS.explore,
  [LegacyNavigationEntries.services]: ROUTE_PATHS.explore,
  [LegacyNavigationEntries.assets]: ROUTE_PATHS.explore,
  [LegacyNavigationEntries.agentStudio]: ROUTE_PATHS.build,
  [LegacyNavigationEntries.studioShell]: ROUTE_PATHS.build,
});

export class LegacyNavigationRedirectResolver {
  public resolve(entry: LegacyNavigationEntry): string {
    return canonicalDestinations[entry];
  }
}

export class LegacyNavigationSunsetPolicy {
  private readonly redirectResolver = new LegacyNavigationRedirectResolver();

  constructor(private readonly compatibilityMode: LegacyNavigationCompatibilityMode) {}

  public evaluateEntry(entry: LegacyNavigationEntry): LegacyNavigationEntryState {
    if (this.compatibilityMode === LegacyNavigationCompatibilityModes.visible) {
      return LegacyNavigationEntryStates.visible;
    }

    if (this.compatibilityMode === LegacyNavigationCompatibilityModes.compatibility) {
      if (entry === LegacyNavigationEntries.create || entry === LegacyNavigationEntries.compose || entry === LegacyNavigationEntries.studioShell) {
        return LegacyNavigationEntryStates.redirect;
      }
      return LegacyNavigationEntryStates.hidden;
    }

    return LegacyNavigationEntryStates.redirect;
  }

  public shouldShowEntry(entry: LegacyNavigationEntry): boolean {
    return this.evaluateEntry(entry) === LegacyNavigationEntryStates.visible;
  }

  public resolveCanonicalDestination(entry: LegacyNavigationEntry): string {
    return this.redirectResolver.resolve(entry);
  }
}

export interface NavigationMigrationServiceOptions {
  readonly intentNavigationFlag?: IntentNavigationFeatureFlag;
  readonly legacyNavigationFlag?: LegacyNavigationFeatureFlag;
}

export class NavigationMigrationService {
  private readonly mode: LegacyNavigationCompatibilityMode;
  private readonly policy: LegacyNavigationSunsetPolicy;

  constructor(options: NavigationMigrationServiceOptions = {}) {
    const intentFlag = options.intentNavigationFlag ?? new IntentNavigationFeatureFlag();
    const legacyFlag = options.legacyNavigationFlag ?? new LegacyNavigationFeatureFlag();
    const defaultMode = intentFlag.isEnabled()
      ? LegacyNavigationCompatibilityModes.sunset
      : LegacyNavigationCompatibilityModes.visible;
    this.mode = legacyFlag.resolveMode(defaultMode);
    this.policy = new LegacyNavigationSunsetPolicy(this.mode);
  }

  public resolveMode(): LegacyNavigationCompatibilityMode {
    return this.mode;
  }

  public shouldShowNavigationRoute(routeKey: string): boolean {
    const entry = legacyEntryByRouteKey[routeKey];
    if (!entry) {
      return true;
    }
    return this.policy.shouldShowEntry(entry);
  }

  public shouldRedirectPath(pathname: string): boolean {
    return this.resolvePathRedirect(pathname) !== undefined;
  }

  public resolvePathRedirect(pathname: string): string | undefined {
    const entry = this.resolvePathEntry(pathname);
    if (!entry) {
      return undefined;
    }
    return this.policy.evaluateEntry(entry) === LegacyNavigationEntryStates.redirect
      ? this.policy.resolveCanonicalDestination(entry)
      : undefined;
  }

  private resolvePathEntry(pathname: string): LegacyNavigationEntry | undefined {
    if (pathname === "/create") {
      return LegacyNavigationEntries.create;
    }
    if (pathname === "/compose") {
      return LegacyNavigationEntries.compose;
    }
    if (pathname === ROUTE_PATHS.workflows) {
      return LegacyNavigationEntries.workflows;
    }
    if (pathname === ROUTE_PATHS.tools) {
      return LegacyNavigationEntries.tools;
    }
    if (pathname === ROUTE_PATHS.models) {
      return LegacyNavigationEntries.models;
    }
    if (pathname === ROUTE_PATHS.context) {
      return LegacyNavigationEntries.context;
    }
    if (pathname === ROUTE_PATHS.mcp) {
      return LegacyNavigationEntries.mcp;
    }
    if (pathname === ROUTE_PATHS.services) {
      return LegacyNavigationEntries.services;
    }
    if (pathname === ROUTE_PATHS.assets) {
      return LegacyNavigationEntries.assets;
    }
    if (pathname === ROUTE_PATHS.agentStudio) {
      return LegacyNavigationEntries.agentStudio;
    }
    if (pathname === ROUTE_PATHS.studioShell) {
      return LegacyNavigationEntries.studioShell;
    }
    return undefined;
  }
}

export interface DeprecatedUxRoutePolicy {
  readonly routePath: string;
  readonly entry: LegacyNavigationEntry;
  readonly canonicalPath: string;
  readonly state: LegacyNavigationEntryState;
}

export interface LegacyUxCleanupPlan {
  readonly generatedAtIso: string;
  readonly compatibilityMode: LegacyNavigationCompatibilityMode;
  readonly deprecatedRoutes: ReadonlyArray<DeprecatedUxRoutePolicy>;
}

const deprecatedRouteCatalog: ReadonlyArray<{ readonly routePath: string; readonly entry: LegacyNavigationEntry }> = Object.freeze([
  Object.freeze({ routePath: ROUTE_PATHS.create, entry: LegacyNavigationEntries.create }),
  Object.freeze({ routePath: ROUTE_PATHS.compose, entry: LegacyNavigationEntries.compose }),
  Object.freeze({ routePath: ROUTE_PATHS.workflows, entry: LegacyNavigationEntries.workflows }),
  Object.freeze({ routePath: ROUTE_PATHS.tools, entry: LegacyNavigationEntries.tools }),
  Object.freeze({ routePath: ROUTE_PATHS.models, entry: LegacyNavigationEntries.models }),
  Object.freeze({ routePath: ROUTE_PATHS.context, entry: LegacyNavigationEntries.context }),
  Object.freeze({ routePath: ROUTE_PATHS.mcp, entry: LegacyNavigationEntries.mcp }),
  Object.freeze({ routePath: ROUTE_PATHS.services, entry: LegacyNavigationEntries.services }),
  Object.freeze({ routePath: ROUTE_PATHS.assets, entry: LegacyNavigationEntries.assets }),
  Object.freeze({ routePath: ROUTE_PATHS.agentStudio, entry: LegacyNavigationEntries.agentStudio }),
  Object.freeze({ routePath: ROUTE_PATHS.studioShell, entry: LegacyNavigationEntries.studioShell }),
]);

export class LegacyUxCleanupPlanner {
  private readonly policy: LegacyNavigationSunsetPolicy;

  constructor(private readonly mode: LegacyNavigationCompatibilityMode) {
    this.policy = new LegacyNavigationSunsetPolicy(mode);
  }

  public createPlan(): LegacyUxCleanupPlan {
    return Object.freeze({
      generatedAtIso: new Date().toISOString(),
      compatibilityMode: this.mode,
      deprecatedRoutes: Object.freeze(
        deprecatedRouteCatalog.map((route) => Object.freeze({
          routePath: route.routePath,
          entry: route.entry,
          canonicalPath: this.policy.resolveCanonicalDestination(route.entry),
          state: this.policy.evaluateEntry(route.entry),
        })),
      ),
    });
  }
}
