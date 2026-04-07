import type { RegistryAsset } from "@domain/asset-registry/RegistryAsset";
import { BuildIntentRoutingService } from "./BuildIntentRouting";
import { BuildIntents, type BuildIntent } from "./BuildIntentModels";
import { InlineAssetCreationModes, InlineAssetCreationService } from "./InlineAssetCreation";
import { StudioEntryModes, type StudioEntryRequest, type StudioEntryResolution } from "@application/studio-entry/StudioEntryContracts";
import { StudioEntryResolver, StudioEntryService } from "./StudioRouteMapping";
import { InlineRunActionResolver, InlineRunLaunchService } from "./InlineRunActions";
import { UxRunActionKinds } from "../runtime/UxRuntimeService";

export const AssetIntentActionTypes = Object.freeze({
  buildFromThis: "build-from-this",
  openAndModify: "open-and-modify",
  addToSystem: "add-to-system",
  runHere: "run-here",
  testHere: "test-here",
  extendOrConnect: "extend-or-connect",
});

export type AssetIntentActionType = typeof AssetIntentActionTypes[keyof typeof AssetIntentActionTypes];

export interface AssetActionContext {
  readonly asset: Pick<RegistryAsset, "assetId" | "versionId" | "taxonomy">;
  readonly source: "detail" | "explore";
  readonly registryContextQuery?: string;
  readonly buildFlowSessionId?: string;
  readonly buildIntent?: string;
  readonly buildIntentSelectedAt?: string;
}

export interface AssetIntentAction {
  readonly type: AssetIntentActionType;
  readonly label: string;
  readonly enabled: boolean;
  readonly reason?: string;
}

export interface AssetActionExecutionResult {
  readonly launchPath: string;
  readonly studioEntry?: StudioEntryResolution;
}

function appendContext(path: string, context: AssetActionContext): string {
  const [routePath, search] = path.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set("assetActionSource", context.source);
  if (context.registryContextQuery) {
    params.set("registryContext", context.registryContextQuery);
  }
  if (context.buildFlowSessionId) {
    params.set("buildFlowSessionId", context.buildFlowSessionId);
  }
  if (context.buildIntent) {
    params.set("buildIntent", context.buildIntent);
  }
  if (context.buildIntentSelectedAt) {
    params.set("buildIntentSelectedAt", context.buildIntentSelectedAt);
  }
  return `${routePath}?${params.toString()}`;
}

function resolveBuildIntent(asset: Pick<RegistryAsset, "taxonomy">): BuildIntent {
  const role = asset.taxonomy?.semanticRole;
  if (role === "dataset" || role === "dataset-pipeline") {
    return BuildIntents.workWithData;
  }
  if (role === "model" || role === "training-recipe") {
    return BuildIntents.trainModel;
  }
  if (role === "agent") {
    return BuildIntents.createAiAssistant;
  }
  return BuildIntents.automateTask;
}

export class AssetIntentActionResolver {
  private readonly inlineRunResolver = new InlineRunActionResolver();

  public resolveActions(context: AssetActionContext): ReadonlyArray<AssetIntentAction> {
    const structuralKind = context.asset.taxonomy?.structuralKind;
    const canAddToSystem = structuralKind !== "system";
    const inlineRunActions = this.inlineRunResolver.resolveForAsset(context);

    return Object.freeze([
      Object.freeze({ type: AssetIntentActionTypes.buildFromThis, label: "Build from this", enabled: true }),
      Object.freeze({ type: AssetIntentActionTypes.openAndModify, label: "Open and modify", enabled: true }),
      Object.freeze({ type: AssetIntentActionTypes.addToSystem, label: "Add to system", enabled: canAddToSystem, reason: canAddToSystem ? undefined : "Already a system" }),
      Object.freeze({ type: AssetIntentActionTypes.runHere, label: inlineRunActions[0].label, enabled: inlineRunActions[0].enabled, reason: inlineRunActions[0].reason }),
      Object.freeze({ type: AssetIntentActionTypes.testHere, label: inlineRunActions[1].label, enabled: inlineRunActions[1].enabled, reason: inlineRunActions[1].reason }),
      Object.freeze({ type: AssetIntentActionTypes.extendOrConnect, label: "Extend / connect", enabled: true }),
    ]);
  }
}

export class AssetActionExecutionService {
  private readonly resolver = new StudioEntryResolver();
  private readonly studioEntryService = new StudioEntryService();
  private readonly buildIntentRoutingService = new BuildIntentRoutingService();
  private readonly inlineCreationService = new InlineAssetCreationService();
  private readonly inlineRunLaunchService = new InlineRunLaunchService();

