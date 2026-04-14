import { AuthorizationPermissionCatalog, type CatalogPermissionKey } from "@domain/authorization/AuthorizationPermissionCatalog";
import type { RoleAssignment } from "@domain/authorization/AuthorizationDomain";
import type {
  AuthorizationPolicyDecision,
  AuthorizationResourcePolicyMetadata,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";
import {
  AuthorizationAdministrationErrorCodes,
  type AuthorizationAdministrationOutcome,
  mapAuthorizationSchemaValidationError,
  toAuthorizationFailure,
} from "./AuthorizationAdministrationUseCaseShared";
import { parseAuthorizationPolicyEvaluationRequestDto } from "@shared/schemas/authorization/AuthorizationSchemaContracts";
import { AuthorizationPolicyEvaluationTargetKinds } from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationDecisionReasonCodes } from "@shared/contracts/authorization/AuthorizationDiagnosticCatalogs";

export interface ListAuthorizationEffectiveAccessUseCaseInput {
  readonly actor: unknown;
  readonly resource: unknown;
  readonly asOf?: string;
  readonly includeDenied?: boolean;
}

export interface EffectiveAccessPermissionDecision {
  readonly permissionKey: CatalogPermissionKey;
  readonly decision: AuthorizationPolicyDecision;
  readonly explanation: EffectiveAccessPermissionExplanation;
}

export interface EffectiveAccessPermissionExplanation {
  readonly ownershipContext: Readonly<{
    readonly isResourceOwner: boolean;
    readonly contributedToDecision: boolean;
  }>;
  readonly roleBasedGrants: Readonly<{
    readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
    readonly contributedToDecision: boolean;
  }>;
  readonly directPermissionGrants: Readonly<{
    readonly matchedPermissionGrantIds: ReadonlyArray<string>;
    readonly contributedToDecision: boolean;
  }>;
  readonly sharingBasedGrants: Readonly<{
    readonly matchedSharingGrantIds: ReadonlyArray<string>;
    readonly contributedToDecision: boolean;
  }>;
  readonly visibilityContribution: Readonly<{
    readonly resourceVisibility: AuthorizationResourcePolicyMetadata["visibility"];
    readonly sharingPolicyMode: AuthorizationResourcePolicyMetadata["sharingPolicyMode"];
    readonly contributedToDecision: boolean;
    readonly contributionReasonCode?: string;
  }>;
}

export interface ListAuthorizationEffectiveAccessUseCaseResult {
  readonly resourcePolicyMetadata: AuthorizationResourcePolicyMetadata;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrantIds: ReadonlyArray<string>;
  readonly sharingGrantIds: ReadonlyArray<string>;
  readonly permissions: ReadonlyArray<EffectiveAccessPermissionDecision>;
}

interface ListAuthorizationEffectiveAccessUseCaseDependencies {
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly roleGrantReadRepository: IAuthorizationRoleGrantReadRepository;
  readonly sharingGrantReadRepository: IAuthorizationSharingGrantReadRepository;
  readonly resourcePolicyMetadataReadRepository: IAuthorizationResourcePolicyMetadataReadRepository;
}

export class ListAuthorizationEffectiveAccessUseCase {
  public constructor(private readonly dependencies: ListAuthorizationEffectiveAccessUseCaseDependencies) {}

  public async execute(
    input: ListAuthorizationEffectiveAccessUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<ListAuthorizationEffectiveAccessUseCaseResult>> {
    let parsed: ReturnType<typeof parseAuthorizationPolicyEvaluationRequestDto>;
    try {
      parsed = parseAuthorizationPolicyEvaluationRequestDto({
        actor: input.actor,
        resource: input.resource,
        requiredPermissionKey: "asset.read",
        asOf: input.asOf,
      });
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Effective access request is invalid.");
    }

    const resourcePolicyMetadata = await this.dependencies.resourcePolicyMetadataReadRepository.findResourcePolicyMetadata({
      resource: parsed.resource,
      asOf: parsed.asOf,
    });
    if (!resourcePolicyMetadata) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.notFound,
        "Resource policy metadata was not found for effective-access query.",
      );
    }

    const roleSnapshot = await this.dependencies.roleGrantReadRepository.getActorRoleGrantSnapshot({
      actor: parsed.actor,
      resource: parsed.resource,
      asOf: parsed.asOf,
    });

