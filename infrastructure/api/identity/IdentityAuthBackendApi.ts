import { IdentityErrorCodes } from "../../../application/contracts/IdentityApplicationContracts";
import type { IIdentityLookupRepository } from "../../../application/identity/ports/IIdentityLookupRepository";
import type {
  LoginLocalAccountUseCase,
  LoginLocalAccountErrorCode,
} from "../../../src/application/identity/use-cases/LoginLocalAccountUseCase";
import type {
  ListLocalIdentityAccountsUseCase,
  ListLocalIdentityAccountsErrorCode,
} from "../../../src/application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import type {
  GetLocalIdentityAccountStatusUseCase,
  GetLocalIdentityAccountStatusErrorCode,
} from "../../../src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import type {
  SetLocalIdentityAccountStatusUseCase,
  SetLocalIdentityAccountStatusErrorCode,
} from "../../../src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import type {
  LogoutIdentitySessionUseCase,
  LogoutIdentitySessionErrorCode,
} from "../../../src/application/identity/use-cases/LogoutIdentitySessionUseCase";
import type {
  RevokeIdentitySessionUseCase,
  RevokeIdentitySessionErrorCode,
} from "../../../src/application/identity/use-cases/RevokeIdentitySessionUseCase";
import type { IdentitySessionAccessChannel } from "../../../src/domain/identity/IdentityDomain";
import type {
  RegisterLocalAccountUseCase,
  RegisterLocalAccountErrorCode,
} from "../../../src/application/identity/use-cases/RegisterLocalAccountUseCase";
import {
  IdentityAuthApiErrorCodes,
  type IdentityAuthApiError,
  type IdentityAuthApiResponse,
  type GetIdentityAdminAccountStatusApiRequest,
  type GetIdentityAdminAccountStatusApiResponse,
  type ListIdentityAdminAccountsApiRequest,
  type ListIdentityAdminAccountsApiResponse,
  type LoginLocalIdentityApiRequest,
  type LoginLocalIdentityApiResponse,
  type LogoutAuthenticatedSessionApiRequest,
  type LogoutAuthenticatedSessionApiResponse,
  type RevokeIdentitySessionApiRequest,
  type RevokeIdentitySessionApiResponse,
  type SetIdentityAdminAccountStatusApiRequest,
  type SetIdentityAdminAccountStatusApiResponse,
  type ResolveAuthenticatedSessionApiRequest,
  type ResolveAuthenticatedSessionApiResponse,
  type RegisterLocalIdentityApiRequest,
  type RegisterLocalIdentityApiResponse,
} from "./sdk/PublicIdentityAuthApiContract";
import { IdentityAuthObservability, type IdentityAuthObservabilityOptions } from "./IdentityAuthObservability";
import { IdentityAuthenticatedSessionService } from "../../../application/identity/services/IdentityAuthenticatedSessionService";
import {
  serializeGetIdentityAdminAccountStatusResponse,
  serializeListIdentityAdminAccountsResponse,
  serializeLoginLocalIdentityResponse,
  serializeLogoutAuthenticatedSessionResponse,
  serializeRegisterLocalIdentityResponse,
  serializeResolveAuthenticatedSessionResponse,
  serializeRevokeIdentitySessionResponse,
  serializeSetIdentityAdminAccountStatusResponse,
} from "./IdentityAuthResponseSerializers";

interface IdentityAuthBackendApiDependencies {
  readonly registerLocalAccountUseCase: RegisterLocalAccountUseCase;
  readonly loginLocalAccountUseCase: LoginLocalAccountUseCase;
  readonly logoutIdentitySessionUseCase: LogoutIdentitySessionUseCase;
  readonly revokeIdentitySessionUseCase: RevokeIdentitySessionUseCase;
  readonly listLocalIdentityAccountsUseCase: ListLocalIdentityAccountsUseCase;
  readonly getLocalIdentityAccountStatusUseCase: GetLocalIdentityAccountStatusUseCase;
  readonly setLocalIdentityAccountStatusUseCase: SetLocalIdentityAccountStatusUseCase;
  readonly identityLookupRepository: IIdentityLookupRepository;
  readonly authenticatedSessionService: IdentityAuthenticatedSessionService;
  readonly observability?: IdentityAuthObservabilityOptions;
  readonly featurePolicies?: {
    readonly allowLocalRegistration?: boolean;
    readonly allowLocalAdministration?: boolean;
  };
}

export class IdentityAuthBackendApi {
  private readonly observability: IdentityAuthObservability;
  private readonly featurePolicies: {
    readonly allowLocalRegistration: boolean;
    readonly allowLocalAdministration: boolean;
  };

  public constructor(private readonly dependencies: IdentityAuthBackendApiDependencies) {
    this.observability = new IdentityAuthObservability(dependencies.observability);
    this.featurePolicies = Object.freeze({
      allowLocalRegistration: dependencies.featurePolicies?.allowLocalRegistration ?? true,
      allowLocalAdministration: dependencies.featurePolicies?.allowLocalAdministration ?? true,
    });
  }

