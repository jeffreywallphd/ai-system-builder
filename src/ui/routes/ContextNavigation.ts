import { BuildIntents, type BuildIntent } from "./BuildIntentModels";
import { ROUTE_PATHS } from "./RouteConfig";
import { ShellRouteResolver } from "./IntentNavigationShell";
import { UxStudioEntryLabelResolver } from "../taxonomy/UxTaxonomySuppression";
import { resolveRouteSurfaceMetadataByPath } from "./SurfaceRouteMetadataCatalog";

export interface BreadcrumbItem {
  readonly key: string;
  readonly label: string;
  readonly path?: string;
}

export interface FlowContextNavigation {
  readonly buildFlowSessionId?: string;
  readonly buildIntent?: BuildIntent;
  readonly buildIntentSelectedAt?: string;
  readonly assetId?: string;
  readonly registryContext?: string;
}

export interface RouteContextMetadata {
  readonly routeKey: string;
  readonly title: string;
  readonly shellSection: "build" | "explore" | "run";
}

export interface ContextNavigationModel {
  readonly route: RouteContextMetadata;
  readonly breadcrumbs: ReadonlyArray<BreadcrumbItem>;
  readonly flowContext: FlowContextNavigation;
  readonly returnPath?: string;
}

export interface ContextNavigationRequest {
  readonly pathname: string;
  readonly search: string;
}

const intentLabels: Readonly<Record<BuildIntent, string>> = Object.freeze({
  [BuildIntents.automateTask]: "Automate a task",
  [BuildIntents.createAiAssistant]: "Create an AI assistant",
  [BuildIntents.trainModel]: "Train a model",
  [BuildIntents.workWithData]: "Work with data",
  [BuildIntents.startFromScratch]: "Start from scratch",
});

function decodeIntent(value: string | null): BuildIntent | undefined {
  if (!value) {
    return undefined;
  }
  return Object.values(BuildIntents).includes(value as BuildIntent) ? value as BuildIntent : undefined;
}

function parseFlowContext(search: string): FlowContextNavigation {
  const params = new URLSearchParams(search);
  return Object.freeze({
    buildFlowSessionId: params.get("buildFlowSessionId")?.trim() || undefined,
    buildIntent: decodeIntent(params.get("buildIntent")),
    buildIntentSelectedAt: params.get("buildIntentSelectedAt")?.trim() || undefined,
    assetId: params.get("assetId")?.trim() || undefined,
    registryContext: params.get("registryContext")?.trim() || undefined,
  });
}

export class BreadcrumbResolver {
  private readonly labelResolver = new UxStudioEntryLabelResolver();
  private readonly shellRouteResolver = new ShellRouteResolver();

  public resolve(request: ContextNavigationRequest): ContextNavigationModel {
    const flowContext = parseFlowContext(request.search);
    const shell = this.shellRouteResolver.resolve(request.pathname);
    const route = this.resolveRouteMetadata(request.pathname, shell?.shellKey);
    const breadcrumbs: BreadcrumbItem[] = [{ key: route.shellSection, label: route.title, path: route.shellSection === "build" ? ROUTE_PATHS.build : route.shellSection === "explore" ? ROUTE_PATHS.explore : ROUTE_PATHS.run }];

    if (route.routeKey === "build") {
      if (flowContext.buildIntent) {
        breadcrumbs.push({
          key: "build-intent",
          label: intentLabels[flowContext.buildIntent],
          path: ROUTE_PATHS.build,
        });
      }
      if (request.pathname.startsWith("/studio-shell") || request.pathname.startsWith("/agent-studio")) {
        breadcrumbs.push({ key: "studio-mode", label: this.labelResolver.resolveNavigationTitle("studio-mode", "Studio mode") });
      }
    }

    if (route.routeKey === "explore-detail") {
      breadcrumbs.push({ key: "explore-library", label: "Library", path: ROUTE_PATHS.explore });
      breadcrumbs.push({ key: "explore-detail", label: flowContext.assetId ? `Asset ${flowContext.assetId}` : "Asset detail" });
    }

    if (route.routeKey === "explore") {
      breadcrumbs.push({ key: "explore-library", label: "Library" });
    }

    if (route.routeKey === "run") {
      breadcrumbs.push({ key: "run-center", label: "Execution center" });
    }

    return Object.freeze({
      route,
      breadcrumbs: Object.freeze(breadcrumbs),
      flowContext,
      returnPath: this.resolveReturnPath(route.routeKey, flowContext),
    });
  }

  private resolveRouteMetadata(pathname: string, shellKey?: string): RouteContextMetadata {
    const routeMetadata = resolveRouteSurfaceMetadataByPath(pathname);
    if (routeMetadata?.key === "registry-asset-detail") {
      return Object.freeze({ routeKey: "explore-detail", title: "Explore", shellSection: "explore" });
    }
    if (routeMetadata?.navigation.shellSection) {
      const routeKey = routeMetadata.navigation.shellSection;
      const title = routeKey === "build" ? "Build" : routeKey === "explore" ? "Explore" : "Run";
      return Object.freeze({ routeKey, title, shellSection: routeKey });
    }

    if (shellKey === "explore") {
      return Object.freeze({ routeKey: "explore", title: "Explore", shellSection: "explore" });
    }
    if (shellKey === "run") {
      return Object.freeze({ routeKey: "run", title: "Run", shellSection: "run" });
    }
    return Object.freeze({ routeKey: "build", title: "Build", shellSection: "build" });
  }

  private resolveReturnPath(routeKey: string, flowContext: FlowContextNavigation): string | undefined {
    if (routeKey === "explore-detail") {
      if (flowContext.registryContext) {
        return `${ROUTE_PATHS.explore}?${flowContext.registryContext}`;
      }
      return ROUTE_PATHS.explore;
    }

    if (routeKey === "build" && flowContext.buildFlowSessionId) {
      return `${ROUTE_PATHS.build}?buildFlowSessionId=${encodeURIComponent(flowContext.buildFlowSessionId)}`;
    }

    return undefined;
  }
}

export class ContextNavigationService {
  private readonly resolver = new BreadcrumbResolver();

  public resolve(request: ContextNavigationRequest): ContextNavigationModel {
    return this.resolver.resolve(request);
  }
}
