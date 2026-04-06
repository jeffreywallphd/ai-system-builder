import { IdentityErrorCodes } from "../../../../application/contracts/IdentityApplicationContracts";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type {
  ChangeLocalPasswordCredentialUseCase,
  ChangeLocalPasswordCredentialErrorCode,
} from "../../../application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import type {
  LoginLocalAccountUseCase,
  LoginLocalAccountErrorCode,
} from "../../../application/identity/use-cases/LoginLocalAccountUseCase";
import type {
  ListLocalIdentityAccountsUseCase,
  ListLocalIdentityAccountsErrorCode,
} from "../../../application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import type {
  GetLocalIdentityAccountStatusUseCase,
  GetLocalIdentityAccountStatusErrorCode,
} from "../../../application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import type {
  SetLocalIdentityAccountStatusUseCase,
  SetLocalIdentityAccountStatusErrorCode,
} from "../../../application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import type {
  LogoutIdentitySessionUseCase,
  LogoutIdentitySessionErrorCode,
} from "../../../application/identity/use-cases/LogoutIdentitySessionUseCase";
import type {
  RevokeIdentitySessionUseCase,
  RevokeIdentitySessionErrorCode,
} from "../../../application/identity/use-cases/RevokeIdentitySessionUseCase";
import type {
  ListTrustedDevicesUseCase,
  ListTrustedDevicesErrorCode,
} from "../../../application/identity/use-cases/ListTrustedDevicesUseCase";
import type {
  GetTrustedDeviceUseCase,
  GetTrustedDeviceErrorCode,
} from "../../../application/identity/use-cases/GetTrustedDeviceUseCase";
import type {
  RevokeTrustedDeviceUseCase,
  RevokeTrustedDeviceErrorCode,
} from "../../../application/identity/use-cases/RevokeTrustedDeviceUseCase";
import type {
  UpdateTrustedDeviceDisplayNameUseCase,
  UpdateTrustedDeviceDisplayNameErrorCode,
} from "../../../application/identity/use-cases/UpdateTrustedDeviceDisplayNameUseCase";
import type {
  InitiateTrustedDevicePairingUseCase,
  InitiateTrustedDevicePairingErrorCode,
} from "../../../application/identity/use-cases/InitiateTrustedDevicePairingUseCase";
import type {
  ValidateTrustedDevicePairingUseCase,
  ValidateTrustedDevicePairingErrorCode,
} from "../../../application/identity/use-cases/ValidateTrustedDevicePairingUseCase";
import type { CompleteTrustedDevicePairingUseCase } from "../../../application/identity/use-cases/CompleteTrustedDevicePairingUseCase";
import type { IdentitySessionAccessChannel } from "../../../domain/identity/IdentityDomain";
import type {
  RegisterLocalAccountUseCase,
  RegisterLocalAccountErrorCode,
} from "../../../application/identity/use-cases/RegisterLocalAccountUseCase";
import {
  type ChangeLocalPasswordCredentialApiRequest,
  type ChangeLocalPasswordCredentialApiResponse,
  IdentityAuthApiErrorCodes,
  type IdentityAuthApiError,
  type IdentityAuthApiResponse,
  type GetIdentityAdminAccountStatusApiRequest,
  type GetIdentityAdminAccountStatusApiResponse,
  type ListIdentityAdminAccountsApiRequest,
  type ListIdentityAdminAccountsApiResponse,
  type ListIdentityAdminTrustedDevicesApiRequest,
  type ListIdentityAdminTrustedDevicesApiResponse,
  type ListTrustedDevicesApiRequest,
  type ListTrustedDevicesApiResponse,
  type LoginLocalIdentityApiRequest,
  type LoginLocalIdentityApiResponse,
  type LogoutAuthenticatedSessionApiRequest,
  type LogoutAuthenticatedSessionApiResponse,
  type CompleteTrustedDevicePairingApiRequest,
  type CompleteTrustedDevicePairingApiResponse,
  type GetTrustedDeviceApiRequest,
  type GetTrustedDeviceApiResponse,
  type InitiateTrustedDevicePairingApiRequest,
  type InitiateTrustedDevicePairingApiResponse,
  type RevokeIdentitySessionApiRequest,
  type RevokeIdentitySessionApiResponse,
  type RevokeTrustedDeviceApiRequest,
  type RevokeTrustedDeviceApiResponse,
  type RevokeIdentityAdminTrustedDeviceApiRequest,
  type RevokeIdentityAdminTrustedDeviceApiResponse,
  type SetIdentityAdminAccountStatusApiRequest,
  type SetIdentityAdminAccountStatusApiResponse,
  type ResolveAuthenticatedSessionApiRequest,
  type ResolveAuthenticatedSessionApiResponse,
  type IdentitySessionTrustInvalidationReason,
  type RegisterLocalIdentityApiRequest,
  type RegisterLocalIdentityApiResponse,
  type UpdateTrustedDeviceDisplayNameApiRequest,
  type UpdateTrustedDeviceDisplayNameApiResponse,
  type ValidateTrustedDevicePairingApiRequest,
  type ValidateTrustedDevicePairingApiResponse,
} from "./sdk/PublicIdentityAuthApiContract";
import {
  RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy,
  TrustedDeviceAdministrativeActions,
  type TrustedDeviceAdministrativeAuthorizationPolicy,
} from "../../../application/identity/use-cases/TrustedDeviceAdministrativeAuthorization";
import { IdentityAuthObservability, type IdentityAuthObservabilityOptions } from "./IdentityAuthObservability";
import { IdentityAuthenticatedSessionService } from "../../../../application/identity/services/IdentityAuthenticatedSessionService";
import {
  IdentitySessionTrustRequirements,
  type IIdentitySessionTrustService,
  type IdentitySessionTrustRequirement,
} from "../../../../application/identity/ports/IIdentitySessionTrustService";
import {
  serializeChangeLocalPasswordCredentialResponse,
  serializeCompleteTrustedDevicePairingResponse,
  serializeGetIdentityAdminAccountStatusResponse,
  serializeInitiateTrustedDevicePairingResponse,
  serializeListIdentityAdminAccountsResponse,
  serializeListTrustedDevicesResponse,
  serializeLoginLocalIdentityResponse,
  serializeLogoutAuthenticatedSessionResponse,
  serializeRegisterLocalIdentityResponse,
  serializeResolveAuthenticatedSessionResponse,
  serializeRevokeIdentitySessionResponse,
  serializeTrustedDeviceResponse,
  serializeSetIdentityAdminAccountStatusResponse,
  serializeUpdateTrustedDeviceDisplayNameResponse,
  serializeValidateTrustedDevicePairingResponse,
} from "./IdentityAuthResponseSerializers";