  public async registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> {
    if (!this.featurePolicies.allowLocalRegistration) {
      return Object.freeze({
        ok: false,
        error: {
          code: IdentityAuthApiErrorCodes.forbidden,
          message: "Local registration is disabled by identity policy configuration.",
        },
      });
    }

    const result = await this.dependencies.registerLocalAccountUseCase.execute({
      username: request.username,
      email: request.email,
      displayName: request.displayName,
      providerId: request.providerId,
      providerSubject: request.providerSubject,
      credentialPolicyId: request.credentialPolicyId,
      credential: {
        candidate: request.credential.candidate,
      },
    });

    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapRegisterError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "local-register",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeRegisterLocalIdentityResponse({
        userIdentityId: result.value.userIdentityId,
        providerId: result.value.providerId,
        providerSubject: result.value.providerSubject,
        registeredAt: result.value.registeredAt,
      }),
    });

    await this.observability.recordApiOutcome({
      flow: "local-register",
      request,
      response,
    });
    return response;
  }

  public async loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    const result = await this.dependencies.loginLocalAccountUseCase.execute({
      providerId: request.providerId,
      providerSubject: request.providerSubject,
      credential: {
        candidate: request.credential.candidate,
      },
    });

    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapLoginError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "local-login",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const issueSessionResult = await this.dependencies.authenticatedSessionService.issueAuthenticatedSession({
      userIdentityId: result.value.userIdentityId,
      providerId: result.value.providerId,
      providerSubject: result.value.providerSubject,
      accessChannel: normalizeAccessChannel(request.accessChannel),
      client: request.client,
    });
    if (!issueSessionResult.ok) {
      const response = Object.freeze({
        ok: false,
        error: {
          code: IdentityAuthApiErrorCodes.internal,
          message: "Identity login failed to issue a session.",
        },
      });
      await this.observability.recordApiOutcome({
        flow: "local-login",
        request,
        response,
        errorCode: issueSessionResult.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeLoginLocalIdentityResponse(result.value, issueSessionResult.value),
    });

    await this.observability.recordApiOutcome({
      flow: "local-login",
      request,
      response,
    });
    return response;
  }

  public async resolveAuthenticatedSession(
    request: ResolveAuthenticatedSessionApiRequest,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    const resolved = await this.dependencies.authenticatedSessionService.resolveAuthenticatedSessionByToken({
      token: request.sessionToken,
    });
    if (!resolved.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapSessionValidationError(resolved.error.code),
      });
    }

    const principal = await this.dependencies.identityLookupRepository.findUserIdentityById(
      resolved.value.session.userIdentityId,
    );
    if (!principal) {
      return Object.freeze({
        ok: false,
        error: {
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: "Invalid session.",
        },
      });
    }

    return Object.freeze({
      ok: true,
      data: serializeResolveAuthenticatedSessionResponse({
        principal: {
          userIdentityId: principal.id,
          username: principal.username,
          email: principal.email,
          displayName: principal.displayName,
        },
        session: {
          sessionId: resolved.value.session.id,
          providerId: resolved.value.session.providerId,
          providerSubject: resolved.value.session.providerSubject,
          accessChannel: resolved.value.session.client?.accessChannel,
          deviceId: resolved.value.session.client?.deviceId,
          trustedDeviceBindingId: resolved.value.trustedDeviceBindingId,
          trustMarker: resolved.value.trustMarker,
          issuedAt: resolved.value.session.issuedAt,
          expiresAt: resolved.value.session.expiresAt,
        },
      }),
    });
  }

  public async logoutAuthenticatedSession(
    request: LogoutAuthenticatedSessionApiRequest,
  ): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>> {
    const result = await this.dependencies.logoutIdentitySessionUseCase.execute({
      sessionToken: request.sessionToken,
    });
    if (!result.ok) {
      const response = Object.freeze({
        ok: false,
        error: this.mapLogoutError(result.error.code),
      });
      await this.observability.recordApiOutcome({
        flow: "local-logout",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeLogoutAuthenticatedSessionResponse(result.value),
    });
    await this.observability.recordApiOutcome({
      flow: "local-logout",
      request,
      response,
    });
    return response;
  }

  public async revokeIdentitySession(
    request: RevokeIdentitySessionApiRequest,
  ): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>> {
    const result = await this.dependencies.revokeIdentitySessionUseCase.execute({
      sessionId: request.sessionId,
      actorUserIdentityId: request.actorUserIdentityId,
      reason: request.reason,
    });
    if (!result.ok) {
      const response = Object.freeze({
        ok: false,
        error: this.mapRevokeSessionError(result.error.code),
      });
      await this.observability.recordApiOutcome({
        flow: "session-revoke",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeRevokeIdentitySessionResponse(result.value),
    });
    await this.observability.recordApiOutcome({
      flow: "session-revoke",
      request,
      response,
    });
    return response;
  }

  public async listIdentityAdminAccounts(
    request: ListIdentityAdminAccountsApiRequest,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>> {
    if (!this.featurePolicies.allowLocalAdministration) {
      return this.adminOperationsDisabledResponse();
    }

    const result = await this.dependencies.listLocalIdentityAccountsUseCase.execute(request);
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapAdminAccountError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "admin-accounts-list",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeListIdentityAdminAccountsResponse({
        accounts: result.value.accounts,
      }),
    });
    await this.observability.recordApiOutcome({
      flow: "admin-accounts-list",
      request,
      response,
    });
    return response;
  }

  public async getIdentityAdminAccountStatus(
    request: GetIdentityAdminAccountStatusApiRequest,
  ): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>> {
    if (!this.featurePolicies.allowLocalAdministration) {
      return this.adminOperationsDisabledResponse();
    }

    const result = await this.dependencies.getLocalIdentityAccountStatusUseCase.execute(request);
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapAdminAccountError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "admin-account-get",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeGetIdentityAdminAccountStatusResponse({
        account: result.value.account,
      }),
    });
    await this.observability.recordApiOutcome({
      flow: "admin-account-get",
      request,
      response,
    });
    return response;
  }

  public async setIdentityAdminAccountStatus(
    request: SetIdentityAdminAccountStatusApiRequest,
  ): Promise<IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>> {
    if (!this.featurePolicies.allowLocalAdministration) {
      return this.adminOperationsDisabledResponse();
    }

    const result = await this.dependencies.setLocalIdentityAccountStatusUseCase.execute(request);
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapAdminAccountError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "admin-account-status-set",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeSetIdentityAdminAccountStatusResponse(result.value),
    });
    await this.observability.recordApiOutcome({
      flow: "admin-account-status-set",
      request,
      response,
    });
    return response;
  }

  private mapRegisterError(code: RegisterLocalAccountErrorCode): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.duplicateIdentity:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.conflict,
          message: "An account already exists with the requested identity.",
        });
      case IdentityErrorCodes.unsupportedProvider:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.unsupportedProvider,
          message: "The selected identity provider is not supported for local registration.",
        });
      case IdentityErrorCodes.invalidState:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Identity registration is not currently available.",
        });
      case IdentityErrorCodes.policyViolation:
      case IdentityErrorCodes.invalidCredentials:
      case IdentityErrorCodes.invalidRequest:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The registration request is invalid.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected identity registration error.",
        });
    }
  }

  private mapLoginError(code: LoginLocalAccountErrorCode): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidCredentials:
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: "Invalid credentials.",
        });
      case IdentityErrorCodes.inactiveAccount:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.accountInactive,
          message: "The account is not active for local login.",
        });
      case IdentityErrorCodes.unsupportedProvider:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.unsupportedProvider,
          message: "The selected identity provider is not supported for local login.",
        });
      case IdentityErrorCodes.invalidRequest:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The login request is invalid.",
        });
      case IdentityErrorCodes.invalidState:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Identity login is not currently available.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected identity login error.",
        });
    }
  }

  private mapSessionValidationError(code: string): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidRequest:
      case IdentityErrorCodes.invalidSessionState:
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: "Invalid session.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected session validation error.",
        });
    }
  }

  private mapLogoutError(code: LogoutIdentitySessionErrorCode): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidRequest:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The logout request is invalid.",
        });
      case IdentityErrorCodes.invalidSessionState:
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: "Invalid session.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected logout error.",
        });
    }
  }

  private mapRevokeSessionError(code: RevokeIdentitySessionErrorCode): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidRequest:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The session revocation request is invalid.",
        });
      case IdentityErrorCodes.invalidSessionState:
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: "Invalid session.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected session revocation error.",
        });
    }
  }

  private mapAdminAccountError(
    code: ListLocalIdentityAccountsErrorCode
      | GetLocalIdentityAccountStatusErrorCode
      | SetLocalIdentityAccountStatusErrorCode,
  ): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidRequest:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The identity administration request is invalid.",
        });
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.notFound,
          message: "The requested identity account was not found.",
        });
      case IdentityErrorCodes.invalidState:
      case IdentityErrorCodes.invalidSessionState:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.accountInactive,
          message: "The identity account cannot process this status change.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected identity administration error.",
        });
    }
  }

  private adminOperationsDisabledResponse<TResponse>(): IdentityAuthApiResponse<TResponse> {
    return Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.forbidden,
        message: "Local identity administration is disabled by identity policy configuration.",
      },
    });
  }
}

function normalizeAccessChannel(value?: "desktop" | "thin-client"): IdentitySessionAccessChannel {
  return value ?? "thin-client";
}
