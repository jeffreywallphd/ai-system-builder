import type {
  GetStorageInstanceDetailApiResponse,
  GetStorageInstanceHealthApiResponse,
  ListStorageInstancesApiResponse,
  StorageManagementApiResponse,
} from "../../../infrastructure/api/storage/sdk/PublicStorageManagementApiContract";
import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageBackendType,
  StorageLifecycleState,
} from "../../../src/domain/storage/StorageDomain";

export interface StorageAdministrationClient {
  listStorageInstances(
    request: {
      readonly workspaceId: string;
      readonly backendTypes?: ReadonlyArray<StorageBackendType>;
      readonly lifecycleStates?: ReadonlyArray<StorageLifecycleState>;
      readonly accessModes?: ReadonlyArray<StorageAccessMode>;
      readonly accessScopes?: ReadonlyArray<StorageAccessScope>;
      readonly limit?: number;
      readonly offset?: number;
      readonly occurredAt?: string;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<ListStorageInstancesApiResponse>>;
  getStorageInstanceDetail(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly occurredAt?: string;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<GetStorageInstanceDetailApiResponse>>;
  getStorageInstanceHealth(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly occurredAt?: string;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<GetStorageInstanceHealthApiResponse>>;
}

export class HttpStorageAdministrationClient implements StorageAdministrationClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async listStorageInstances(
    request: {
      readonly workspaceId: string;
      readonly backendTypes?: ReadonlyArray<StorageBackendType>;
      readonly lifecycleStates?: ReadonlyArray<StorageLifecycleState>;
      readonly accessModes?: ReadonlyArray<StorageAccessMode>;
      readonly accessScopes?: ReadonlyArray<StorageAccessScope>;
      readonly limit?: number;
      readonly offset?: number;
      readonly occurredAt?: string;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<ListStorageInstancesApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    appendList(query, "backendType", request.backendTypes);
    appendList(query, "lifecycleState", request.lifecycleStates);
    appendList(query, "accessMode", request.accessModes);
    appendList(query, "accessScope", request.accessScopes);
    appendOptional(query, "occurredAt", request.occurredAt);
    appendOptionalBoolean(query, "includeCapabilities", request.includeCapabilities);
    appendPagination(query, request.limit, request.offset);
    return this.get(`/api/v1/storage/instances${toQuerySuffix(query)}`, sessionToken);
  }

  public async getStorageInstanceDetail(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly occurredAt?: string;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<GetStorageInstanceDetailApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    appendOptional(query, "occurredAt", request.occurredAt);
    appendOptionalBoolean(query, "includeCapabilities", request.includeCapabilities);
    return this.get(
      `/api/v1/storage/instances/${encodeURIComponent(request.storageInstanceId)}${toQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async getStorageInstanceHealth(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly occurredAt?: string;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<GetStorageInstanceHealthApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    appendOptional(query, "occurredAt", request.occurredAt);
    return this.get(
      `/api/v1/storage/instances/${encodeURIComponent(request.storageInstanceId)}/health${toQuerySuffix(query)}`,
      sessionToken,
    );
  }

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("GET", path, sessionToken);
  }

  private async request<TResponse>(
    method: "GET",
    path: string,
    sessionToken: string,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
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

function appendOptionalBoolean(query: URLSearchParams, key: string, value?: boolean): void {
  if (typeof value === "boolean") {
    query.set(key, value ? "true" : "false");
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
