import { ExecutionCallerKinds, type ExecutionAccessContext } from "@application/system-runtime/RuntimeAccessControlService";

export interface RuntimeApiAuthenticationRequest {
  readonly bearerToken?: string;
}

export interface AuthenticatedRuntimePrincipal {
  readonly callerKind: ExecutionAccessContext["callerKind"];
  readonly callerId: string;
  readonly sessionId?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RuntimeApiAuthenticationDecision {
  readonly authenticated: boolean;
  readonly principal?: AuthenticatedRuntimePrincipal;
  readonly reasonCode?: "missing-authentication" | "invalid-authentication";
  readonly message?: string;
}

export interface RuntimeApiAuthenticator {
  authenticate(request?: RuntimeApiAuthenticationRequest): RuntimeApiAuthenticationDecision;
}

export class PermissiveRuntimeApiAuthenticator implements RuntimeApiAuthenticator {
  public authenticate(): RuntimeApiAuthenticationDecision {
    return Object.freeze({ authenticated: false });
  }
}

interface RuntimeApiTokenPrincipal {
  readonly callerKind?: AuthenticatedRuntimePrincipal["callerKind"];
  readonly callerId: string;
  readonly sessionId?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export class StaticTokenRuntimeApiAuthenticator implements RuntimeApiAuthenticator {
  private readonly tokenMap: ReadonlyMap<string, RuntimeApiTokenPrincipal>;

  public constructor(tokenMap: ReadonlyMap<string, RuntimeApiTokenPrincipal> | Readonly<Record<string, RuntimeApiTokenPrincipal>>) {
    this.tokenMap = tokenMap instanceof Map
      ? new Map(tokenMap.entries())
      : new Map(Object.entries(tokenMap));
  }

  public authenticate(request?: RuntimeApiAuthenticationRequest): RuntimeApiAuthenticationDecision {
    const token = normalizeOptional(request?.bearerToken);
    if (!token) {
      return Object.freeze({
        authenticated: false,
        reasonCode: "missing-authentication",
        message: "Runtime API request is missing bearer token authentication.",
      });
    }

    const principal = this.tokenMap.get(token);
    if (!principal) {
      return Object.freeze({
        authenticated: false,
        reasonCode: "invalid-authentication",
        message: "Runtime API bearer token is invalid.",
      });
    }

    const callerId = normalizeOptional(principal.callerId);
    if (!callerId) {
      return Object.freeze({
        authenticated: false,
        reasonCode: "invalid-authentication",
        message: "Runtime API principal is missing a caller identifier.",
      });
    }

    return Object.freeze({
      authenticated: true,
      principal: Object.freeze({
        callerKind: principal.callerKind ?? ExecutionCallerKinds.user,
        callerId,
        sessionId: normalizeOptional(principal.sessionId),
        roles: normalizeStringList(principal.roles),
        metadata: principal.metadata ? Object.freeze({ ...principal.metadata }) : undefined,
      }),
    });
  }
}

