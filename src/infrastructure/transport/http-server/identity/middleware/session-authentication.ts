import type { IncomingMessage } from "node:http";
import type { IdentityAuthBackendApi } from "../../../../api/identity/IdentityAuthBackendApi";
import {
  IdentityAuthApiErrorCodes,
  type AuthenticatedIdentityPrincipalApiResponse,
  type IdentityAuthApiResponse,
  type ResolveAuthenticatedSessionApiResponse,
} from "../../../../api/identity/sdk/PublicIdentityAuthApiContract";

export type SessionAssuranceLevel =
  | "authenticated-untrusted"
  | "authenticated-restricted"
  | "authenticated-trusted";

export interface AuthenticatedSessionActorContext<
  TConnectionState,
  TChannelContext,
  TTrustContext,
> {
  readonly principal: AuthenticatedIdentityPrincipalApiResponse;
  readonly session: ResolveAuthenticatedSessionApiResponse["session"];
  readonly sessionToken: string;
  readonly actor: {
    readonly userIdentityId: string;
    readonly username: string;
  };
  readonly sessionTrust: {
    readonly assuranceLevel: SessionAssuranceLevel;
    readonly isTrusted: boolean;
  };
  readonly transport: {
    readonly connection: TConnectionState;
    readonly channel: TChannelContext;
    readonly trustValidation: TTrustContext;
  };
}

type ResolveAuthenticatedSessionBackendResponse = Awaited<
  ReturnType<IdentityAuthBackendApi["resolveAuthenticatedSession"]>
>;

export type SessionAuthenticationResolution =
  | {
    readonly ok: true;
    readonly sessionToken: string;
    readonly resolvedSession: ResolveAuthenticatedSessionApiResponse;
  }
  | {
    readonly ok: false;
    readonly statusCode: number;
    readonly body: unknown;
    readonly requestLogPayload: Readonly<Record<string, unknown>>;
  };

export function extractBearerSessionToken(authorizationHeader: string | string[] | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!value) {
    return undefined;
  }

  const match = value.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (!match) {
    return undefined;
  }

  const token = match[1]?.trim();
  return token ? token : undefined;
}

export async function resolveAuthenticatedSessionFromRequest(
  request: IncomingMessage,
  backendApi: IdentityAuthBackendApi,
  options: {
    readonly mapStatusCode(response: ResolveAuthenticatedSessionBackendResponse): number;
  },
): Promise<SessionAuthenticationResolution> {
  const sessionToken = extractBearerSessionToken(request.headers.authorization);
  if (!sessionToken) {
    const authFailure: IdentityAuthApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.authenticationFailed,
        message: "Missing Authorization bearer token.",
      },
    });
    return Object.freeze({
      ok: false,
      statusCode: 401,
      body: authFailure,
      requestLogPayload: Object.freeze({}),
    });
  }

  const resolvedSession = await backendApi.resolveAuthenticatedSession({ sessionToken });
  if (!resolvedSession.ok) {
    return Object.freeze({
      ok: false,
      statusCode: options.mapStatusCode(resolvedSession),
      body: resolvedSession,
      requestLogPayload: Object.freeze({ sessionToken }),
    });
  }
  if (!resolvedSession.data) {
    const internalFailure: IdentityAuthApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.internal,
        message: "Session resolution returned no payload.",
      },
    });
    return Object.freeze({
      ok: false,
      statusCode: 500,
      body: internalFailure,
      requestLogPayload: Object.freeze({ sessionToken }),
    });
  }

  return Object.freeze({
    ok: true,
    sessionToken,
    resolvedSession: resolvedSession.data,
  });
}

export function buildAuthenticatedSessionActorContext<
  TConnectionState,
  TChannelContext,
  TTrustContext,
>(
  input: {
    readonly resolvedSession: ResolveAuthenticatedSessionApiResponse;
    readonly sessionToken: string;
    readonly sessionAssuranceLevel: SessionAssuranceLevel;
    readonly transport: {
      readonly connection: TConnectionState;
      readonly channel: TChannelContext;
      readonly trustValidation: TTrustContext;
    };
  },
): AuthenticatedSessionActorContext<TConnectionState, TChannelContext, TTrustContext> {
  return Object.freeze({
    principal: input.resolvedSession.principal,
    session: input.resolvedSession.session,
    sessionToken: input.sessionToken,
    actor: Object.freeze({
      userIdentityId: input.resolvedSession.principal.userIdentityId,
      username: input.resolvedSession.principal.username,
    }),
    sessionTrust: Object.freeze({
      assuranceLevel: input.sessionAssuranceLevel,
      isTrusted: input.sessionAssuranceLevel === "authenticated-trusted",
    }),
    transport: Object.freeze({
      connection: input.transport.connection,
      channel: input.transport.channel,
      trustValidation: input.transport.trustValidation,
    }),
  });
}

export function normalizeSessionAssuranceLevel(
  value: ResolveAuthenticatedSessionApiResponse["session"]["deviceTrustContext"] extends { readonly sessionAssuranceLevel?: infer T } ? T : never,
): SessionAssuranceLevel {
  if (value === "authenticated-trusted" || value === "authenticated-restricted") {
    return value;
  }
  return "authenticated-untrusted";
}

export function isSessionAssuranceAllowed(actual: SessionAssuranceLevel, minimum: SessionAssuranceLevel): boolean {
  const order = Object.freeze({
    "authenticated-untrusted": 1,
    "authenticated-restricted": 2,
    "authenticated-trusted": 3,
  });
  return order[actual] >= order[minimum];
}
