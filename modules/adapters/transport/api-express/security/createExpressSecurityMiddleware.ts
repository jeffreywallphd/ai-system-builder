import type { NextFunction, Request, Response } from "express";
import { createApiError, createApiFailureResponse } from "../../../../contracts/api";
import { ANONYMOUS_AUTH_CONTEXT, type AuthContext, SecurityApplicationError } from "../../../../contracts/security";
import { resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";
import { setExpressAuthContext } from "./expressAuthContext";
import { extractBearerToken } from "./extractExpressSecurityInput";

function mapSecurityError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof SecurityApplicationError) {
    const status = error.code === "security.forbidden" ? 403 : 401;
    return { status, code: error.code, message: error.message };
  }
  return { status: 500, code: "security.internal", message: "Security middleware failed." };
}

export function createExpressSecurityMiddleware(deps: { verifyToken: (req: { token: string; now: Date }) => Promise<AuthContext>; httpsRequired: boolean; authRequired: boolean }) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const policy = resolveApiRoutePolicy(request.method, request.path);
    setExpressAuthContext(request, ANONYMOUS_AUTH_CONTEXT);

    if (deps.httpsRequired && request.protocol !== "https") {
      return response.status(400).json(createApiFailureResponse(createApiError("security.transport", "validation", "HTTPS is required.", { details: { securityCode: "security.https-required" } })));
    }
    if (policy.deny) {
      return response.status(403).json(createApiFailureResponse(createApiError("security.authz", "forbidden", "Route policy missing.", { details: { securityCode: policy.securityCode ?? "security.forbidden" } })));
    }
    if (policy.public) return next();

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      if (!deps.authRequired) return next();
      return response.status(401).json(createApiFailureResponse(createApiError("security.auth", "unauthorized", "Missing bearer token.", { details: { securityCode: "security.unauthenticated" } })));
    }

    try {
      const context = await deps.verifyToken({ token, now: new Date() });
      setExpressAuthContext(request, context);
      if (policy.scopes?.some((scope) => !context.principal.scopes.includes(scope as AuthContext["principal"]["scopes"][number]))) {
        return response.status(403).json(createApiFailureResponse(createApiError("security.authz", "forbidden", "Forbidden.", { details: { securityCode: "security.forbidden" } })));
      }
      return next();
    } catch (error) {
      const mapped = mapSecurityError(error);
      return response.status(mapped.status).json(createApiFailureResponse(createApiError("security.auth", "unauthorized", mapped.message, { details: { securityCode: mapped.code } })));
    }
  };
}
