import type {
  CreateSecretMetadataApiResponse,
  DisableSecretMetadataApiResponse,
  GetSecretMetadataApiResponse,
  ListSecretMetadataApiResponse,
  RotateSecretMetadataApiResponse,
  SecretMetadataApiResponse,
} from "@infrastructure/api/security/sdk/PublicSecretMetadataApiContract";
import type { SecretKind, SecretScope } from "@domain/security/SecretDomain";
import type { SecretClassificationId } from "@shared/contracts/security/SecretClassificationContracts";
import type { SecretRotationInstructionContract } from "@shared/contracts/security/SecretTransportContracts";

export interface SecretMetadataOwnerDraft {
  readonly scope: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface SecretMetadataManagementClient {
  createSecret(
    request: {
      readonly operationKey?: string;
      readonly secretId: string;
      readonly name: string;
      readonly owner: SecretMetadataOwnerDraft;
      readonly kind: SecretKind;
      readonly plaintext: string;
      readonly metadata?: Readonly<{
        readonly displayName?: string;
        readonly description?: string;
        readonly tags?: ReadonlyArray<string>;
        readonly labels?: Readonly<Record<string, string>>;
      }>;
      readonly classificationId?: SecretClassificationId;
      readonly rotationInstruction?: SecretRotationInstructionContract;
      readonly createdAt?: string;
    },
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<CreateSecretMetadataApiResponse>>;
  listSecrets(
    request: {
      readonly actorWorkspaceId?: string;
      readonly owner: SecretMetadataOwnerDraft;
      readonly kinds?: ReadonlyArray<SecretKind>;
      readonly tagAnyOf?: ReadonlyArray<string>;
      readonly includeDisabled?: boolean;
      readonly includeArchived?: boolean;
      readonly includeSoftDeleted?: boolean;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<ListSecretMetadataApiResponse>>;
  getSecret(
    request: {
      readonly actorWorkspaceId?: string;
      readonly secretId: string;
      readonly occurredAt?: string;
    },
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<GetSecretMetadataApiResponse>>;
  rotateSecret(
    request: {
      readonly actorWorkspaceId?: string;
      readonly operationKey?: string;
      readonly secretId: string;
      readonly plaintext: string;
      readonly expectedCurrentVersionId?: string;
      readonly rotatedAt?: string;
    },
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<RotateSecretMetadataApiResponse>>;
  disableSecret(
    request: {
      readonly actorWorkspaceId?: string;
      readonly operationKey?: string;
      readonly secretId: string;
      readonly disabledAt?: string;
    },
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<DisableSecretMetadataApiResponse>>;
}

export class HttpSecretMetadataManagementClient implements SecretMetadataManagementClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async createSecret(
    request: Parameters<SecretMetadataManagementClient["createSecret"]>[0],
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<CreateSecretMetadataApiResponse>> {
    return this.post(
      "/api/v1/security/secrets",
      Object.freeze({
        operationKey: request.operationKey,
        secretId: request.secretId,
        name: request.name,
        owner: request.owner,
        kind: request.kind,
        plaintext: request.plaintext,
        metadata: request.metadata,
        classificationId: request.classificationId,
        rotationInstruction: request.rotationInstruction,
        createdAt: request.createdAt,
      }),
      sessionToken,
    );
  }

  public async listSecrets(
    request: Parameters<SecretMetadataManagementClient["listSecrets"]>[0],
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<ListSecretMetadataApiResponse>> {
    const query = new URLSearchParams();
    query.set("scope", request.owner.scope);
    if (request.owner.workspaceId) {
      query.set("workspaceId", request.owner.workspaceId);
    }
    if (request.owner.userIdentityId) {
      query.set("userIdentityId", request.owner.userIdentityId);
    }
    if (request.actorWorkspaceId) {
      query.set("actorWorkspaceId", request.actorWorkspaceId);
    }
    if (request.kinds) {
      for (const kind of request.kinds) {
        query.append("kind", kind);
      }
    }
    if (request.tagAnyOf) {
      for (const tag of request.tagAnyOf) {
        query.append("tag", tag);
      }
    }
    appendBoolean(query, "includeDisabled", request.includeDisabled);
    appendBoolean(query, "includeArchived", request.includeArchived);
    appendBoolean(query, "includeSoftDeleted", request.includeSoftDeleted);
    appendNumber(query, "limit", request.limit);
    appendNumber(query, "offset", request.offset);
    const url = `/api/v1/security/secrets${toQuerySuffix(query)}`;
    return this.get(url, sessionToken);
  }

  public async getSecret(
    request: Parameters<SecretMetadataManagementClient["getSecret"]>[0],
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<GetSecretMetadataApiResponse>> {
    const query = new URLSearchParams();
    if (request.actorWorkspaceId) {
      query.set("actorWorkspaceId", request.actorWorkspaceId);
    }
    if (request.occurredAt) {
      query.set("occurredAt", request.occurredAt);
    }
    const url = `/api/v1/security/secrets/${encodeURIComponent(request.secretId)}${toQuerySuffix(query)}`;
    return this.get(url, sessionToken);
  }

  public async rotateSecret(
    request: Parameters<SecretMetadataManagementClient["rotateSecret"]>[0],
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<RotateSecretMetadataApiResponse>> {
    return this.post(
      `/api/v1/security/secrets/${encodeURIComponent(request.secretId)}/rotate`,
      Object.freeze({
        actorWorkspaceId: request.actorWorkspaceId,
        operationKey: request.operationKey,
        plaintext: request.plaintext,
        expectedCurrentVersionId: request.expectedCurrentVersionId,
        rotatedAt: request.rotatedAt,
      }),
      sessionToken,
    );
  }

  public async disableSecret(
    request: Parameters<SecretMetadataManagementClient["disableSecret"]>[0],
    sessionToken: string,
  ): Promise<SecretMetadataApiResponse<DisableSecretMetadataApiResponse>> {
    return this.post(
      `/api/v1/security/secrets/${encodeURIComponent(request.secretId)}/disable`,
      Object.freeze({
        actorWorkspaceId: request.actorWorkspaceId,
        operationKey: request.operationKey,
        disabledAt: request.disabledAt,
      }),
      sessionToken,
    );
  }

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    return await response.json() as TResponse;
  }

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken: string,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(body),
    });
    return await response.json() as TResponse;
  }
}

function appendBoolean(query: URLSearchParams, key: string, value: boolean | undefined): void {
  if (typeof value === "boolean") {
    query.set(key, value ? "true" : "false");
  }
}

function appendNumber(query: URLSearchParams, key: string, value: number | undefined): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    query.set(key, value.toString(10));
  }
}

function toQuerySuffix(query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

