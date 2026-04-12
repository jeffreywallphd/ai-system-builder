import {
  IdentityAuthApiErrorCodes,
  type ChangeLocalPasswordCredentialApiRequest,
  type ChangeLocalPasswordCredentialApiResponse,
  type CompleteTrustedDevicePairingApiRequest,
  type CompleteTrustedDevicePairingApiResponse,
  type DevelopmentLoginIdentityApiRequest,
  type GetIdentityAdminAccountStatusApiRequest,
  type GetIdentityAdminAccountStatusApiResponse,
  type GetTrustedDeviceApiRequest,
  type GetTrustedDeviceApiResponse,
  type IdentityAuthApiResponse,
  type InitiateTrustedDevicePairingApiRequest,
  type InitiateTrustedDevicePairingApiResponse,
  type ListIdentityAdminAccountsApiRequest,
  type ListIdentityAdminAccountsApiResponse,
  type ListIdentityAdminSessionsApiRequest,
  type ListIdentityAdminSessionsApiResponse,
  type ListIdentityAdminTrustedDevicesApiRequest,
  type ListIdentityAdminTrustedDevicesApiResponse,
  type ListIdentitySessionsApiRequest,
  type ListIdentitySessionsApiResponse,
  type ListTrustedDevicesApiRequest,
  type ListTrustedDevicesApiResponse,
  type LoginLocalIdentityApiRequest,
  type LoginLocalIdentityApiResponse,
  type LogoutAuthenticatedSessionApiResponse,
  type RegisterLocalIdentityApiRequest,
  type RegisterLocalIdentityApiResponse,
  type ResolveAuthenticatedSessionApiResponse,
  type RevokeIdentityAdminTrustedDeviceApiRequest,
  type RevokeIdentityAdminTrustedDeviceApiResponse,
  type RevokeIdentityAdminSessionApiRequest,
  type RevokeIdentityAdminSessionApiResponse,
  type RevokeIdentitySessionApiRequest,
  type RevokeIdentitySessionApiResponse,
  type RevokeTrustedDeviceApiRequest,
  type RevokeTrustedDeviceApiResponse,
  type SetIdentityAdminAccountStatusApiRequest,
  type SetIdentityAdminAccountStatusApiResponse,
  type UpdateTrustedDeviceDisplayNameApiRequest,
  type UpdateTrustedDeviceDisplayNameApiResponse,
  type ValidateTrustedDevicePairingApiRequest,
  type ValidateTrustedDevicePairingApiResponse,
} from "../../api/identity/sdk/PublicIdentityAuthApiContract";
import {
  DesktopTrustedDeviceBootstrapFailureReasons,
  resolveDesktopTrustedDeviceTransportBootstrap,
  type DesktopTrustedDeviceTransportBootstrapState,
} from "../../security/DesktopTrustedDeviceTransportBootstrap";
import type {
  ResolveSessionActorContextApiRequest,
  ResolveSessionActorContextApiResponse,
} from "@shared/contracts/identity/IdentityTransportContracts";
import type { IdentityAuthClient, IdentityAuthRequestOptions } from "@ui/shared/identity/IdentityAuthClient";

export class DesktopTrustedDeviceIdentityAuthClient implements IdentityAuthClient {
  public constructor(
    private readonly innerClient: IdentityAuthClient,
    private readonly bootstrapResolver: () => DesktopTrustedDeviceTransportBootstrapState = resolveDesktopTrustedDeviceTransportBootstrap,
  ) {}

  public registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> {
    return this.innerClient.registerLocalAccount(request);
  }

  public loginDevelopmentAccount(
    request?: DevelopmentLoginIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    return this.innerClient.loginDevelopmentAccount(request);
  }

  public async loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    const bootstrap = this.bootstrapResolver();
    if (bootstrap.status === "failed") {
      return trustFailureResponse(bootstrap.reason, bootstrap.userMessage);
    }

    const trustBoundRequest = bootstrap.status === "ready"
      ? Object.freeze({
          ...request,
          sessionTrustRequirement: "require-trusted" as const,
          accessChannel: "desktop" as const,
          client: Object.freeze({
            ...request.client,
            trustedDeviceBindingId: bootstrap.trustedDeviceBindingId,
            trustMarker: bootstrap.trustMarker ?? request.client?.trustMarker,
          }),
        })
      : request;

