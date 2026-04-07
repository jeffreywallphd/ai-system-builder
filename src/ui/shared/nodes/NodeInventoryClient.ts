import type {
  GetNodeInventoryDetailApiResponse,
  ListNodeInventoryApiResponse,
  NodeTrustApiResponse,
  RevokeNodeTrustApiResponse,
} from "@infrastructure/api/nodes/sdk/PublicNodeTrustApiContract";
import type {
  NodeInventoryOperationalState,
  NodeInventoryPresenceState,
  RevokeNodeTrustActionRequestDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";
import type {
  NodeApprovalStatus,
  NodeEnrollmentRequestStatus,
  NodeRoleCapability,
  NodeType,
} from "@domain/nodes/NodeTrustDomain";
import {
  appendSharedApiListQueryConventions,
  appendSharedApiQueryList,
  appendSharedApiQueryValue,
  toSharedApiQuerySuffix,
} from "@shared/contracts/api/SharedApiQueryConventions";

export interface NodeInventoryClient {
  listNodeInventory(
    request: {
      readonly nodeTypes?: ReadonlyArray<NodeType>;
      readonly approvalStatuses?: ReadonlyArray<NodeApprovalStatus>;
      readonly operationalStates?: ReadonlyArray<NodeInventoryOperationalState>;
      readonly enrollmentStatuses?: ReadonlyArray<NodeEnrollmentRequestStatus>;
      readonly presenceStates?: ReadonlyArray<NodeInventoryPresenceState>;
      readonly capabilityAnyOf?: ReadonlyArray<NodeRoleCapability>;
      readonly deploymentTagAnyOf?: ReadonlyArray<string>;
      readonly lastSeenAfter?: string;
      readonly lastSeenBefore?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<ListNodeInventoryApiResponse>>;
  getNodeInventoryDetail(
    request: {
      readonly nodeId: string;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<GetNodeInventoryDetailApiResponse>>;
  revokeNodeTrust(
    request: Pick<RevokeNodeTrustActionRequestDto, "nodeId" | "reason" | "revokedAt" | "note">,
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<RevokeNodeTrustApiResponse>>;
}

export class HttpNodeInventoryClient implements NodeInventoryClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async listNodeInventory(
    request: {
      readonly nodeTypes?: ReadonlyArray<NodeType>;
      readonly approvalStatuses?: ReadonlyArray<NodeApprovalStatus>;
      readonly operationalStates?: ReadonlyArray<NodeInventoryOperationalState>;
      readonly enrollmentStatuses?: ReadonlyArray<NodeEnrollmentRequestStatus>;
      readonly presenceStates?: ReadonlyArray<NodeInventoryPresenceState>;
      readonly capabilityAnyOf?: ReadonlyArray<NodeRoleCapability>;
      readonly deploymentTagAnyOf?: ReadonlyArray<string>;
      readonly lastSeenAfter?: string;
      readonly lastSeenBefore?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<ListNodeInventoryApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryList(query, "nodeType", request.nodeTypes);
    appendSharedApiQueryList(query, "approvalStatus", request.approvalStatuses);
    appendSharedApiQueryList(query, "operationalState", request.operationalStates);
    appendSharedApiQueryList(query, "enrollmentStatus", request.enrollmentStatuses);
    appendSharedApiQueryList(query, "presenceState", request.presenceStates);
    appendSharedApiQueryList(query, "capability", request.capabilityAnyOf);
    appendSharedApiQueryList(query, "deploymentTag", request.deploymentTagAnyOf);
    appendSharedApiQueryValue(query, "lastSeenAfter", request.lastSeenAfter);
    appendSharedApiQueryValue(query, "lastSeenBefore", request.lastSeenBefore);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    return this.get(`/api/v1/nodes/inventory${toSharedApiQuerySuffix(query)}`, sessionToken);
  }

  public async getNodeInventoryDetail(
    request: {
      readonly nodeId: string;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<GetNodeInventoryDetailApiResponse>> {
    return this.get(`/api/v1/nodes/inventory/${encodeURIComponent(request.nodeId)}`, sessionToken);
  }

  public async revokeNodeTrust(
    request: Pick<RevokeNodeTrustActionRequestDto, "nodeId" | "reason" | "revokedAt" | "note">,
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<RevokeNodeTrustApiResponse>> {
    return this.post(
      `/api/v1/nodes/${encodeURIComponent(request.nodeId)}/revoke`,
      Object.freeze({
        reason: request.reason,
        revokedAt: request.revokedAt,
        note: request.note,
      }),
      sessionToken,
    );
  }

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("GET", path, sessionToken);
  }

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken: string,
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", path, sessionToken, body);
  }

  private async request<TResponse>(
    method: "GET" | "POST",
    path: string,
    sessionToken: string,
    body?: Readonly<Record<string, unknown>>,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.json() as TResponse;
  }
}


