import type {
  GetNodeInventoryDetailApiResponse,
  ListNodeInventoryApiResponse,
  NodeTrustApiResponse,
} from "../../../infrastructure/api/nodes/sdk/PublicNodeTrustApiContract";
import type {
  NodeInventoryOperationalState,
  NodeInventoryPresenceState,
} from "../../../src/shared/contracts/nodes/NodeTrustApiContracts";
import type {
  NodeApprovalStatus,
  NodeEnrollmentRequestStatus,
  NodeRoleCapability,
  NodeType,
} from "../../../src/domain/nodes/NodeTrustDomain";

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
    appendList(query, "nodeType", request.nodeTypes);
    appendList(query, "approvalStatus", request.approvalStatuses);
    appendList(query, "operationalState", request.operationalStates);
    appendList(query, "enrollmentStatus", request.enrollmentStatuses);
    appendList(query, "presenceState", request.presenceStates);
    appendList(query, "capability", request.capabilityAnyOf);
    appendList(query, "deploymentTag", request.deploymentTagAnyOf);
    appendOptional(query, "lastSeenAfter", request.lastSeenAfter);
    appendOptional(query, "lastSeenBefore", request.lastSeenBefore);
    appendPagination(query, request.limit, request.offset);
    return this.get(`/api/v1/nodes/inventory${toQuerySuffix(query)}`, sessionToken);
  }

  public async getNodeInventoryDetail(
    request: {
      readonly nodeId: string;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<GetNodeInventoryDetailApiResponse>> {
    return this.get(`/api/v1/nodes/inventory/${encodeURIComponent(request.nodeId)}`, sessionToken);
  }

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
    });
    return await response.json() as TResponse;
  }
}

function appendList(query: URLSearchParams, key: string, values?: ReadonlyArray<string>): void {
  for (const value of values ?? []) {
    query.append(key, value);
  }
}

function appendOptional(query: URLSearchParams, key: string, value?: string): void {
  if (value) {
    query.set(key, value);
  }
}

function appendPagination(query: URLSearchParams, limit?: number, offset?: number): void {
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  if (typeof offset === "number") {
    query.set("offset", String(offset));
  }
}

function toQuerySuffix(query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}