    const response = await this.innerClient.loginLocalAccount(trustBoundRequest);
    if (!response.ok || !response.data || bootstrap.status !== "ready") {
      return response;
    }

    if (response.data.sessionDeviceTrustContext?.sessionAssuranceLevel !== "authenticated-trusted") {
      await this.innerClient.logoutAuthenticatedSession(response.data.sessionToken).catch(() => undefined);
      return trustFailureResponse(
        DesktopTrustedDeviceBootstrapFailureReasons.sessionAssuranceNotTrusted,
        "Trusted device verification did not complete. Re-pair this desktop client and sign in again.",
      );
    }

    return response;
  }

  public resolveAuthenticatedSession(
    sessionToken: string,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    return this.innerClient.resolveAuthenticatedSession(sessionToken, options);
  }

  public listIdentitySessions(
    request: ListIdentitySessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentitySessionsApiResponse>> {
    return this.innerClient.listIdentitySessions(request, sessionToken);
  }

  public resolveSessionActorContext(
    request: ResolveSessionActorContextApiRequest,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveSessionActorContextApiResponse>> {
    return this.innerClient.resolveSessionActorContext(request, options);
  }

  public logoutAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>> {
    return this.innerClient.logoutAuthenticatedSession(sessionToken);
  }

  public revokeIdentitySession(
    request: RevokeIdentitySessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>> {
    return this.innerClient.revokeIdentitySession(request, sessionToken);
  }

  public listIdentityAdminAccounts(
    request: ListIdentityAdminAccountsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>> {
    return this.innerClient.listIdentityAdminAccounts(request, sessionToken);
  }

  public getIdentityAdminAccountStatus(
    request: GetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>> {
    return this.innerClient.getIdentityAdminAccountStatus(request, sessionToken);
  }

  public setIdentityAdminAccountStatus(
    request: SetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>> {
    return this.innerClient.setIdentityAdminAccountStatus(request, sessionToken);
  }

  public listIdentityAdminSessions(
    request: ListIdentityAdminSessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminSessionsApiResponse>> {
    return this.innerClient.listIdentityAdminSessions(request, sessionToken);
  }

  public revokeIdentityAdminSession(
    request: RevokeIdentityAdminSessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminSessionApiResponse>> {
    return this.innerClient.revokeIdentityAdminSession(request, sessionToken);
  }

  public listIdentityAdminTrustedDevices(
    request: ListIdentityAdminTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>> {
    return this.innerClient.listIdentityAdminTrustedDevices(request, sessionToken);
  }

  public revokeIdentityAdminTrustedDevice(
    request: RevokeIdentityAdminTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>> {
    return this.innerClient.revokeIdentityAdminTrustedDevice(request, sessionToken);
  }

  public changeLocalPasswordCredential(
    request: ChangeLocalPasswordCredentialApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>> {
    return this.innerClient.changeLocalPasswordCredential(request, sessionToken);
  }

  public listTrustedDevices(
    request: ListTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListTrustedDevicesApiResponse>> {
    return this.innerClient.listTrustedDevices(request, sessionToken);
  }

  public getTrustedDevice(
    request: GetTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>> {
    return this.innerClient.getTrustedDevice(request, sessionToken);
  }

  public revokeTrustedDevice(
    request: RevokeTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>> {
    return this.innerClient.revokeTrustedDevice(request, sessionToken);
  }

  public updateTrustedDeviceDisplayName(
    request: UpdateTrustedDeviceDisplayNameApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>> {
    return this.innerClient.updateTrustedDeviceDisplayName(request, sessionToken);
  }

  public initiateTrustedDevicePairing(
    request: InitiateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>> {
    return this.innerClient.initiateTrustedDevicePairing(request, sessionToken);
  }

  public validateTrustedDevicePairing(
    request: ValidateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>> {
    return this.innerClient.validateTrustedDevicePairing(request, sessionToken);
  }

  public completeTrustedDevicePairing(
    request: CompleteTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>> {
    return this.innerClient.completeTrustedDevicePairing(request, sessionToken);
  }
}

function trustFailureResponse(
  reason: string,
  message: string,
): IdentityAuthApiResponse<LoginLocalIdentityApiResponse> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: IdentityAuthApiErrorCodes.authenticationFailed,
      message,
      trustFailure: Object.freeze({
        reason,
      }),
    }),
  });
}

