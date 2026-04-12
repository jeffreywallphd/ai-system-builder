import type { SharedApiResponseEnvelope, SharedApiValidationIssue } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  DeploymentPolicyWriteTransportRoutes,
  type ApplyDeploymentPolicyOverrideOperationsRequest,
  type ApplyDeploymentPolicyOverrideOperationsResponse,
  type UpdateDeploymentPolicyActiveProfileRequest,
  type UpdateDeploymentPolicyActiveProfileResponse,
} from "@shared/contracts/deployment/DeploymentPolicyWriteContracts";
import {
  parseApplyDeploymentPolicyOverrideOperationsRequest,
  parseApplyDeploymentPolicyOverrideOperationsResponse,
  parseUpdateDeploymentPolicyActiveProfileRequest,
  parseUpdateDeploymentPolicyActiveProfileResponse,
  DeploymentPolicyWriteSchemaValidationError,
} from "@shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export interface DeploymentPolicyAdministrationWriteRequestContext {
  readonly actorUserIdentityId: string;
  readonly sessionToken: string;
  readonly workspaceId: string;
}

export interface DeploymentPolicyAdministrationWriteClient {
  updateActiveProfile(
    request: UpdateDeploymentPolicyActiveProfileRequest,
    context: DeploymentPolicyAdministrationWriteRequestContext,
  ): Promise<SharedApiResponseEnvelope<UpdateDeploymentPolicyActiveProfileResponse>>;

  applyOverrideOperations(
    request: ApplyDeploymentPolicyOverrideOperationsRequest,
    context: DeploymentPolicyAdministrationWriteRequestContext,
  ): Promise<SharedApiResponseEnvelope<ApplyDeploymentPolicyOverrideOperationsResponse>>;
}

export interface DeploymentPolicyAdministrationWriteServiceDependencies {
  readonly client: DeploymentPolicyAdministrationWriteClient;
}

export interface DeploymentPolicyAdministrationWriteValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface DeploymentPolicyAdministrationWriteServiceError {
  readonly code?: string;
  readonly message: string;
  readonly validationIssues: ReadonlyArray<DeploymentPolicyAdministrationWriteValidationIssue>;
}

export class DeploymentPolicyAdministrationWriteService {
  private readonly dependencies: DeploymentPolicyAdministrationWriteServiceDependencies;

  public constructor(
    dependencies?: Partial<DeploymentPolicyAdministrationWriteServiceDependencies>,
  ) {
    this.dependencies = Object.freeze({
      client: dependencies?.client ?? createDefaultDeploymentPolicyAdministrationWriteClient(),
    });
  }

  public async updateActiveProfile(input: {
    readonly context: DeploymentPolicyAdministrationWriteRequestContext;
    readonly request: UpdateDeploymentPolicyActiveProfileRequest;
  }): Promise<
    | { readonly ok: true; readonly data: UpdateDeploymentPolicyActiveProfileResponse }
    | { readonly ok: false; readonly error: DeploymentPolicyAdministrationWriteServiceError }
  > {
    if (!isValidWriteContext(input.context)) {
      return this.failed("invalid-request", "Unable to apply deployment policy update.");
    }

    let request: UpdateDeploymentPolicyActiveProfileRequest;
    try {
      request = parseUpdateDeploymentPolicyActiveProfileRequest(input.request);
    } catch (error) {
      return this.failedValidation(error, "Unable to apply deployment policy update.");
    }

    try {
      const apiResponse = await this.dependencies.client.updateActiveProfile(request, normalizedContext(input.context));
      if (!apiResponse.ok || !apiResponse.data) {
        return this.failedFromApi(apiResponse, "Unable to apply deployment policy update.");
      }

      const parsedResponse = parseUpdateDeploymentPolicyActiveProfileResponse(apiResponse.data);
      return Object.freeze({
        ok: true,
        data: parsedResponse,
      });
    } catch {
      return this.failed("internal", "Unable to apply deployment policy update.");
    }
  }

