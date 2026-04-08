import type { SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  DeploymentPolicyReadTransportRoutes,
  type ReadDeploymentPolicyStateResponse,
} from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { parseReadDeploymentPolicyStateResponse } from "@shared/schemas/deployment/DeploymentPolicyReadSchemaContracts";
import {
  buildDeploymentPolicyAdministrationInspectionReadModel,
  type DeploymentPolicyAdministrationInspectionReadModel,
} from "@ui/shared/admin/DeploymentPolicyAdministrationReadModel";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export interface DeploymentPolicyAdministrationReadRequest {
  readonly workspaceId: string;
  readonly profileId?: "home" | "classroom" | "organization";
}

export interface DeploymentPolicyAdministrationReadServiceResult {
  readonly policyState: ReadDeploymentPolicyStateResponse;
  readonly inspection: DeploymentPolicyAdministrationInspectionReadModel;
}

export interface DeploymentPolicyAdministrationReadClient {
  readDeploymentPolicyState(
    request: DeploymentPolicyAdministrationReadRequest,
    sessionToken: string,
  ): Promise<SharedApiResponseEnvelope<ReadDeploymentPolicyStateResponse>>;
}

export interface DeploymentPolicyAdministrationReadServiceDependencies {
  readonly client: DeploymentPolicyAdministrationReadClient;
}

export class DeploymentPolicyAdministrationReadService {
  private readonly dependencies: DeploymentPolicyAdministrationReadServiceDependencies;

  public constructor(
    dependencies?: Partial<DeploymentPolicyAdministrationReadServiceDependencies>,
  ) {
    this.dependencies = Object.freeze({
      client: dependencies?.client ?? createDefaultDeploymentPolicyAdministrationReadClient(),
    });
  }

  public async readPolicyAdministrationState(input: {
    readonly actorUserIdentityId: string;
    readonly sessionToken: string;
    readonly request: DeploymentPolicyAdministrationReadRequest;
  }): Promise<
    | { readonly ok: true; readonly data: DeploymentPolicyAdministrationReadServiceResult }
    | { readonly ok: false; readonly error: { readonly message: string } }
  > {
    const actorUserIdentityId = input.actorUserIdentityId.trim();
    const sessionToken = input.sessionToken.trim();
    const workspaceId = input.request.workspaceId.trim();

    if (!actorUserIdentityId || !sessionToken || !workspaceId) {
      return this.failed("Unable to load deployment policy administration state.");
    }

    try {
      const apiResponse = await this.dependencies.client.readDeploymentPolicyState(Object.freeze({
        workspaceId,
        profileId: input.request.profileId,
      }), sessionToken);

      if (!apiResponse.ok || !apiResponse.data) {
        return this.failed(apiResponse.error?.message?.trim() || "Unable to load deployment policy administration state.");
      }

      const parsed = parseReadDeploymentPolicyStateResponse(apiResponse.data);
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          policyState: parsed,
          inspection: buildDeploymentPolicyAdministrationInspectionReadModel(parsed),
        }),
      });
    } catch {
      return this.failed("Unable to load deployment policy administration state.");
    }
  }

  private failed(message: string): { readonly ok: false; readonly error: { readonly message: string } } {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ message }),
    });
  }
}

function createDefaultDeploymentPolicyAdministrationReadClient(): DeploymentPolicyAdministrationReadClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpDeploymentPolicyAdministrationReadClient(baseUrl);
}

class HttpDeploymentPolicyAdministrationReadClient implements DeploymentPolicyAdministrationReadClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async readDeploymentPolicyState(
    request: DeploymentPolicyAdministrationReadRequest,
    sessionToken: string,
  ): Promise<SharedApiResponseEnvelope<ReadDeploymentPolicyStateResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);
    query.set("includeCatalog", "true");
    query.set("includeOverrideRecords", "true");
    query.set("includeEffectiveMetadata", "true");
    if (request.profileId) {
      query.set("profileId", request.profileId);
    }

    const response = await fetch(`${this.baseUrl}${DeploymentPolicyReadTransportRoutes.readState}?${query.toString()}`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
    });

    return await response.json() as SharedApiResponseEnvelope<ReadDeploymentPolicyStateResponse>;
  }
}
