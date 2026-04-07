import type {
  ApproveNodeEnrollmentApiResponse,
  GetNodeEnrollmentDetailApiResponse,
  ListPendingNodeEnrollmentsApiResponse,
  NodeTrustApiResponse,
  RejectNodeEnrollmentApiResponse,
} from "@infrastructure/api/nodes/sdk/PublicNodeTrustApiContract";
import { NodeEnrollmentRequestStatuses } from "@domain/nodes/NodeTrustDomain";
import type {
  ApproveNodeEnrollmentActionRequestDto,
  RejectNodeEnrollmentActionRequestDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";

export interface NodeEnrollmentReviewClient {
  listPendingNodeEnrollments(
    request: {
      readonly nodeId?: string;
      readonly statuses?: ReadonlyArray<
        typeof NodeEnrollmentRequestStatuses.submitted
        | typeof NodeEnrollmentRequestStatuses.underReview
      >;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<ListPendingNodeEnrollmentsApiResponse>>;
  getNodeEnrollmentDetail(
    request: {
      readonly requestId: string;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<GetNodeEnrollmentDetailApiResponse>>;
  approveNodeEnrollment(
    request: Pick<ApproveNodeEnrollmentActionRequestDto, "requestId" | "reviewedAt" | "decisionNote" | "certificate">,
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<ApproveNodeEnrollmentApiResponse>>;
  rejectNodeEnrollment(
    request: Pick<RejectNodeEnrollmentActionRequestDto, "requestId" | "reviewedAt" | "decisionNote">,
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<RejectNodeEnrollmentApiResponse>>;
}

export class HttpNodeEnrollmentReviewClient implements NodeEnrollmentReviewClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async listPendingNodeEnrollments(
    request: {
      readonly nodeId?: string;
      readonly statuses?: ReadonlyArray<
        typeof NodeEnrollmentRequestStatuses.submitted
        | typeof NodeEnrollmentRequestStatuses.underReview
      >;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<ListPendingNodeEnrollmentsApiResponse>> {
    const query = new URLSearchParams();
    if (request.nodeId) {
      query.set("nodeId", request.nodeId);
    }
    if (request.statuses) {
      for (const status of request.statuses) {
        query.append("status", status);
      }
    }
    appendPagination(query, request.limit, request.offset);
    return this.get(`/api/v1/nodes/enrollments/pending${toQuerySuffix(query)}`, sessionToken);
  }

  public async getNodeEnrollmentDetail(
    request: {
      readonly requestId: string;
    },
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<GetNodeEnrollmentDetailApiResponse>> {
    return this.get(`/api/v1/nodes/enrollments/${encodeURIComponent(request.requestId)}`, sessionToken);
  }

  public async approveNodeEnrollment(
    request: Pick<ApproveNodeEnrollmentActionRequestDto, "requestId" | "reviewedAt" | "decisionNote" | "certificate">,
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<ApproveNodeEnrollmentApiResponse>> {
    return this.post(
      `/api/v1/nodes/enrollments/${encodeURIComponent(request.requestId)}/approve`,
      Object.freeze({
        reviewedAt: request.reviewedAt,
        decisionNote: request.decisionNote,
        certificate: request.certificate,
      }),
      sessionToken,
    );
  }

  public async rejectNodeEnrollment(
    request: Pick<RejectNodeEnrollmentActionRequestDto, "requestId" | "reviewedAt" | "decisionNote">,
    sessionToken: string,
  ): Promise<NodeTrustApiResponse<RejectNodeEnrollmentApiResponse>> {
    return this.post(
      `/api/v1/nodes/enrollments/${encodeURIComponent(request.requestId)}/reject`,
      Object.freeze({
        reviewedAt: request.reviewedAt,
        decisionNote: request.decisionNote,
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

