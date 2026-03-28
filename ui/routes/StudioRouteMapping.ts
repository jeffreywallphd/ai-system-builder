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

export function resolveStudioRouteFromAsset(asset: Pick<RegistryAsset, "taxonomy">): string | undefined {
  const semanticRole = asset.taxonomy?.semanticRole;
  return semanticRole ? semanticRoleToStudioRoute[semanticRole] : undefined;
}

export function buildStudioHandoffQuery(asset: Pick<RegistryAsset, "assetId" | "versionId">): string {
  const params = new URLSearchParams();
  params.set("assetId", asset.assetId);
  if (asset.versionId) {
    params.set("versionId", asset.versionId);
  }
  params.set("handoff", "registry");
  return params.toString();
}
