import { ContextualStudioInitializer } from "../../application/studio-entry/ContextualStudioInitializer";
import {
  StudioEntryModes,
  StudioInitializationSources,
  type StudioEntryContext,
  type StudioEntryRequest,
  type StudioEntryResolution,
} from "../../application/studio-entry/StudioEntryContracts";
import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import type { RegistryAsset } from "../../domain/asset-registry/RegistryAsset";
import { ROUTE_PATHS } from "./RouteConfig";

const semanticRoleToStudioRoute: Readonly<Partial<Record<TaxonomySemanticRole, string>>> = Object.freeze({
  model: ROUTE_PATHS.modelStudio,
  dataset: ROUTE_PATHS.datasetStudio,
  tool: ROUTE_PATHS.toolStudio,
  "prompt-template": ROUTE_PATHS.promptTemplateStudio,
  "embedding-index": ROUTE_PATHS.embeddingIndexStudio,
  "config-profile": ROUTE_PATHS.configProfileStudio,
  workflow: ROUTE_PATHS.workflowStudio,
  "context-bundle": ROUTE_PATHS.contextBundleStudio,
  "dataset-pipeline": ROUTE_PATHS.datasetPipelineStudio,
  "training-recipe": ROUTE_PATHS.trainingRecipeStudio,
  "tool-chain": ROUTE_PATHS.toolChainStudio,
  system: ROUTE_PATHS.systemStudio,
  "app-template": ROUTE_PATHS.systemStudio,
  agent: ROUTE_PATHS.agentStudio,
});

const studioTypeToRoute: Readonly<Record<string, string>> = Object.freeze({
  "model-studio": ROUTE_PATHS.modelStudio,
  "dataset-studio": ROUTE_PATHS.datasetStudio,
  "tool-studio": ROUTE_PATHS.toolStudio,
  "prompt-template-studio": ROUTE_PATHS.promptTemplateStudio,
  "embedding-index-studio": ROUTE_PATHS.embeddingIndexStudio,
  "config-profile-studio": ROUTE_PATHS.configProfileStudio,
  "workflow-studio": ROUTE_PATHS.workflowStudio,
  "context-bundle-studio": ROUTE_PATHS.contextBundleStudio,
  "dataset-pipeline-studio": ROUTE_PATHS.datasetPipelineStudio,
  "training-recipe-studio": ROUTE_PATHS.trainingRecipeStudio,
  "tool-chain-studio": ROUTE_PATHS.toolChainStudio,
  "system-studio": ROUTE_PATHS.systemStudio,
});

function resolveRouteForRequest(request: StudioEntryRequest): string | undefined {
  const requestedStudioType = request.requestedStudioType?.trim();
  if (requestedStudioType && studioTypeToRoute[requestedStudioType]) {
    return studioTypeToRoute[requestedStudioType];
  }

  const role = request.requestedRole ?? request.asset?.taxonomy?.semanticRole;
  return role ? semanticRoleToStudioRoute[role] : undefined;
}

function toSearchParams(resolution: StudioEntryResolution): URLSearchParams {
  const params = new URLSearchParams();
  const context = resolution.initializationPayload.initialization.context;
  const authoritativeAsset = context.authoritativeAsset;

  if (authoritativeAsset?.assetId) {
    params.set("assetId", authoritativeAsset.assetId);
  }
  if (authoritativeAsset?.versionId) {
    params.set("versionId", authoritativeAsset.versionId);
  }
  if (context.source !== StudioInitializationSources.blank) {
    params.set("initSource", context.source);
  }
  if (resolution.mode !== StudioEntryModes.blank) {
    params.set("entryMode", resolution.mode);
  }

  return params;
}

export class StudioEntryResolver {
  private readonly initializer = new ContextualStudioInitializer();

  public resolve(request: StudioEntryRequest): StudioEntryResolution | undefined {
    const routePath = resolveRouteForRequest(request);
    if (!routePath) {
      return undefined;
    }

    const studioType = request.requestedStudioType?.trim() || this.resolveStudioTypeFromRoute(routePath);
    const initializationPayload = this.initializer.createInitialization(studioType, request);
    return Object.freeze({
      entryPoint: Object.freeze({ studioType, routePath }),
      mode: initializationPayload.initialization.mode,
      initializationPayload,
    });
  }

  private resolveStudioTypeFromRoute(routePath: string): string {
    const found = Object.entries(studioTypeToRoute).find(([, path]) => path === routePath);
    if (found) {
      return found[0];
    }
    if (routePath === ROUTE_PATHS.agentStudio) {
      return "agent-studio";
    }
    return "studio-shell";
  }
}

export class StudioEntryService {
  private readonly resolver = new StudioEntryResolver();

  public buildStudioRoute(request: StudioEntryRequest): string | undefined {
    const resolution = this.resolver.resolve(request);
    if (!resolution) {
      return undefined;
    }

    const params = toSearchParams(resolution);
    if ([...params.keys()].length === 0) {
      return resolution.entryPoint.routePath;
    }
    return `${resolution.entryPoint.routePath}?${params.toString()}`;
  }

  public parseInitializationFromSearch(search: string) {
    const params = new URLSearchParams(search);
    const assetId = params.get("assetId")?.trim();
    const versionId = params.get("versionId")?.trim();
    const mode = params.get("entryMode")?.trim();
    const source = params.get("initSource")?.trim();

    return Object.freeze({
      mode: mode && Object.values(StudioEntryModes).includes(mode as typeof StudioEntryModes[keyof typeof StudioEntryModes])
        ? mode as typeof StudioEntryModes[keyof typeof StudioEntryModes]
        : StudioEntryModes.blank,
      context: Object.freeze({
        source: source && Object.values(StudioInitializationSources).includes(source as typeof StudioInitializationSources[keyof typeof StudioInitializationSources])
          ? source as typeof StudioInitializationSources[keyof typeof StudioInitializationSources]
          : StudioInitializationSources.route,
        authoritativeAsset: assetId
          ? Object.freeze({ assetId, versionId: versionId || undefined })
          : undefined,
      }),
    });
  }
}

export function resolveStudioRouteFromAsset(asset: Pick<RegistryAsset, "taxonomy">): string | undefined {
  const resolver = new StudioEntryResolver();
  return resolver.resolve({ requestedRole: asset.taxonomy?.semanticRole })?.entryPoint.routePath;
}

export interface StudioHandoffContext extends StudioEntryContext {
  readonly handoff?: "registry" | "system-studio";
}

export function buildStudioHandoffQuery(
  asset: Pick<RegistryAsset, "assetId" | "versionId" | "taxonomy">,
  context?: StudioHandoffContext,
): string {
  const service = new StudioEntryService();
  const request: StudioEntryRequest = {
    requestedRole: asset.taxonomy?.semanticRole,
    mode: StudioEntryModes.asset,
    asset: {
      assetId: asset.assetId,
      versionId: asset.versionId,
      taxonomy: asset.taxonomy,
    },
    entryContext: context,
  };
  const path = service.buildStudioRoute(request);
  const query = path?.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  if (context?.handoff) {
    params.set("handoff", context.handoff);
  }
  if (context?.registryContext) {
    params.set("registryContext", context.registryContext);
  }
  if (context?.parentAssetId) {
    params.set("parentAssetId", context.parentAssetId);
  }
  if (context?.parentVersionId) {
    params.set("parentVersionId", context.parentVersionId);
  }
  if (context?.selectedComponent) {
    params.set("selectedComponent", context.selectedComponent);
  }
  return params.toString();
}
