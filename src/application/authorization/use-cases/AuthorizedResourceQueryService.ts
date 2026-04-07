import { createPermissionKey, type PermissionKey } from "@domain/authorization/AuthorizationDomain";
import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationActorReference,
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationResourcePolicyMetadata,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationPolicyEvaluationTargetKinds } from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";

export const AuthorizedResourceAccessFilters = Object.freeze({
  owner: "owner",
  shared: "shared",
});

export type AuthorizedResourceAccessFilter =
  typeof AuthorizedResourceAccessFilters[keyof typeof AuthorizedResourceAccessFilters];

export interface AuthorizedResourceQueryRequest {
  readonly actor: AuthorizationActorReference;
  readonly workspaceId: string;
  readonly requiredPermissionKey: PermissionKey;
  readonly resourceFamilies?: ReadonlyArray<AuthorizationResourceFamily>;
  readonly resourceTypes?: ReadonlyArray<string>;
  readonly searchText?: string;
  readonly accessFilters?: ReadonlyArray<AuthorizedResourceAccessFilter>;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AuthorizedResourceQueryItem {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
  readonly ownerUserIdentityId: string;
  readonly visibility: AuthorizationResourcePolicyMetadata["visibility"];
  readonly isOwnedByActor: boolean;
  readonly isSharedWithActor: boolean;
}

export interface AuthorizedResourceQueryResult {
  readonly items: ReadonlyArray<AuthorizedResourceQueryItem>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export const AuthorizedResourceQueryErrorCodes = Object.freeze({
  invalidRequest: "authorized-resource-query-invalid-request",
});

export type AuthorizedResourceQueryErrorCode =
  typeof AuthorizedResourceQueryErrorCodes[keyof typeof AuthorizedResourceQueryErrorCodes];

export interface AuthorizedResourceQueryError {
  readonly code: AuthorizedResourceQueryErrorCode;
  readonly message: string;
}

export type AuthorizedResourceQueryOutcome =
  | {
    readonly ok: true;
    readonly value: AuthorizedResourceQueryResult;
  }
  | {
    readonly ok: false;
    readonly error: AuthorizedResourceQueryError;
  };

interface AuthorizedResourceQueryServiceDependencies {
  readonly resourcePolicyMetadataReadRepository: IAuthorizationResourcePolicyMetadataReadRepository;
  readonly policyDecisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
}

interface NormalizedQueryRequest {
  readonly actor: AuthorizationActorReference;
  readonly workspaceId: string;
  readonly requiredPermissionKey: PermissionKey;
  readonly resourceFamilies?: ReadonlySet<AuthorizationResourceFamily>;
  readonly resourceTypes?: ReadonlySet<string>;
  readonly searchText?: string;
  readonly accessFilters?: ReadonlySet<AuthorizedResourceAccessFilter>;
  readonly asOf?: string;
  readonly limit: number;
  readonly offset: number;
}

const DefaultLimit = 25;
const MaxLimit = 100;

export class AuthorizedResourceQueryService {
  public constructor(private readonly dependencies: AuthorizedResourceQueryServiceDependencies) {}

  public async listAuthorizedResources(request: AuthorizedResourceQueryRequest): Promise<AuthorizedResourceQueryOutcome> {
    const normalized = this.normalizeRequest(request);
    if (!normalized) {
      return this.failure(
        "workspaceId, requiredPermissionKey, actor identity, and valid pagination values are required.",
      );
    }

    const candidates = await this.dependencies.resourcePolicyMetadataReadRepository.listResourcePolicyMetadata({
      workspaceId: normalized.workspaceId,
      asOf: normalized.asOf,
    });

    const sortedCandidates = [...candidates]
      .filter((candidate) => this.matchesPreFilters(candidate, normalized))
      .sort(comparePolicyMetadata);

    const targetCount = normalized.offset + normalized.limit + 1;
    const visible: AuthorizedResourceQueryItem[] = [];

    for (const candidate of sortedCandidates) {
      const decisionRequest: AuthorizationPolicyDecisionEvaluationRequest = {
        actor: normalized.actor,
        requiredPermissionKey: normalized.requiredPermissionKey,
        target: {
          kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
          resource: {
            resourceFamily: candidate.resourceFamily,
            resourceType: candidate.resourceType,
            resourceId: candidate.resourceId,
          },
        },
        asOf: normalized.asOf,
      };

      const decisionResult = await this.dependencies.policyDecisionEvaluator.evaluateDecision(decisionRequest);
      if (!decisionResult.decision.isAllowed) {
        continue;
      }

      const actorUserIdentityId = normalized.actor.actorUserIdentityId?.trim();
      const isOwnedByActor = !!actorUserIdentityId && candidate.ownerUserIdentityId === actorUserIdentityId;
      const isSharedWithActor = decisionResult.decision.matchedSharingGrantIds.length > 0;

      if (!matchesAccessFilters(normalized.accessFilters, isOwnedByActor, isSharedWithActor)) {
        continue;
      }

      visible.push(Object.freeze({
        resourceFamily: candidate.resourceFamily,
        resourceType: candidate.resourceType,
        resourceId: candidate.resourceId,
        workspaceId: candidate.workspaceId,
        ownerUserIdentityId: candidate.ownerUserIdentityId,
        visibility: candidate.visibility,
        isOwnedByActor,
        isSharedWithActor,
      }));

      if (visible.length >= targetCount) {
        break;
      }
    }

    const page = visible.slice(normalized.offset, normalized.offset + normalized.limit);
    return {
      ok: true,
      value: Object.freeze({
        items: Object.freeze(page),
        pagination: Object.freeze({
          limit: normalized.limit,
          offset: normalized.offset,
          returned: page.length,
          hasMore: visible.length > normalized.offset + normalized.limit,
        }),
      }),
    };
  }

