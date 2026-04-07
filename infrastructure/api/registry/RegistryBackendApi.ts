import type { CrossStudioRegistryQueryService } from "../../../application/asset-registry/CrossStudioRegistryQueryService";
import type { RegistryDependencyGraphService, RegistryDependencyTraversalOptions } from "../../../application/asset-registry/RegistryDependencyGraphService";
import { ListPersistedWorkflowsUseCase } from "../../../application/workflow-persistence/ListPersistedWorkflowsUseCase";
import type { RegistryAsset } from "../../../src/domain/asset-registry/RegistryAsset";
import type { RegistryFilterParams } from "../../../application/asset-registry/RegistryQueryService";
import {
  ExploreAssetQueryService,
  type ExploreSearchQuery,
  type ExploreSearchResult,
  type UnifiedExploreAssetLibrary,
} from "../../../application/asset-registry/ExploreAssetQueryService";
import type { IAuthorizationPolicyDecisionEvaluator } from "../../../src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyEvaluationTargetKinds } from "../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationResourceFamilies } from "../../../src/domain/authorization/AuthorizationPermissionCatalog";

export interface RegistryApiError {
  readonly code: "not-found" | "invalid-request" | "internal";
  readonly message: string;
}

export interface RegistryApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: RegistryApiError;
}

export interface RegistryDependencyEndpointQuery {
  readonly assetId?: string;
  readonly versionId?: string;
}

export interface RegistryAssetDetailQuery extends RegistryDependencyEndpointQuery {}

export interface RegistryActorAuthorizationContext {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId?: string;
  readonly authenticatedAt?: string;
  readonly asOf?: string;
}

export interface RegistryTraversalEndpointQuery extends RegistryDependencyEndpointQuery {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

export interface RegistrySearchQuery {
  readonly keyword: string;
  readonly structuralKinds?: RegistryFilterParams["structuralKinds"];
  readonly semanticRoles?: RegistryFilterParams["semanticRoles"];
  readonly behaviorKinds?: RegistryFilterParams["behaviorKinds"];
  readonly contractParameterIds?: RegistryFilterParams["contractParameterIds"];
  readonly provenanceSourceTypes?: RegistryFilterParams["provenanceSourceTypes"];
  readonly limit?: number;
}

function normalizeTraversalOptions(query: RegistryTraversalEndpointQuery): RegistryDependencyTraversalOptions {
  return Object.freeze({
    maxDepth: typeof query.maxDepth === "number" && query.maxDepth > 0 ? query.maxDepth : undefined,
    maxNodes: typeof query.maxNodes === "number" && query.maxNodes > 0 ? query.maxNodes : undefined,
  });
}

export class RegistryBackendApi {
  private readonly exploreAssetQueryService: ExploreAssetQueryService;
  private readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  private readonly assetProtectedResourceType: string;
  private readonly now: () => Date;

  constructor(
    private readonly registryQueryService: CrossStudioRegistryQueryService,
    private readonly graphService: RegistryDependencyGraphService,
    listPersistedWorkflowsUseCase?: ListPersistedWorkflowsUseCase,
    options?: {
      readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
      readonly assetProtectedResourceType?: string;
      readonly now?: () => Date;
    },
  ) {
    this.exploreAssetQueryService = new ExploreAssetQueryService(
      this.registryQueryService,
      listPersistedWorkflowsUseCase
        ? {
          listPersistedWorkflows: async () => listPersistedWorkflowsUseCase.execute(),
        }
        : undefined,
    );
    this.authorizationDecisionEvaluator = options?.authorizationDecisionEvaluator;
    this.assetProtectedResourceType = options?.assetProtectedResourceType?.trim() || "registry-asset";
    this.now = options?.now ?? (() => new Date());
  }

  public async listAssets(limit?: number): Promise<RegistryApiResponse<ReadonlyArray<RegistryAsset>>> {
    return this.wrap(() => this.registryQueryService.listAllAssets(limit));
  }

  public async filterAssets(filters: RegistryFilterParams): Promise<RegistryApiResponse<ReadonlyArray<RegistryAsset>>> {
    return this.wrap(() => this.registryQueryService.listByContractFacets({
      structuralKinds: filters.structuralKinds,
      semanticRoles: filters.semanticRoles,
      behaviorKinds: filters.behaviorKinds,
      parameterIds: filters.contractParameterIds,
      invocationModes: filters.contractInvocationModes,
      sideEffects: filters.contractSideEffects,
      limit: filters.limit,
    }).then((assets) => assets.filter((asset) => {
      if (filters.provenanceSourceTypes?.length && !filters.provenanceSourceTypes.includes(asset.provenance.sourceType ?? "")) {
        return false;
      }
      if (filters.provenanceCreatorIds?.length && !filters.provenanceCreatorIds.includes(asset.provenance.creatorId ?? "")) {
        return false;
      }
      if (filters.dependsOnAssetIds?.length) {
        const set = new Set(filters.dependsOnAssetIds);
        if (!asset.dependencies.some((dep) => set.has(dep.assetId))) {
          return false;
        }
      }
      if (filters.dependsOnVersionIds?.length) {
        const set = new Set(filters.dependsOnVersionIds);
        if (!asset.dependencies.some((dep) => set.has(dep.versionId))) {
          return false;
        }
      }
      return true;
    })));
  }

