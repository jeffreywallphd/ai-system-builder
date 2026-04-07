import type {
  ActivateStorageInstanceApiResponse,
  CreateStorageInstanceApiResponse,
  DeactivateStorageInstanceApiResponse,
  GetStorageInstanceDetailApiResponse,
  GetStorageInstanceHealthApiResponse,
  ListStorageInstancesApiResponse,
  StorageManagementApiResponse,
  UpdateStorageInstanceMetadataApiResponse,
} from "@infrastructure/api/storage/sdk/PublicStorageManagementApiContract";
import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageBackendType,
  StorageEncryptionKeyScope,
  StorageEncryptionMode,
  StorageLifecycleState,
  StorageReplicationMode,
  StorageRetentionExpiryAction,
} from "@domain/storage/StorageDomain";

export interface StorageAdministrationClient {
  createStorageInstance(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly backendType: StorageBackendType;
      readonly display: {
        readonly displayName: string;
      };
      readonly ownerUserIdentityId: string;
      readonly access: {
        readonly mode: StorageAccessMode;
        readonly scope: StorageAccessScope;
      };
      readonly replication?: {
        readonly mode: StorageReplicationMode;
        readonly replicaStorageInstanceId?: string;
        readonly syncIntervalSeconds?: number;
      };
      readonly policy: {
        readonly policyId: string;
        readonly maxObjectBytes?: number;
        readonly retentionDays?: number;
        readonly immutableWrites?: boolean;
        readonly allowCrossWorkspaceReads?: boolean;
        readonly labels?: Readonly<Record<string, string>>;
        readonly encryptionMode?: StorageEncryptionMode;
        readonly contentEncryptionRequired?: boolean;
        readonly keyScope?: StorageEncryptionKeyScope;
        readonly allowPreviewDecryption?: boolean;
        readonly allowWorkerDecryption?: boolean;
        readonly retentionExpiryAction?: StorageRetentionExpiryAction;
        readonly purgeGracePeriodDays?: number;
        readonly encryptionProfileId: string;
        readonly encryptionKeyReferenceId?: string;
        readonly envelopeRequired: boolean;
      };
      readonly createdAt?: string;
      readonly lifecycleState?: StorageLifecycleState;
      readonly requestBackendProvisioning?: boolean;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<CreateStorageInstanceApiResponse>>;
  updateStorageMetadata(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly display?: {
        readonly displayName?: string;
      };
      readonly policy?: {
        readonly labels?: Readonly<Record<string, string>>;
      };
      readonly occurredAt?: string;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<UpdateStorageInstanceMetadataApiResponse>>;
  activateStorageInstance(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly operationKey?: string;
      readonly correlationId?: string;
      readonly activatedAt?: string;
      readonly requestBackendActivation?: boolean;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<ActivateStorageInstanceApiResponse>>;
  deactivateStorageInstance(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly operationKey?: string;
      readonly correlationId?: string;
      readonly targetLifecycleState?: "suspended" | "archived";
      readonly deactivatedAt?: string;
      readonly requestBackendDeactivation?: boolean;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<DeactivateStorageInstanceApiResponse>>;
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

  public async createStorageInstance(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly backendType: StorageBackendType;
      readonly display: {
        readonly displayName: string;
      };
      readonly ownerUserIdentityId: string;
      readonly access: {
        readonly mode: StorageAccessMode;
        readonly scope: StorageAccessScope;
      };
      readonly replication?: {
        readonly mode: StorageReplicationMode;
        readonly replicaStorageInstanceId?: string;
        readonly syncIntervalSeconds?: number;
      };
      readonly policy: {
        readonly policyId: string;
        readonly maxObjectBytes?: number;
        readonly retentionDays?: number;
        readonly immutableWrites?: boolean;
        readonly allowCrossWorkspaceReads?: boolean;
        readonly labels?: Readonly<Record<string, string>>;
        readonly encryptionMode?: StorageEncryptionMode;
        readonly contentEncryptionRequired?: boolean;
        readonly keyScope?: StorageEncryptionKeyScope;
        readonly allowPreviewDecryption?: boolean;
        readonly allowWorkerDecryption?: boolean;
        readonly retentionExpiryAction?: StorageRetentionExpiryAction;
        readonly purgeGracePeriodDays?: number;
        readonly encryptionProfileId: string;
        readonly encryptionKeyReferenceId?: string;
        readonly envelopeRequired: boolean;
      };
      readonly createdAt?: string;
      readonly lifecycleState?: StorageLifecycleState;
      readonly requestBackendProvisioning?: boolean;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<CreateStorageInstanceApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    return this.post(
      `/api/v1/storage/instances${toQuerySuffix(query)}`,
      {
        storageInstanceId: request.storageInstanceId,
        backendType: request.backendType,
        display: request.display,
        ownerUserIdentityId: request.ownerUserIdentityId,
        access: request.access,
        replication: request.replication,
        policy: request.policy,
        createdAt: request.createdAt,
        lifecycleState: request.lifecycleState,
      },
      sessionToken,
    );
  }

  public async updateStorageMetadata(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly display?: {
        readonly displayName?: string;
      };
      readonly policy?: {
        readonly labels?: Readonly<Record<string, string>>;
      };
      readonly occurredAt?: string;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<UpdateStorageInstanceMetadataApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    return this.patch(
      `/api/v1/storage/instances/${encodeURIComponent(request.storageInstanceId)}/metadata${toQuerySuffix(query)}`,
      {
        display: request.display,
        policy: request.policy,
        occurredAt: request.occurredAt,
      },
      sessionToken,
    );
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

  public async activateStorageInstance(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly operationKey?: string;
      readonly correlationId?: string;
      readonly activatedAt?: string;
      readonly requestBackendActivation?: boolean;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<ActivateStorageInstanceApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    return this.post(
      `/api/v1/storage/instances/${encodeURIComponent(request.storageInstanceId)}/activate${toQuerySuffix(query)}`,
      {
        operationKey: request.operationKey,
        correlationId: request.correlationId,
        activatedAt: request.activatedAt,
        requestBackendActivation: request.requestBackendActivation,
        includeCapabilities: request.includeCapabilities,
      },
      sessionToken,
    );
  }

  public async deactivateStorageInstance(
    request: {
      readonly workspaceId: string;
      readonly storageInstanceId: string;
      readonly operationKey?: string;
      readonly correlationId?: string;
      readonly targetLifecycleState?: "suspended" | "archived";
      readonly deactivatedAt?: string;
      readonly requestBackendDeactivation?: boolean;
      readonly includeCapabilities?: boolean;
    },
    sessionToken: string,
  ): Promise<StorageManagementApiResponse<DeactivateStorageInstanceApiResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    return this.post(
      `/api/v1/storage/instances/${encodeURIComponent(request.storageInstanceId)}/deactivate${toQuerySuffix(query)}`,
      {
        operationKey: request.operationKey,
        correlationId: request.correlationId,
        targetLifecycleState: request.targetLifecycleState,
        deactivatedAt: request.deactivatedAt,
        requestBackendDeactivation: request.requestBackendDeactivation,
        includeCapabilities: request.includeCapabilities,
      },
      sessionToken,
    );
  }

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("GET", path, sessionToken);
  }

  private async post<TResponse>(path: string, body: unknown, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("POST", path, sessionToken, body);
  }

  private async patch<TResponse>(path: string, body: unknown, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("PATCH", path, sessionToken, body);
  }

  private async request<TResponse>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    sessionToken: string,
    body?: unknown,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
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

