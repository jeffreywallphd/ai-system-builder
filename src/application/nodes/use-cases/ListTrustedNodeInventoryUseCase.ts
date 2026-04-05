import type {
  NodeIdentityPersistenceLookupQuery,
  NodeIdentityPersistenceRecord,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import { NodeTrustPersistenceQueryPresets } from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { NodeRoleCapability, NodeType } from "../../../domain/nodes/NodeTrustDomain";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import {
  NodeTrustAuditEventTypes,
  publishNodeTrustAuditEventBestEffort,
  type NodeTrustAuditSink,
} from "../ports/NodeTrustAuditPorts";
import {
  NodeTrustUseCaseErrorCodes,
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseOutcome,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface ListTrustedNodeInventoryUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  readonly capabilityAnyOf?: ReadonlyArray<NodeRoleCapability>;
  readonly deploymentTagAnyOf?: ReadonlyArray<string>;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListTrustedNodeInventoryUseCaseResponse {
  readonly nodes: ReadonlyArray<NodeIdentityPersistenceRecord>;
}

interface ListTrustedNodeInventoryUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class ListTrustedNodeInventoryUseCase {
  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: ListTrustedNodeInventoryUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ListTrustedNodeInventoryUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<ListTrustedNodeInventoryUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const query: NodeIdentityPersistenceLookupQuery = Object.freeze({
      nodeTypes: request.nodeTypes,
      capabilityAnyOf: request.capabilityAnyOf,
      deploymentTagAnyOf: request.deploymentTagAnyOf,
      trustStates: NodeTrustPersistenceQueryPresets.activeNodeTrustStates,
      includeRevoked: false,
      activeOnly: true,
      lastSeenAfter: request.lastSeenAfter,
      lastSeenBefore: request.lastSeenBefore,
      limit: request.limit,
      offset: request.offset,
    });

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanQueryTrustedNodeInventory({
          actorUserIdentityId,
          query,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to query trusted node inventory.",
      );
    }

    const nodes = await this.dependencies.nodeRepository.listNodes(query);

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.trustedInventoryQueried,
      actorUserIdentityId,
      occurredAt: this.clock.now().toISOString(),
      details: Object.freeze({
        returned: nodes.length,
        capabilityAnyOf: request.capabilityAnyOf,
        deploymentTagAnyOf: request.deploymentTagAnyOf,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        nodes,
      }),
    };
  }
}
