import type { BuildIntent } from "./BuildIntentModels";
import { BuildEntryService } from "./BuildEntry";
import { ROUTE_PATHS } from "./RouteConfig";
import { RunInterfaceService, RunContextKinds } from "./RunInterface";
import { AssetActionExecutionService, AssetIntentActionTypes, type AssetActionContext } from "./AssetIntentActions";

export const ContextualRecommendationTypes = Object.freeze({
  continueBuild: "continue-build",
  openRelatedAsset: "open-related-asset",
  runOrTest: "run-or-test",
  addToSystem: "add-to-system",
  startRelatedFlow: "start-related-flow",
  returnToExplore: "return-to-explore",
});

export type ContextualRecommendationType = typeof ContextualRecommendationTypes[keyof typeof ContextualRecommendationTypes];

export const ContextualRecommendationSurfaces = Object.freeze({
  build: "build",
  explore: "explore",
  assetDetail: "asset-detail",
  run: "run",
});

export type ContextualRecommendationSurface = typeof ContextualRecommendationSurfaces[keyof typeof ContextualRecommendationSurfaces];

export interface RecommendedNextAction {
  readonly launchPath: string;
  readonly analyticsKey: string;
}

export interface ContextualRecommendation {
  readonly id: string;
  readonly type: ContextualRecommendationType;
  readonly label: string;
  readonly description: string;
  readonly action: RecommendedNextAction;
}

export interface ContextualRecommendationContext {
  readonly surface: ContextualRecommendationSurface;
  readonly buildIntent?: BuildIntent;
  readonly buildFlowSessionId?: string;
  readonly assetActionContext?: AssetActionContext;
  readonly relatedAssetIds?: ReadonlyArray<string>;
  readonly runContextKind?: string;
  readonly runOriginPath?: string;
}

function appendBuildFlow(path: string, buildFlowSessionId?: string): string {
  if (!buildFlowSessionId) {
    return path;
  }
  const [routePath, search] = path.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set("buildFlowSessionId", buildFlowSessionId);
  return `${routePath}?${params.toString()}`;
}

export class ContextualRecommendationResolver {
  private readonly buildEntryService = new BuildEntryService();
  private readonly runInterfaceService = new RunInterfaceService();
  private readonly assetActionExecutionService = new AssetActionExecutionService();

  public resolve(context: ContextualRecommendationContext): ReadonlyArray<ContextualRecommendation> {
    const resolved: ContextualRecommendation[] = [];

    if (context.surface === ContextualRecommendationSurfaces.build) {
      resolved.push(Object.freeze({
        id: "build:continue",
        type: ContextualRecommendationTypes.continueBuild,
        label: "Continue building",
        description: "Pick a goal and continue with the next build step.",
        action: Object.freeze({
          launchPath: appendBuildFlow(this.buildEntryService.resolveBuildEntryRoute(), context.buildFlowSessionId),
          analyticsKey: "build.continue",
        }),
      }));

      resolved.push(Object.freeze({
        id: "build:explore",
        type: ContextualRecommendationTypes.openRelatedAsset,
        label: "Open existing work",
        description: "Browse existing assets before creating something new.",
        action: Object.freeze({
          launchPath: ROUTE_PATHS.explore,
          analyticsKey: "build.explore",
        }),
      }));

      resolved.push(Object.freeze({
        id: "build:run",
        type: ContextualRecommendationTypes.runOrTest,
        label: "Run or test from Build",
        description: "Launch the run surface with Build as the source context.",
        action: Object.freeze({
          launchPath: this.runInterfaceService.resolveLaunchPath({
            contextKind: RunContextKinds.general,
            source: "build",
            actionKind: "run",
            originPath: ROUTE_PATHS.build,
            originLabel: "Build",
          }),
          analyticsKey: "build.run",
        }),
      }));
    }

    if (context.surface === ContextualRecommendationSurfaces.assetDetail && context.assetActionContext) {
      const openAndModify = this.assetActionExecutionService.execute(AssetIntentActionTypes.openAndModify, context.assetActionContext);
      if (openAndModify) {
        resolved.push(Object.freeze({
          id: "asset:open-and-modify",
          type: ContextualRecommendationTypes.continueBuild,
          label: "Continue building with this asset",
          description: "Open this asset directly in the right editing flow.",
          action: Object.freeze({ launchPath: openAndModify.launchPath, analyticsKey: "asset.openAndModify" }),
        }));
      }

      const runHere = this.assetActionExecutionService.execute(AssetIntentActionTypes.runHere, context.assetActionContext);
      if (runHere) {
        resolved.push(Object.freeze({
          id: "asset:run",
          type: ContextualRecommendationTypes.runOrTest,
          label: "Run this asset",
          description: "Launch a contextual run without leaving this asset flow.",
          action: Object.freeze({ launchPath: runHere.launchPath, analyticsKey: "asset.run" }),
        }));
      }

      const addToSystem = this.assetActionExecutionService.execute(AssetIntentActionTypes.addToSystem, context.assetActionContext);
      if (addToSystem) {
        resolved.push(Object.freeze({
          id: "asset:add-to-system",
          type: ContextualRecommendationTypes.addToSystem,
          label: "Add to a system",
          description: "Use this asset as part of a larger system composition.",
          action: Object.freeze({ launchPath: addToSystem.launchPath, analyticsKey: "asset.addToSystem" }),
        }));
      }

      const firstRelated = context.relatedAssetIds?.[0];
      if (firstRelated) {
        resolved.push(Object.freeze({
          id: `asset:related:${firstRelated}`,
          type: ContextualRecommendationTypes.openRelatedAsset,
          label: "Open a related asset",
          description: `Review related asset ${firstRelated} to continue this flow.`,
          action: Object.freeze({
            launchPath: `/studio-shell/registry/assets/${encodeURIComponent(firstRelated)}`,
            analyticsKey: "asset.related",
          }),
        }));
      }
    }

    if (context.surface === ContextualRecommendationSurfaces.run) {
      resolved.push(Object.freeze({
        id: "run:continue",
        type: ContextualRecommendationTypes.startRelatedFlow,
        label: "Continue in Build",
        description: "Return to Build and keep iterating after this run.",
        action: Object.freeze({ launchPath: ROUTE_PATHS.build, analyticsKey: "run.build" }),
      }));

      if (context.runContextKind === RunContextKinds.asset && context.assetActionContext?.asset.assetId) {
        const assetId = context.assetActionContext.asset.assetId;
        resolved.push(Object.freeze({
          id: "run:return-asset",
          type: ContextualRecommendationTypes.openRelatedAsset,
          label: "Open run source asset",
          description: "Return to the asset you launched from.",
          action: Object.freeze({
            launchPath: `/studio-shell/registry/assets/${encodeURIComponent(assetId)}?assetId=${encodeURIComponent(assetId)}`,
            analyticsKey: "run.asset",
          }),
        }));
      }

      resolved.push(Object.freeze({
        id: "run:explore",
        type: ContextualRecommendationTypes.returnToExplore,
        label: "Find related assets",
        description: "Open Explore to find assets for your next run.",
        action: Object.freeze({ launchPath: ROUTE_PATHS.explore, analyticsKey: "run.explore" }),
      }));
    }

    return Object.freeze(resolved.slice(0, 4));
  }
}

export class ContextualRecommendationService {
  private readonly resolver = new ContextualRecommendationResolver();

  public resolve(context: ContextualRecommendationContext): ReadonlyArray<ContextualRecommendation> {
    return this.resolver.resolve(context);
  }
}