  public async applyOverrideOperations(input: {
    readonly context: DeploymentPolicyAdministrationWriteRequestContext;
    readonly request: ApplyDeploymentPolicyOverrideOperationsRequest;
  }): Promise<
    | { readonly ok: true; readonly data: ApplyDeploymentPolicyOverrideOperationsResponse }
    | { readonly ok: false; readonly error: DeploymentPolicyAdministrationWriteServiceError }
  > {
    if (!isValidWriteContext(input.context)) {
      return this.failed("invalid-request", "Unable to apply deployment policy override update.");
    }

    let request: ApplyDeploymentPolicyOverrideOperationsRequest;
    try {
      request = parseApplyDeploymentPolicyOverrideOperationsRequest(input.request);
    } catch (error) {
      return this.failedValidation(error, "Unable to apply deployment policy override update.");
    }

    try {
      const apiResponse = await this.dependencies.client.applyOverrideOperations(request, normalizedContext(input.context));
      if (!apiResponse.ok || !apiResponse.data) {
        return this.failedFromApi(apiResponse, "Unable to apply deployment policy override update.");
      }

      const parsedResponse = parseApplyDeploymentPolicyOverrideOperationsResponse(apiResponse.data);
      return Object.freeze({
        ok: true,
        data: parsedResponse,
      });
    } catch {
      return this.failed("internal", "Unable to apply deployment policy override update.");
    }
  }

  private failed(
    code: string | undefined,
    message: string,
    validationIssues: ReadonlyArray<DeploymentPolicyAdministrationWriteValidationIssue> = Object.freeze([]),
  ): { readonly ok: false; readonly error: DeploymentPolicyAdministrationWriteServiceError } {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        validationIssues,
      }),
    });
  }

  private failedValidation(
    error: unknown,
    fallbackMessage: string,
  ): { readonly ok: false; readonly error: DeploymentPolicyAdministrationWriteServiceError } {
    if (error instanceof DeploymentPolicyWriteSchemaValidationError) {
      return this.failed(
        "invalid-request",
        fallbackMessage,
        Object.freeze(error.issues.map((issue) => Object.freeze({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        }))),
      );
    }

    return this.failed("invalid-request", fallbackMessage);
  }

  private failedFromApi(
    response: SharedApiResponseEnvelope<unknown>,
    fallbackMessage: string,
  ): { readonly ok: false; readonly error: DeploymentPolicyAdministrationWriteServiceError } {
    const message = response.error?.message?.trim() || fallbackMessage;
    return this.failed(
      response.error?.code,
      message,
      toValidationIssues(response.error?.validationErrors),
    );
  }
}

function createDefaultDeploymentPolicyAdministrationWriteClient(): DeploymentPolicyAdministrationWriteClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpDeploymentPolicyAdministrationWriteClient(baseUrl);
}

class HttpDeploymentPolicyAdministrationWriteClient implements DeploymentPolicyAdministrationWriteClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async updateActiveProfile(
    request: UpdateDeploymentPolicyActiveProfileRequest,
    context: DeploymentPolicyAdministrationWriteRequestContext,
  ): Promise<SharedApiResponseEnvelope<UpdateDeploymentPolicyActiveProfileResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", context.workspaceId);

    const response = await fetch(`${this.baseUrl}${DeploymentPolicyWriteTransportRoutes.updateActiveProfile}?${query.toString()}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${context.sessionToken}`,
      },
      body: JSON.stringify(request),
    });

    return await response.json() as SharedApiResponseEnvelope<UpdateDeploymentPolicyActiveProfileResponse>;
  }

  public async applyOverrideOperations(
    request: ApplyDeploymentPolicyOverrideOperationsRequest,
    context: DeploymentPolicyAdministrationWriteRequestContext,
  ): Promise<SharedApiResponseEnvelope<ApplyDeploymentPolicyOverrideOperationsResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", context.workspaceId);

    const response = await fetch(`${this.baseUrl}${DeploymentPolicyWriteTransportRoutes.applyOverrides}?${query.toString()}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${context.sessionToken}`,
      },
      body: JSON.stringify(request),
    });

    return await response.json() as SharedApiResponseEnvelope<ApplyDeploymentPolicyOverrideOperationsResponse>;
  }
}

function isValidWriteContext(context: DeploymentPolicyAdministrationWriteRequestContext): boolean {
  return Boolean(context.actorUserIdentityId.trim())
    && Boolean(context.sessionToken.trim())
    && Boolean(context.workspaceId.trim());
}

function normalizedContext(context: DeploymentPolicyAdministrationWriteRequestContext): DeploymentPolicyAdministrationWriteRequestContext {
  return Object.freeze({
    actorUserIdentityId: context.actorUserIdentityId.trim(),
    sessionToken: context.sessionToken.trim(),
    workspaceId: context.workspaceId.trim(),
  });
}

function toValidationIssues(
  issues: ReadonlyArray<SharedApiValidationIssue> | undefined,
): ReadonlyArray<DeploymentPolicyAdministrationWriteValidationIssue> {
  if (!issues || issues.length < 1) {
    return Object.freeze([]);
  }

  return Object.freeze(issues.map((issue) => Object.freeze({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  })));
}