    const sharingGrants = await this.dependencies.sharingGrantReadRepository.listSharingGrants({
      resource: parsed.resource,
      asOf: parsed.asOf,
    });

    const familyPermissions = AuthorizationPermissionCatalog.matrix[parsed.resource.resourceFamily]
      .map((action) => AuthorizationPermissionCatalog.resources[parsed.resource.resourceFamily][action]);

    const decisions: EffectiveAccessPermissionDecision[] = [];
    for (const permissionKey of familyPermissions) {
      const decision = await this.dependencies.decisionEvaluator.evaluateDecision({
        actor: parsed.actor,
        requiredPermissionKey: permissionKey,
        target: {
          kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
          resource: parsed.resource,
        },
        asOf: parsed.asOf,
      });

      if (!input.includeDenied && !decision.decision.isAllowed) {
        continue;
      }

      decisions.push(Object.freeze({
        permissionKey,
        decision: decision.decision,
        explanation: buildPermissionExplanation({
          actorUserIdentityId: parsed.actor.actorUserIdentityId,
          metadata: resourcePolicyMetadata,
          decision: decision.decision,
        }),
      }));
    }

    return {
      ok: true,
      value: Object.freeze({
        resourcePolicyMetadata,
        roleAssignments: roleSnapshot.roleAssignments,
        permissionGrantIds: Object.freeze(roleSnapshot.permissionGrants.map((grant) => grant.id)),
        sharingGrantIds: Object.freeze(sharingGrants.map((grant) => grant.id)),
        permissions: Object.freeze(decisions),
      }),
    };
  }
}

function buildPermissionExplanation(input: {
  readonly actorUserIdentityId?: string;
  readonly metadata: AuthorizationResourcePolicyMetadata;
  readonly decision: AuthorizationPolicyDecision;
}): EffectiveAccessPermissionExplanation {
  const normalizedActorUserIdentityId = input.actorUserIdentityId?.trim();
  const isResourceOwner = !!normalizedActorUserIdentityId && normalizedActorUserIdentityId === input.metadata.ownerUserIdentityId;
  const ownershipContributed = input.decision.reasonCode === AuthorizationDecisionReasonCodes.ownerOverride;
  const roleContributed = input.decision.matchedRoleAssignmentIds.length > 0
    || input.decision.reasonCode === AuthorizationDecisionReasonCodes.matchedRoleGrant;
  const permissionGrantContributed = input.decision.matchedPermissionGrantIds.length > 0 || (
    input.decision.reasonCode === AuthorizationDecisionReasonCodes.matchedPermissionGrant
    || input.decision.reasonCode === AuthorizationDecisionReasonCodes.explicitDenyPermissionGrant
  );
  const sharingContributed = input.decision.matchedSharingGrantIds.length > 0
    || input.decision.reasonCode === AuthorizationDecisionReasonCodes.matchedSharingGrant;
  const visibilityContributed = (
    input.decision.reasonCode === AuthorizationDecisionReasonCodes.visibilityWorkspaceMember
    || input.decision.reasonCode === AuthorizationDecisionReasonCodes.visibilityPublished
  );

  return Object.freeze({
    ownershipContext: Object.freeze({
      isResourceOwner,
      contributedToDecision: ownershipContributed,
    }),
    roleBasedGrants: Object.freeze({
      matchedRoleAssignmentIds: input.decision.matchedRoleAssignmentIds,
      contributedToDecision: roleContributed,
    }),
    directPermissionGrants: Object.freeze({
      matchedPermissionGrantIds: input.decision.matchedPermissionGrantIds,
      contributedToDecision: permissionGrantContributed,
    }),
    sharingBasedGrants: Object.freeze({
      matchedSharingGrantIds: input.decision.matchedSharingGrantIds,
      contributedToDecision: sharingContributed,
    }),
    visibilityContribution: Object.freeze({
      resourceVisibility: input.metadata.visibility,
      sharingPolicyMode: input.metadata.sharingPolicyMode,
      contributedToDecision: visibilityContributed,
      contributionReasonCode: visibilityContributed ? input.decision.reasonCode : undefined,
    }),
  });
}