interface IdentityAuthBackendApiDependencies {
  readonly registerLocalAccountUseCase: RegisterLocalAccountUseCase;
  readonly loginLocalAccountUseCase: LoginLocalAccountUseCase;
  readonly changeLocalPasswordCredentialUseCase: ChangeLocalPasswordCredentialUseCase;
  readonly logoutIdentitySessionUseCase: LogoutIdentitySessionUseCase;
  readonly revokeIdentitySessionUseCase: RevokeIdentitySessionUseCase;
  readonly listLocalIdentityAccountsUseCase: ListLocalIdentityAccountsUseCase;
  readonly getLocalIdentityAccountStatusUseCase: GetLocalIdentityAccountStatusUseCase;
  readonly setLocalIdentityAccountStatusUseCase: SetLocalIdentityAccountStatusUseCase;
  readonly listTrustedDevicesUseCase: ListTrustedDevicesUseCase;
  readonly getTrustedDeviceUseCase: GetTrustedDeviceUseCase;
  readonly revokeTrustedDeviceUseCase: RevokeTrustedDeviceUseCase;
  readonly updateTrustedDeviceDisplayNameUseCase: UpdateTrustedDeviceDisplayNameUseCase;
  readonly initiateTrustedDevicePairingUseCase: InitiateTrustedDevicePairingUseCase;
  readonly validateTrustedDevicePairingUseCase: ValidateTrustedDevicePairingUseCase;
  readonly completeTrustedDevicePairingUseCase: CompleteTrustedDevicePairingUseCase;
  readonly identityLookupRepository: IIdentityLookupRepository;
  readonly authenticatedSessionService: IdentityAuthenticatedSessionService;
  readonly sessionTrustService?: IIdentitySessionTrustService;
  readonly observability?: IdentityAuthObservabilityOptions;
  readonly featurePolicies?: {
    readonly allowLocalRegistration?: boolean;
    readonly allowLocalAdministration?: boolean;
  };
  readonly trustedDeviceAdministration?: {
    readonly policy?: TrustedDeviceAdministrativeAuthorizationPolicy;
    readonly bootstrapAdminUserIdentityIds?: ReadonlyArray<string>;
    readonly adminAssertions?: ReadonlyArray<string>;
  };
}