  private normalizeRequest(request: AuthorizedResourceQueryRequest): NormalizedQueryRequest | undefined {
    const workspaceId = request.workspaceId.trim();
    const normalizedPermissionKey = normalizeOptionalString(request.requiredPermissionKey);
    const actorUserIdentityId = request.actor.actorUserIdentityId?.trim();
    const actorServiceId = request.actor.actorServiceId?.trim();
    if (!workspaceId || !normalizedPermissionKey || (!actorUserIdentityId && !actorServiceId)) {
      return undefined;
    }

    let requiredPermissionKey: PermissionKey;
    try {
      requiredPermissionKey = createPermissionKey(normalizedPermissionKey);
    } catch {
      return undefined;
    }

    const limit = Number.isInteger(request.limit) && (request.limit ?? 0) > 0
      ? Math.min(request.limit as number, MaxLimit)
      : DefaultLimit;
    const offset = Number.isInteger(request.offset) && (request.offset ?? -1) >= 0
      ? (request.offset as number)
      : 0;

    const normalizedFamilies = toNormalizedStringSet(request.resourceFamilies);
    const normalizedTypes = toNormalizedStringSet(request.resourceTypes);
    const normalizedSearchText = normalizeOptionalString(request.searchText)?.toLowerCase();
    const normalizedAccessFilters = request.accessFilters && request.accessFilters.length > 0
      ? new Set(request.accessFilters)
      : undefined;

    return Object.freeze({
      actor: Object.freeze({
        ...request.actor,
        actorUserIdentityId,
        actorServiceId,
        activeWorkspaceId: normalizeOptionalString(request.actor.activeWorkspaceId),
        authenticatedAt: normalizeOptionalString(request.actor.authenticatedAt),
      }),
      workspaceId,
      requiredPermissionKey,
      resourceFamilies: normalizedFamilies as ReadonlySet<AuthorizationResourceFamily> | undefined,
      resourceTypes: normalizedTypes,
      searchText: normalizedSearchText,
      accessFilters: normalizedAccessFilters,
      asOf: normalizeOptionalString(request.asOf),
      limit,
      offset,
    });
  }

  private matchesPreFilters(
    metadata: AuthorizationResourcePolicyMetadata,
    request: NormalizedQueryRequest,
  ): boolean {
    if (request.resourceFamilies && !request.resourceFamilies.has(metadata.resourceFamily)) {
      return false;
    }
    if (request.resourceTypes && !request.resourceTypes.has(metadata.resourceType)) {
      return false;
    }
    if (!request.searchText) {
      return true;
    }
    const searchField = `${metadata.resourceFamily}:${metadata.resourceType}:${metadata.resourceId}`.toLowerCase();
    return searchField.includes(request.searchText);
  }

  private failure(message: string): AuthorizedResourceQueryOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code: AuthorizedResourceQueryErrorCodes.invalidRequest,
        message,
      }),
    };
  }
}

function comparePolicyMetadata(
  left: AuthorizationResourcePolicyMetadata,
  right: AuthorizationResourcePolicyMetadata,
): number {
  const byFamily = left.resourceFamily.localeCompare(right.resourceFamily);
  if (byFamily !== 0) {
    return byFamily;
  }
  const byType = left.resourceType.localeCompare(right.resourceType);
  if (byType !== 0) {
    return byType;
  }
  return left.resourceId.localeCompare(right.resourceId);
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : undefined;
}

function toNormalizedStringSet(values?: ReadonlyArray<string>): ReadonlySet<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (normalized.length === 0) {
    return undefined;
  }

  return new Set(normalized);
}

function matchesAccessFilters(
  accessFilters: ReadonlySet<AuthorizedResourceAccessFilter> | undefined,
  isOwnedByActor: boolean,
  isSharedWithActor: boolean,
): boolean {
  if (!accessFilters || accessFilters.size === 0) {
    return true;
  }

  if (accessFilters.has(AuthorizedResourceAccessFilters.owner) && isOwnedByActor) {
    return true;
  }

  if (accessFilters.has(AuthorizedResourceAccessFilters.shared) && isSharedWithActor) {
    return true;
  }

  return false;
}

