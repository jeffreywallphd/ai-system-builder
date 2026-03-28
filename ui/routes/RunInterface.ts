import { ROUTE_PATHS } from "./RouteConfig";

export const RunContextKinds = Object.freeze({
  asset: "asset",
  system: "system",
  tool: "tool",
  general: "general",
});

export type RunContextKind = typeof RunContextKinds[keyof typeof RunContextKinds];

export interface RunLaunchRequest {
  readonly contextKind?: RunContextKind;
  readonly assetId?: string;
  readonly versionId?: string;
  readonly source?: "build" | "explore" | "detail" | "direct";
  readonly runIntentLabel?: string;
}

export interface RunSurfaceModel {
  readonly title: string;
  readonly subtitle: string;
  readonly contextLabel: string;
  readonly primaryActionLabel: string;
  readonly primaryActionPath: string;
}

export interface RunPresentationModel {
  readonly launchPath: string;
  readonly shellTitle: string;
  readonly shellSubtitle: string;
  readonly surface: RunSurfaceModel;
}

function appendQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export class RunContextResolver {
  public fromSearch(search: string): RunLaunchRequest {
    const params = new URLSearchParams(search);
    const contextKind = params.get("context")?.trim();
    const mappedContext = Object.values(RunContextKinds).includes(contextKind as RunContextKind)
      ? contextKind as RunContextKind
      : RunContextKinds.general;
    return Object.freeze({
      contextKind: mappedContext,
      assetId: params.get("assetId")?.trim() || undefined,
      versionId: params.get("versionId")?.trim() || undefined,
      source: (params.get("source")?.trim() as RunLaunchRequest["source"]) || undefined,
      runIntentLabel: params.get("intent")?.trim() || undefined,
    });
  }

  public toSearchParams(request: RunLaunchRequest): URLSearchParams {
    const params = new URLSearchParams();
    params.set("context", request.contextKind ?? RunContextKinds.general);
    if (request.assetId) {
      params.set("assetId", request.assetId);
    }
    if (request.versionId) {
      params.set("versionId", request.versionId);
    }
    if (request.source) {
      params.set("source", request.source);
    }
    if (request.runIntentLabel) {
      params.set("intent", request.runIntentLabel);
    }
    return params;
  }
}

export class RunInterfaceService {
  private readonly contextResolver = new RunContextResolver();

  public resolveLaunchPath(request: RunLaunchRequest): string {
    return appendQuery(ROUTE_PATHS.run, this.contextResolver.toSearchParams(request));
  }

  public resolvePresentation(search: string): RunPresentationModel {
    const request = this.contextResolver.fromSearch(search);
    const surface = this.resolveSurface(request);
    return Object.freeze({
      launchPath: this.resolveLaunchPath(request),
      shellTitle: "Run",
      shellSubtitle: "Use one run surface to launch tests and review execution outcomes.",
      surface,
    });
  }

  private resolveSurface(request: RunLaunchRequest): RunSurfaceModel {
    const label = request.assetId ? `for ${request.assetId}` : "from anywhere in Build or Explore";
    if (request.contextKind === RunContextKinds.system) {
      return Object.freeze({
        title: "Run a system",
        subtitle: "Launch system execution with context inferred from your selected system asset.",
        contextLabel: label,
        primaryActionLabel: "Open system runner",
        primaryActionPath: ROUTE_PATHS.systemStudio,
      });
    }
    if (request.contextKind === RunContextKinds.tool) {
      return Object.freeze({
        title: "Run a tool",
        subtitle: "Launch a tool run without opening runtime infrastructure screens.",
        contextLabel: label,
        primaryActionLabel: "Open tool runs",
        primaryActionPath: ROUTE_PATHS.tools,
      });
    }
    return Object.freeze({
      title: "Run and test",
      subtitle: "Start execution from a bounded context and monitor outcomes in UX-facing run history.",
      contextLabel: label,
      primaryActionLabel: "Open tool runs",
      primaryActionPath: ROUTE_PATHS.tools,
    });
  }
}