export class IdentityAuthBackendApi {
  private readonly observability: IdentityAuthObservability;
  private readonly featurePolicies: {
    readonly allowLocalRegistration: boolean;
    readonly allowLocalAdministration: boolean;
  };
  private readonly trustedDeviceAdministrationPolicy: TrustedDeviceAdministrativeAuthorizationPolicy;

  public constructor(private readonly dependencies: IdentityAuthBackendApiDependencies) {
    this.observability = new IdentityAuthObservability(dependencies.observability);
    this.featurePolicies = Object.freeze({
      allowLocalRegistration: dependencies.featurePolicies?.allowLocalRegistration ?? true,
      allowLocalAdministration: dependencies.featurePolicies?.allowLocalAdministration ?? true,
    });
    this.trustedDeviceAdministrationPolicy = dependencies.trustedDeviceAdministration?.policy
      ?? new RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy({
        bootstrapAdminUserIdentityIds: dependencies.trustedDeviceAdministration?.bootstrapAdminUserIdentityIds,
        adminAssertions: dependencies.trustedDeviceAdministration?.adminAssertions,
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
      const response = Object.freeze({ ok: false, error: this.mapRegisterError(result.error) });
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
    const accessChannel = normalizeAccessChannel(request.accessChannel);
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

    const issuanceTrust = await this.resolveSessionIssuanceTrust({
      request,
      userIdentityId: result.value.userIdentityId,
      accessChannel,
      evaluatedAt: result.value.authenticatedAt,
    });
    if (!issuanceTrust.ok) {
      return issuanceTrust.response;
    }

    const issueSessionResult = await this.dependencies.authenticatedSessionService.issueAuthenticatedSession({
      userIdentityId: result.value.userIdentityId,
      providerId: result.value.providerId,
      providerSubject: result.value.providerSubject,
      accessChannel,
      client: {
        userAgent: request.client?.userAgent,
        ipAddress: request.client?.ipAddress,
        deviceId: request.client?.deviceId,
        deviceTrust: issuanceTrust.sessionClientTrust?.deviceTrust,
        trustedDeviceBindingId: issuanceTrust.sessionClientTrust?.trustedDeviceBindingId,
        trustMarker: issuanceTrust.sessionClientTrust?.trustMarker,
      },
    });
    if (!issueSessionResult.ok) {
      if (issueSessionResult.error.code === IdentityErrorCodes.invalidSessionState) {
        const response = Object.freeze({
          ok: false,
          error: {
            code: IdentityAuthApiErrorCodes.authenticationFailed,
            message: "Session trust requirements were not satisfied.",
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

  private async resolveSessionIssuanceTrust(input: {
    readonly request: LoginLocalIdentityApiRequest;
    readonly userIdentityId: string;
    readonly accessChannel: IdentitySessionAccessChannel;
    readonly evaluatedAt: string;
  }): Promise<
    | {
      readonly ok: true;
      readonly sessionClientTrust?: {
        readonly deviceTrust?: {
          readonly trustedDeviceId?: string;
          readonly issuedOnTrustedDevice?: boolean;
          readonly sessionAssuranceLevel?: "authenticated-untrusted" | "authenticated-trusted" | "authenticated-restricted";
          readonly snapshot?: {
            readonly state: "unknown" | "untrusted" | "trusted" | "pending-pairing" | "revoked" | "expired";
            readonly evaluatedAt: string;
          };
          readonly invalidationReasons?: ReadonlyArray<"trusted-device-revoked" | "trusted-device-trust-lost" | "trusted-device-expired" | "trusted-device-mismatch">;
          readonly trustedDeviceBindingId?: string;
          readonly trustMarker?: string;
        };
        readonly trustedDeviceBindingId?: string;
        readonly trustMarker?: string;
      };
    }
    | {
      readonly ok: false;
      readonly response: IdentityAuthApiResponse<LoginLocalIdentityApiResponse>;
    }
  > {
    if (!this.dependencies.sessionTrustService) {
      return {
        ok: true,
        sessionClientTrust: input.request.client
          ? Object.freeze({
              deviceTrust: input.request.client.deviceTrustContext
                ? Object.freeze({
                    trustedDeviceId: input.request.client.deviceTrustContext.trustedDeviceId,
                    issuedOnTrustedDevice: input.request.client.deviceTrustContext.issuedOnTrustedDevice,
                    sessionAssuranceLevel: input.request.client.deviceTrustContext.sessionAssuranceLevel,
                    snapshot: input.request.client.deviceTrustContext.trustStateSnapshot
                      ? Object.freeze({
                          state: input.request.client.deviceTrustContext.trustStateSnapshot.state,
                          evaluatedAt: input.request.client.deviceTrustContext.trustStateSnapshot.evaluatedAt,
                        })
                      : undefined,
                    invalidationReasons: input.request.client.deviceTrustContext.invalidationReasons,
                    trustedDeviceBindingId: input.request.client.deviceTrustContext.trustedDeviceBindingId,
                    trustMarker: input.request.client.deviceTrustContext.trustMarker,
                  })
                : undefined,
              trustedDeviceBindingId: input.request.client.trustedDeviceBindingId,
              trustMarker: input.request.client.trustMarker,
            })
          : undefined,
      };
    }

    const issuanceTrust = await this.dependencies.sessionTrustService.resolveSessionIssuanceTrust({
      userIdentityId: input.userIdentityId,
      accessChannel: input.accessChannel,
      requestedTrustRequirement: normalizeSessionTrustRequirement(input.request.sessionTrustRequirement),
      client: input.request.client ? Object.freeze({
        userAgent: input.request.client.userAgent,
        ipAddress: input.request.client.ipAddress,
        deviceId: input.request.client.deviceId,
        deviceTrust: input.request.client.deviceTrustContext
          ? Object.freeze({
              trustedDeviceId: input.request.client.deviceTrustContext.trustedDeviceId,
              issuedOnTrustedDevice: input.request.client.deviceTrustContext.issuedOnTrustedDevice,
              sessionAssuranceLevel: input.request.client.deviceTrustContext.sessionAssuranceLevel,
              snapshot: input.request.client.deviceTrustContext.trustStateSnapshot
                ? Object.freeze({
                    state: input.request.client.deviceTrustContext.trustStateSnapshot.state,
                    evaluatedAt: input.request.client.deviceTrustContext.trustStateSnapshot.evaluatedAt,
                  })
                : undefined,
              invalidationReasons: input.request.client.deviceTrustContext.invalidationReasons,
              trustedDeviceBindingId: input.request.client.deviceTrustContext.trustedDeviceBindingId,
              trustMarker: input.request.client.deviceTrustContext.trustMarker,
            })
          : undefined,
        trustedDeviceBindingId: input.request.client.trustedDeviceBindingId,
        trustMarker: input.request.client.trustMarker,
      }) : undefined,
      evaluatedAt: input.evaluatedAt,
    });

    if (!issuanceTrust.allowed) {
      return {
        ok: false,
        response: Object.freeze({
          ok: false,
          error: {
            code: IdentityAuthApiErrorCodes.authenticationFailed,
            message: issuanceTrust.reason,
          },
        }),
      };
    }

    return {
      ok: true,
      sessionClientTrust: Object.freeze({
        deviceTrust: issuanceTrust.deviceTrustContext,
        trustedDeviceBindingId: issuanceTrust.trustedDeviceBindingId,
        trustMarker: issuanceTrust.trustMarker,
      }),
    };
  }

  public async changeLocalPasswordCredential(
    request: ChangeLocalPasswordCredentialApiRequest & { readonly userIdentityId: string },
  ): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>> {
    const result = await this.dependencies.changeLocalPasswordCredentialUseCase.execute({
      userIdentityId: request.userIdentityId,
      providerId: request.providerId,
      providerSubject: request.providerSubject,
      credentialPolicyId: request.credentialPolicyId,
      newCredential: request.newCredential,
      verification: request.verification,
    });

    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapChangeCredentialError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "local-credential-change",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeChangeLocalPasswordCredentialResponse(result.value),
    });
    await this.observability.recordApiOutcome({
      flow: "local-credential-change",
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
        error: this.mapSessionValidationError(resolved.error),
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
          deviceTrustContext: resolved.value.deviceTrustContext
            ? Object.freeze({
                trustedDeviceId: resolved.value.deviceTrustContext.trustedDeviceId,
                issuedOnTrustedDevice: resolved.value.deviceTrustContext.issuedOnTrustedDevice,
                sessionAssuranceLevel: resolved.value.deviceTrustContext.sessionAssuranceLevel,
                trustStateSnapshot: resolved.value.deviceTrustContext.snapshot
                  ? Object.freeze({
                      state: resolved.value.deviceTrustContext.snapshot.state,
                      evaluatedAt: resolved.value.deviceTrustContext.snapshot.evaluatedAt,
                    })
                  : undefined,
                invalidationReasons: resolved.value.deviceTrustContext.invalidationReasons,
                trustedDeviceBindingId: resolved.value.deviceTrustContext.trustedDeviceBindingId,
                trustMarker: resolved.value.deviceTrustContext.trustMarker,
              })
            : undefined,
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

  public async listIdentityAdminTrustedDevices(
    request: ListIdentityAdminTrustedDevicesApiRequest,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>> {
    if (!this.featurePolicies.allowLocalAdministration) {
      return this.adminOperationsDisabledResponse();
    }

    const decision = this.trustedDeviceAdministrationPolicy.evaluate({
      action: TrustedDeviceAdministrativeActions.listTrustedDevices,
      context: request.context,
      targetUserIdentityId: request.userIdentityId,
      targetWorkspaceId: request.workspaceId,
    });
    if (!decision.allowed) {
      const response = this.adminAuthorizationDeniedResponse<ListIdentityAdminTrustedDevicesApiResponse>(
        decision.message ?? "Trusted-device administrative access denied.",
      );
      await this.observability.recordApiOutcome({
        flow: "admin-trusted-device.list",
        request,
        response,
      });
      return response;
    }

    const result = await this.dependencies.listTrustedDevicesUseCase.execute({
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      includeStatuses: request.includeStatuses,
      limit: request.limit,
      offset: request.offset,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "admin-trusted-device.list",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeListTrustedDevicesResponse(result.value.devices),
    });
    await this.observability.recordApiOutcome({
      flow: "admin-trusted-device.list",
      request,
      response,
    });
    return response;
  }

  public async revokeIdentityAdminTrustedDevice(
    request: RevokeIdentityAdminTrustedDeviceApiRequest,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>> {
    if (!this.featurePolicies.allowLocalAdministration) {
      return this.adminOperationsDisabledResponse();
    }

    const existing = await this.dependencies.getTrustedDeviceUseCase.execute({
      trustedDeviceId: request.trustedDeviceId,
    });
    if (!existing.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(existing.error.code) });
      await this.observability.recordApiOutcome({
        flow: "admin-trusted-device.revoke",
        request,
        response,
        errorCode: existing.error.code,
      });
      return response;
    }

    const decision = this.trustedDeviceAdministrationPolicy.evaluate({
      action: TrustedDeviceAdministrativeActions.revokeTrustedDevice,
      context: request.context,
      targetUserIdentityId: existing.value.trustedDevice.userIdentityId,
      targetWorkspaceId: existing.value.trustedDevice.workspaceId,
    });
    if (!decision.allowed) {
      const response = this.adminAuthorizationDeniedResponse<RevokeIdentityAdminTrustedDeviceApiResponse>(
        decision.message ?? "Trusted-device administrative access denied.",
      );
      await this.observability.recordApiOutcome({
        flow: "admin-trusted-device.revoke",
        request,
        response,
      });
      return response;
    }

    const result = await this.dependencies.revokeTrustedDeviceUseCase.execute({
      trustedDeviceId: request.trustedDeviceId,
      reason: request.reason,
      revokedByUserIdentityId: request.context.actorUserIdentityId,
      note: request.note,
      revokedAt: request.revokedAt,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "admin-trusted-device.revoke",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: Object.freeze({
        trustedDeviceId: request.trustedDeviceId,
        revoked: result.value.changed,
      }),
    });
    await this.observability.recordApiOutcome({
      flow: "admin-trusted-device.revoke",
      request,
      response,
    });
    return response;
  }

  public async listTrustedDevices(
    request: ListTrustedDevicesApiRequest,
  ): Promise<IdentityAuthApiResponse<ListTrustedDevicesApiResponse>> {
    const result = await this.dependencies.listTrustedDevicesUseCase.execute({
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      includeStatuses: request.includeStatuses,
      limit: request.limit,
      offset: request.offset,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.list",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeListTrustedDevicesResponse(result.value.devices),
    });
    await this.observability.recordApiOutcome({
      flow: "trusted-device.list",
      request,
      response,
    });
    return response;
  }

  public async getTrustedDevice(
    request: GetTrustedDeviceApiRequest,
  ): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>> {
    const result = await this.dependencies.getTrustedDeviceUseCase.execute({
      trustedDeviceId: request.trustedDeviceId,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.get",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: Object.freeze({
        trustedDevice: serializeTrustedDeviceResponse(result.value.trustedDevice),
      }),
    });
    await this.observability.recordApiOutcome({
      flow: "trusted-device.get",
      request,
      response,
    });
    return response;
  }

  public async revokeTrustedDevice(
    request: RevokeTrustedDeviceApiRequest,
  ): Promise<IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>> {
    const result = await this.dependencies.revokeTrustedDeviceUseCase.execute({
      trustedDeviceId: request.trustedDeviceId,
      reason: request.reason,
      revokedByUserIdentityId: request.revokedByUserIdentityId,
      note: request.note,
      revokedAt: request.revokedAt,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.revoke",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: Object.freeze({
        trustedDeviceId: request.trustedDeviceId,
        revoked: result.value.changed,
      }),
    });
    await this.observability.recordApiOutcome({
      flow: "trusted-device.revoke",
      request,
      response,
    });
    return response;
  }

  public async updateTrustedDeviceDisplayName(
    request: UpdateTrustedDeviceDisplayNameApiRequest,
  ): Promise<IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>> {
    const result = await this.dependencies.updateTrustedDeviceDisplayNameUseCase.execute({
      trustedDeviceId: request.trustedDeviceId,
      displayName: request.displayName,
      updatedAt: request.updatedAt,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.display-name.update",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeUpdateTrustedDeviceDisplayNameResponse(result.value.trustedDevice),
    });
    await this.observability.recordApiOutcome({
      flow: "trusted-device.display-name.update",
      request,
      response,
    });
    return response;
  }

  public async initiateTrustedDevicePairing(
    request: InitiateTrustedDevicePairingApiRequest,
  ): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>> {
    const result = await this.dependencies.initiateTrustedDevicePairingUseCase.execute({
      trustedDeviceId: request.trustedDeviceId,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      artifactType: request.artifactType,
      actorBinding: request.actorBinding,
      issuance: request.issuance,
      maxValidationAttempts: request.maxValidationAttempts,
      expiresAt: request.expiresAt,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.pairing.initiate",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeInitiateTrustedDevicePairingResponse(result.value),
    });
    await this.observability.recordApiOutcome({
      flow: "trusted-device.pairing.initiate",
      request,
      response,
    });
    return response;
  }

  public async validateTrustedDevicePairing(
    request: ValidateTrustedDevicePairingApiRequest,
  ): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>> {
    const result = await this.dependencies.validateTrustedDevicePairingUseCase.execute({
      pairingSessionId: request.pairingSessionId,
      pairingTokenId: request.pairingTokenId,
      trustedDeviceId: request.trustedDeviceId,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      presentedToken: request.presentedToken,
      attemptedAt: request.attemptedAt,
    });
    if (!result.ok) {
      const response = Object.freeze({ ok: false, error: this.mapTrustedDeviceError(result.error.code) });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.pairing.validate",
        request,
        response,
        errorCode: result.error.code,
      });
      return response;
    }

    const response = Object.freeze({
      ok: true,
      data: serializeValidateTrustedDevicePairingResponse(result.value),
    });
    await this.observability.recordApiOutcome({
      flow: "trusted-device.pairing.validate",
      request,
      response,
    });
    return response;
  }

  public async completeTrustedDevicePairing(
    request: CompleteTrustedDevicePairingApiRequest,
  ): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>> {
    try {
      const result = await this.dependencies.completeTrustedDevicePairingUseCase.execute({
        pairingSessionId: request.pairingSessionId,
        pairingTokenId: request.pairingTokenId,
        trustedDeviceId: request.trustedDeviceId,
        userIdentityId: request.userIdentityId,
        workspaceId: request.workspaceId,
        trustedDeviceRegistration: request.trustedDeviceRegistration
          ? Object.freeze({
              displayName: request.trustedDeviceRegistration.displayName,
              fingerprint: Object.freeze({
                algorithm: request.trustedDeviceRegistration.fingerprint.algorithm,
                value: request.trustedDeviceRegistration.fingerprint.value,
                capturedAt: request.trustedDeviceRegistration.fingerprint.capturedAt,
              }),
              pairingMethod: request.trustedDeviceRegistration.pairingMethod,
              metadata: request.trustedDeviceRegistration.metadata,
              registeredAt: request.trustedDeviceRegistration.registeredAt,
            })
          : undefined,
        presentedToken: request.presentedToken,
        completedAt: request.completedAt,
        completedByUserIdentityId: request.completedByUserIdentityId,
        trustMaterialRef: request.trustMaterialRef,
        trustMaterialRegistration: request.trustMaterialRegistration,
      });
      const response = Object.freeze({
        ok: true,
        data: serializeCompleteTrustedDevicePairingResponse(result),
      });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.pairing.complete",
        request,
        response,
      });
      return response;
    } catch (error) {
      const errorCode = mapTrustedDeviceErrorCodeFromException(error);
      const response = Object.freeze({
        ok: false,
        error: this.mapTrustedDeviceError(errorCode),
      });
      await this.observability.recordApiOutcome({
        flow: "trusted-device.pairing.complete",
        request,
        response,
        errorCode,
      });
      return response;
    }
  }

  private mapRegisterError(error: {
    readonly code: RegisterLocalAccountErrorCode;
    readonly message: string;
  }): IdentityAuthApiError {
    switch (error.code) {
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
          message: resolveUserInputInvalidRequestMessage(
            error.message,
            "The registration request is invalid.",
          ),
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

  private mapChangeCredentialError(code: ChangeLocalPasswordCredentialErrorCode): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidCredentials:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: "Invalid credentials.",
        });
      case IdentityErrorCodes.inactiveAccount:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.accountInactive,
          message: "The account is not active for credential changes.",
        });
      case IdentityErrorCodes.unsupportedProvider:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.unsupportedProvider,
          message: "The selected identity provider is not supported for credential change.",
        });
      case IdentityErrorCodes.policyViolation:
      case IdentityErrorCodes.invalidRequest:
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The credential change request is invalid.",
        });
      case IdentityErrorCodes.invalidState:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Credential change is not currently available.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected credential change error.",
        });
    }
  }

  private mapSessionValidationError(error: {
    readonly code: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): IdentityAuthApiError {
    const trustFailure = extractTrustFailure(error.details);

    switch (error.code) {
      case IdentityErrorCodes.invalidRequest:
      case IdentityErrorCodes.invalidSessionState:
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.authenticationFailed,
          message: trustFailure ? "Session trust validation failed." : "Invalid session.",
          trustFailure: trustFailure
            ? Object.freeze({
                reason: trustFailure.reason,
                invalidationReasons: trustFailure.invalidationReasons,
              })
            : undefined,
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

  private mapTrustedDeviceError(
    code:
      | ListTrustedDevicesErrorCode
      | GetTrustedDeviceErrorCode
      | RevokeTrustedDeviceErrorCode
      | UpdateTrustedDeviceDisplayNameErrorCode
      | InitiateTrustedDevicePairingErrorCode
      | ValidateTrustedDevicePairingErrorCode,
  ): IdentityAuthApiError {
    switch (code) {
      case IdentityErrorCodes.invalidRequest:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "The trusted device request is invalid.",
        });
      case IdentityErrorCodes.notFound:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.notFound,
          message: "The requested trusted device or pairing artifact was not found.",
        });
      case IdentityErrorCodes.invalidState:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.conflict,
          message: "The trusted device request conflicts with current device pairing state.",
        });
      default:
        return Object.freeze({
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected trusted device API error.",
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

  private adminAuthorizationDeniedResponse<TResponse>(message: string): IdentityAuthApiResponse<TResponse> {
    return Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.forbidden,
        message,
      },
    });
  }
}

