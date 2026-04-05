import { describe, expect, it } from "bun:test";
import type {
  ChangeLocalPasswordCredentialApiRequest,
  ChangeLocalPasswordCredentialApiResponse,
  CompleteTrustedDevicePairingApiRequest,
  CompleteTrustedDevicePairingApiResponse,
  GetIdentityAdminAccountStatusApiRequest,
  GetIdentityAdminAccountStatusApiResponse,
  GetTrustedDeviceApiRequest,
  GetTrustedDeviceApiResponse,
  IdentityAuthApiResponse,
  InitiateTrustedDevicePairingApiRequest,
  InitiateTrustedDevicePairingApiResponse,
  ListIdentityAdminAccountsApiRequest,
  ListIdentityAdminAccountsApiResponse,
  ListIdentityAdminTrustedDevicesApiRequest,
  ListIdentityAdminTrustedDevicesApiResponse,
  ListTrustedDevicesApiRequest,
  ListTrustedDevicesApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
  ResolveAuthenticatedSessionApiResponse,
  RevokeIdentityAdminTrustedDeviceApiRequest,
  RevokeIdentityAdminTrustedDeviceApiResponse,
  RevokeIdentitySessionApiRequest,
  RevokeIdentitySessionApiResponse,
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
  SetIdentityAdminAccountStatusApiRequest,
  SetIdentityAdminAccountStatusApiResponse,
  UpdateTrustedDeviceDisplayNameApiRequest,
  UpdateTrustedDeviceDisplayNameApiResponse,
  ValidateTrustedDevicePairingApiRequest,
  ValidateTrustedDevicePairingApiResponse,
} from "../../../api/identity/sdk/PublicIdentityAuthApiContract";
import {
  DesktopTrustedDeviceBootstrapFailureReasons,
} from "../../../security/DesktopTrustedDeviceTransportBootstrap";
import { DesktopTrustedDeviceIdentityAuthClient } from "../DesktopTrustedDeviceIdentityAuthClient";
import type { IdentityAuthClient } from "../../../../ui/shared/identity/IdentityAuthClient";

describe("DesktopTrustedDeviceIdentityAuthClient", () => {
  it("blocks login when trusted-device bootstrap fails", async () => {
    const inner = createStubClient();
    const client = new DesktopTrustedDeviceIdentityAuthClient(
      inner.client,
      () => Object.freeze({
        status: "failed",
        reason: DesktopTrustedDeviceBootstrapFailureReasons.registrationMissing,
        userMessage: "missing registration",
      }),
    );

    const response = await client.loginLocalAccount({
      providerSubject: "alice",
      credential: { candidate: "pw" },
    });
    expect(response.ok).toBeFalse();
    expect(response.error?.trustFailure?.reason).toBe("registration-missing");
    expect(inner.loginRequests.length).toBe(0);
  });

  it("injects trusted-device bootstrap context into desktop login requests", async () => {
    const inner = createStubClient({
      loginResponse: {
        ok: true,
        data: {
          userIdentityId: "user-1",
          username: "alice",
          providerId: "provider:local-password",
          providerSubject: "alice",
          authPath: "password",
          authenticatedAt: "2026-04-05T12:00:00.000Z",
          sessionId: "session-1",
          sessionToken: "token-1",
          sessionTokenType: "Bearer",
          sessionIssuedAt: "2026-04-05T12:00:00.000Z",
          sessionExpiresAt: "2026-04-05T13:00:00.000Z",
          sessionDeviceTrustContext: {
            sessionAssuranceLevel: "authenticated-trusted",
          },
        },
      },
    });
    const client = new DesktopTrustedDeviceIdentityAuthClient(
      inner.client,
      () => Object.freeze({
        status: "ready",
        trustedDeviceBindingId: "trusted-device:alpha",
        trustMarker: "marker:alpha",
        pinnedTrustMaterial: {
          pinReference: "pin:alpha",
          materialKind: "session-signing-key",
        },
      }),
    );

    const response = await client.loginLocalAccount({
      providerSubject: "alice",
      credential: { candidate: "pw" },
    });
    expect(response.ok).toBeTrue();
    expect(inner.loginRequests[0]?.sessionTrustRequirement).toBe("require-trusted");
    expect(inner.loginRequests[0]?.accessChannel).toBe("desktop");
    expect(inner.loginRequests[0]?.client?.trustedDeviceBindingId).toBe("trusted-device:alpha");
  });

  it("invalidates successful login when session trust is not trusted", async () => {
    const inner = createStubClient({
      loginResponse: {
        ok: true,
        data: {
          userIdentityId: "user-1",
          username: "alice",
          providerId: "provider:local-password",
          providerSubject: "alice",
          authPath: "password",
          authenticatedAt: "2026-04-05T12:00:00.000Z",
          sessionId: "session-1",
          sessionToken: "token-1",
          sessionTokenType: "Bearer",
          sessionIssuedAt: "2026-04-05T12:00:00.000Z",
          sessionExpiresAt: "2026-04-05T13:00:00.000Z",
          sessionDeviceTrustContext: {
            sessionAssuranceLevel: "authenticated-restricted",
          },
        },
      },
      logoutResponse: { ok: true, data: { sessionId: "session-1", userIdentityId: "user-1", revokedAt: "2026-04-05T12:00:01.000Z", revocationReason: "logout" } },
    });
    const client = new DesktopTrustedDeviceIdentityAuthClient(
      inner.client,
      () => Object.freeze({
        status: "ready",
        trustedDeviceBindingId: "trusted-device:alpha",
        pinnedTrustMaterial: {
          pinReference: "pin:alpha",
          materialKind: "session-signing-key",
        },
      }),
    );

    const response = await client.loginLocalAccount({
      providerSubject: "alice",
      credential: { candidate: "pw" },
    });
    expect(response.ok).toBeFalse();
    expect(response.error?.trustFailure?.reason).toBe("session-assurance-not-trusted");
    expect(inner.logoutTokens).toEqual(["token-1"]);
  });

  it("passes through for non-required desktop trust bootstrap", async () => {
    const inner = createStubClient({
      loginResponse: {
        ok: false,
        error: {
          code: "authentication-failed",
          message: "bad credentials",
        },
      },
    });
    const client = new DesktopTrustedDeviceIdentityAuthClient(
      inner.client,
      () => Object.freeze({ status: "not-required" }),
    );

    const response = await client.loginLocalAccount({
      providerSubject: "alice",
      credential: { candidate: "pw" },
    });
    expect(response.error?.message).toBe("bad credentials");
    expect(inner.loginRequests.length).toBe(1);
  });
});

