import { IdentityErrorCodes } from "../../../application/contracts/IdentityApplicationContracts";
import type {
  LoginLocalAccountUseCase,
  LoginLocalAccountErrorCode,
} from "../../../src/application/identity/use-cases/LoginLocalAccountUseCase";
import type {
  RegisterLocalAccountUseCase,
  RegisterLocalAccountErrorCode,
} from "../../../src/application/identity/use-cases/RegisterLocalAccountUseCase";
import {
  IdentityAuthApiErrorCodes,
  type IdentityAuthApiError,
  type IdentityAuthApiResponse,
  type LoginLocalIdentityApiRequest,
  type LoginLocalIdentityApiResponse,
  type RegisterLocalIdentityApiRequest,
  type RegisterLocalIdentityApiResponse,
} from "./sdk/PublicIdentityAuthApiContract";
import { IdentityAuthObservability, type IdentityAuthObservabilityOptions } from "./IdentityAuthObservability";

interface IdentityAuthBackendApiDependencies {
  readonly registerLocalAccountUseCase: RegisterLocalAccountUseCase;
  readonly loginLocalAccountUseCase: LoginLocalAccountUseCase;
  readonly observability?: IdentityAuthObservabilityOptions;
}

export class IdentityAuthBackendApi {
  private readonly observability: IdentityAuthObservability;

  public constructor(private readonly dependencies: IdentityAuthBackendApiDependencies) {
    this.observability = new IdentityAuthObservability(dependencies.observability);
  }

  public async registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> {
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
      data: Object.freeze({
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

    const response = Object.freeze({
      ok: true,
      data: Object.freeze({
        userIdentityId: result.value.userIdentityId,
        username: result.value.username,
        email: result.value.email,
        displayName: result.value.displayName,
        providerId: result.value.providerId,
        providerSubject: result.value.providerSubject,
        authPath: result.value.authPath,
        authenticatedAt: result.value.authenticatedAt,
      }),
    });

    await this.observability.recordApiOutcome({
      flow: "local-login",
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
}