  public async searchAssets(query: RegistrySearchQuery): Promise<RegistryApiResponse<ReadonlyArray<RegistryAsset>>> {
    return this.wrap(() => this.registryQueryService.searchAssets({
      keyword: query.keyword,
      structuralKinds: query.structuralKinds,
      semanticRoles: query.semanticRoles,
      behaviorKinds: query.behaviorKinds,
      parameterIds: query.contractParameterIds,
      sourceTypes: query.provenanceSourceTypes,
      limit: query.limit,
    }));
  }

  public async listExploreAssets(limit?: number): Promise<RegistryApiResponse<UnifiedExploreAssetLibrary>> {
    return this.wrap(() => this.exploreAssetQueryService.listLibrary(limit));
  }

  public async searchExploreAssets(query: ExploreSearchQuery): Promise<RegistryApiResponse<ExploreSearchResult>> {
    return this.wrap(() => this.exploreAssetQueryService.search(query));
  }

  public async getAssetDetail(
    query: RegistryAssetDetailQuery,
    actor?: RegistryActorAuthorizationContext,
  ): Promise<RegistryApiResponse<RegistryAsset>> {
    return this.wrap(async () => {
      const versionId = query.versionId?.trim();
      if (versionId) {
        const byVersion = await this.registryQueryService.getAssetByVersionId(versionId);
        if (!byVersion) {
          throw new Error("not-found:Asset or version was not found.");
        }
        await this.assertAssetReadAuthorized(byVersion.assetId, actor);
        return byVersion;
      }

      const assetId = query.assetId?.trim();
      if (!assetId) {
        throw new Error("invalid-request:assetId or versionId is required.");
      }

      const asset = await this.registryQueryService.getAssetByAssetId(assetId);
      if (!asset) {
        throw new Error("not-found:Asset or version was not found.");
      }
      await this.assertAssetReadAuthorized(asset.assetId, actor);
      return asset;
    });
  }

  private async assertAssetReadAuthorized(assetId: string, actor?: RegistryActorAuthorizationContext): Promise<void> {
    if (!this.authorizationDecisionEvaluator) {
      return;
    }
    const actorUserIdentityId = actor?.actorUserIdentityId?.trim();
    if (!actorUserIdentityId) {
      throw new Error("not-found:Asset or version was not found.");
    }
    const decision = await this.authorizationDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: actor?.activeWorkspaceId?.trim() || undefined,
        authenticatedAt: actor?.authenticatedAt?.trim() || undefined,
      }),
      requiredPermissionKey: "asset.read",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: this.assetProtectedResourceType,
          resourceId: assetId.trim(),
        }),
      }),
      asOf: actor?.asOf?.trim() || this.now().toISOString(),
    });

    if (!decision.decision.isAllowed) {
      throw new Error("not-found:Asset or version was not found.");
    }
  }

  public async getDependencies(query: RegistryDependencyEndpointQuery) {
    return this.wrap(async () => {
      const versionId = await this.resolveVersionId(query);
      if (!versionId) {
        throw new Error("not-found:Asset or version was not found.");
      }
      return this.graphService.expandDirectDependencies(versionId);
    });
  }

  public async getDependents(query: RegistryDependencyEndpointQuery) {
    return this.wrap(async () => {
      const versionId = await this.resolveVersionId(query);
      if (!versionId) {
        throw new Error("not-found:Asset or version was not found.");
      }
      return this.graphService.expandDirectDependents(versionId);
    });
  }

  public async traverseDependencies(query: RegistryTraversalEndpointQuery) {
    return this.wrap(async () => {
      const versionId = await this.resolveVersionId(query);
      if (!versionId) {
        throw new Error("not-found:Asset or version was not found.");
      }
      return this.graphService.traverseUpstream(versionId, normalizeTraversalOptions(query));
    });
  }

  public async traverseDependents(query: RegistryTraversalEndpointQuery) {
    return this.wrap(async () => {
      const versionId = await this.resolveVersionId(query);
      if (!versionId) {
        throw new Error("not-found:Asset or version was not found.");
      }
      return this.graphService.traverseDownstream(versionId, normalizeTraversalOptions(query));
    });
  }

  private async resolveVersionId(query: RegistryDependencyEndpointQuery): Promise<string | undefined> {
    const versionId = query.versionId?.trim();
    if (versionId) {
      return versionId;
    }

    const assetId = query.assetId?.trim();
    if (!assetId) {
      throw new Error("invalid-request:assetId or versionId is required.");
    }

    const asset = await this.registryQueryService.getAssetByAssetId(assetId);
    return asset?.versionId;
  }

  private async wrap<T>(action: () => Promise<T>): Promise<RegistryApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): RegistryApiError {
    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    if (message.startsWith("not-found:")) {
      return Object.freeze({ code: "not-found", message: message.slice("not-found:".length) });
    }
    if (message.startsWith("invalid-request:")) {
      return Object.freeze({ code: "invalid-request", message: message.slice("invalid-request:".length) });
    }

    return Object.freeze({ code: "internal", message });
  }
}