function extractTrustFailure(
  details: Readonly<Record<string, unknown>> | undefined,
): {
  readonly reason?: string;
  readonly invalidationReasons?: ReadonlyArray<IdentitySessionTrustInvalidationReason>;
} | undefined {
  if (!details || details.sessionTrustFailure !== true) {
    return undefined;
  }

  const reason = typeof details.sessionTrustFailureReason === "string" && details.sessionTrustFailureReason.trim()
    ? details.sessionTrustFailureReason.trim()
    : undefined;

  const rawReasons = details.sessionTrustInvalidationReasons;
  const invalidationReasons = Array.isArray(rawReasons)
    ? rawReasons.filter(isIdentitySessionTrustInvalidationReason)
    : [];

  return Object.freeze({
    reason,
    invalidationReasons: invalidationReasons.length > 0 ? Object.freeze([...invalidationReasons]) : undefined,
  });
}

function isIdentitySessionTrustInvalidationReason(value: unknown): value is IdentitySessionTrustInvalidationReason {
  return value === "trusted-device-revoked"
    || value === "trusted-device-trust-lost"
    || value === "trusted-device-expired"
    || value === "trusted-device-mismatch";
}

function mapTrustedDeviceErrorCodeFromException(
  error: unknown,
):
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidState
  | typeof IdentityErrorCodes.notFound {
  if (!(error instanceof Error)) {
    return IdentityErrorCodes.invalidRequest;
  }
  const message = error.message.trim().toLowerCase();
  if (message.includes("not found")) {
    return IdentityErrorCodes.notFound;
  }
  if (message.includes("invalid") || message.includes("already") || message.includes("conflict")) {
    return IdentityErrorCodes.invalidState;
  }
  return IdentityErrorCodes.invalidRequest;
}

function normalizeAccessChannel(value?: "desktop" | "thin-client"): IdentitySessionAccessChannel {
  return value ?? "thin-client";
}

function normalizeSessionTrustRequirement(
  value: LoginLocalIdentityApiRequest["sessionTrustRequirement"],
): IdentitySessionTrustRequirement | undefined {
  switch (value) {
    case IdentitySessionTrustRequirements.allowUntrusted:
    case IdentitySessionTrustRequirements.allowPairing:
    case IdentitySessionTrustRequirements.requireTrusted:
      return value;
    default:
      return undefined;
  }
}

function resolveUserInputInvalidRequestMessage(message: string, fallback: string): string {
  const normalized = message.trim();
  return normalized.length > 0 ? normalized : fallback;
}