  public execute(action: AssetIntentActionType, context: AssetActionContext): AssetActionExecutionResult | undefined {
    if (action === AssetIntentActionTypes.buildFromThis) {
      const decision = this.buildIntentRoutingService.decideRoute({
        selection: {
          intent: resolveBuildIntent(context.asset),
          selectedAtIso: new Date().toISOString(),
        },
        entryContext: {
          source: context.source === "detail" ? "registry" : "unknown",
          registryContext: context.registryContextQuery,
        },
        prefill: {
          sourceAssetId: context.asset.assetId,
          sourceVersionId: context.asset.versionId,
        },
      });
      return Object.freeze({ launchPath: appendContext(decision.launchPath, context), studioEntry: decision.studioEntry });
    }

    if (action === AssetIntentActionTypes.extendOrConnect && context.asset.taxonomy?.structuralKind === "system") {
      const inline = this.inlineCreationService.launch({
        requestedRole: "workflow",
        mode: InlineAssetCreationModes.systemIntake,
        context: {
          source: "registry",
          sourceIntentKey: "create-system-component",
          sourceIntentLabel: "Extend this system",
          prefill: {
            parentAssetId: context.asset.assetId,
            parentVersionId: context.asset.versionId,
          },
        },
        returnTarget: {
          routePath: `/registry/${encodeURIComponent(context.asset.assetId)}`,
          parentAssetId: context.asset.assetId,
          parentVersionId: context.asset.versionId,
        },
      });
      if (!inline) {
        return undefined;
      }
      return Object.freeze({ launchPath: appendContext(inline.launchPath, context), studioEntry: inline.studioEntry });
    }

    if (action === AssetIntentActionTypes.runHere || action === AssetIntentActionTypes.testHere) {
      const semanticRole = context.asset.taxonomy?.semanticRole;
      const inlineRun = this.inlineRunLaunchService.launch({
        action: action === AssetIntentActionTypes.testHere ? UxRunActionKinds.test : UxRunActionKinds.run,
        target: {
          kind: semanticRole === "system"
            ? "system"
            : semanticRole === "workflow"
              ? "workflow"
              : "asset",
          assetId: context.asset.assetId,
          versionId: context.asset.versionId,
        },
        context: {
          source: context.source,
          registryContextQuery: context.registryContextQuery,
          buildFlowSessionId: context.buildFlowSessionId,
          buildIntent: context.buildIntent,
          buildIntentSelectedAt: context.buildIntentSelectedAt,
          originPath: context.source === "detail" ? `/registry/${encodeURIComponent(context.asset.assetId)}` : "/explore",
          originLabel: context.source === "detail" ? "Asset detail" : "Explore",
        },
      });
      return Object.freeze({ launchPath: appendContext(inlineRun.launchPath, context) });
    }

    const request = this.toStudioEntryRequest(action, context);
    if (!request) {
      return undefined;
    }

    const launchPath = this.studioEntryService.buildStudioRoute(request);
    const studioEntry = this.resolver.resolve(request);
    if (!launchPath || !studioEntry) {
      return undefined;
    }

    return Object.freeze({ launchPath: appendContext(launchPath, context), studioEntry });
  }

  private toStudioEntryRequest(action: AssetIntentActionType, context: AssetActionContext): StudioEntryRequest | undefined {
    if (action === AssetIntentActionTypes.openAndModify) {
      return {
        requestedRole: context.asset.taxonomy?.semanticRole,
        mode: StudioEntryModes.asset,
        asset: {
          assetId: context.asset.assetId,
          versionId: context.asset.versionId,
          taxonomy: context.asset.taxonomy,
        },
      };
    }

    if (action === AssetIntentActionTypes.addToSystem) {
      return {
        requestedStudioType: "system-studio",
        mode: StudioEntryModes.intent,
        asset: {
          assetId: context.asset.assetId,
          versionId: context.asset.versionId,
          taxonomy: context.asset.taxonomy,
        },
        intent: {
          key: "add-to-system",
          label: "Add to system",
        },
        prefill: {
          values: {
            componentAssetId: context.asset.assetId,
            componentVersionId: context.asset.versionId,
          },
        },
      };
    }

    if (action === AssetIntentActionTypes.extendOrConnect) {
      return {
        requestedStudioType: "system-studio",
        mode: StudioEntryModes.intent,
        asset: {
          assetId: context.asset.assetId,
          versionId: context.asset.versionId,
          taxonomy: context.asset.taxonomy,
        },
        intent: {
          key: "extend-or-connect",
          label: "Extend / connect",
        },
        prefill: {
          values: {
            anchorAssetId: context.asset.assetId,
            anchorVersionId: context.asset.versionId,
          },
        },
      };
    }

    return undefined;
  }
}