function createStubClient(overrides: {
  readonly loginResponse?: IdentityAuthApiResponse<LoginLocalIdentityApiResponse>;
  readonly logoutResponse?: IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>;
} = {}) {
  const loginRequests: LoginLocalIdentityApiRequest[] = [];
  const logoutTokens: string[] = [];

  const defaultLoginResponse: IdentityAuthApiResponse<LoginLocalIdentityApiResponse> = {
    ok: false,
    error: {
      code: "internal",
      message: "not configured",
    },
  };
  const defaultLogoutResponse: IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse> = {
    ok: true,
    data: {
      sessionId: "session-default",
      userIdentityId: "user-default",
      revokedAt: "2026-04-05T12:00:00.000Z",
      revocationReason: "logout",
    },
  };

  const client: IdentityAuthClient = {
    registerLocalAccount: async (_request: RegisterLocalIdentityApiRequest): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    loginLocalAccount: async (request: LoginLocalIdentityApiRequest): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> => {
      loginRequests.push(request);
      return overrides.loginResponse ?? defaultLoginResponse;
    },
    resolveAuthenticatedSession: async (_sessionToken: string): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    logoutAuthenticatedSession: async (sessionToken: string): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>> => {
      logoutTokens.push(sessionToken);
      return overrides.logoutResponse ?? defaultLogoutResponse;
    },
    revokeIdentitySession: async (_request: RevokeIdentitySessionApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    listIdentityAdminAccounts: async (_request: ListIdentityAdminAccountsApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    getIdentityAdminAccountStatus: async (_request: GetIdentityAdminAccountStatusApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    setIdentityAdminAccountStatus: async (_request: SetIdentityAdminAccountStatusApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    listIdentityAdminTrustedDevices: async (_request: ListIdentityAdminTrustedDevicesApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    revokeIdentityAdminTrustedDevice: async (_request: RevokeIdentityAdminTrustedDeviceApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    changeLocalPasswordCredential: async (_request: ChangeLocalPasswordCredentialApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    listTrustedDevices: async (_request: ListTrustedDevicesApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<ListTrustedDevicesApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    getTrustedDevice: async (_request: GetTrustedDeviceApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    revokeTrustedDevice: async (_request: RevokeTrustedDeviceApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    updateTrustedDeviceDisplayName: async (_request: UpdateTrustedDeviceDisplayNameApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    initiateTrustedDevicePairing: async (_request: InitiateTrustedDevicePairingApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    validateTrustedDevicePairing: async (_request: ValidateTrustedDevicePairingApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
    completeTrustedDevicePairing: async (_request: CompleteTrustedDevicePairingApiRequest, _sessionToken: string): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>> => ({ ok: false, error: { code: "internal", message: "not implemented" } }),
  };

  return { client, loginRequests, logoutTokens };
}
