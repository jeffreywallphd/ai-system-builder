import type { Request, Response, NextFunction } from "express";
import { createApiError, createApiFailureResponse } from "../../../../contracts/api";
import { createAnonymousAuthContext } from "../../../../contracts/security";
import { extractBearerToken } from "./extractExpressSecurityInput";
import { resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";

export function createExpressSecurityMiddleware(deps: { verifyToken: (req: { token: string; now: Date }) => Promise<any>; httpsRequired: boolean }) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const policy = resolveApiRoutePolicy(request.method, request.path);
    (request as any).authContext = createAnonymousAuthContext();
    if (deps.httpsRequired && request.protocol !== "https") {
      return response.status(400).json(createApiFailureResponse(createApiError("security.transport", "validation", "HTTPS is required.")));
    }
    if (policy.public) return next();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) return response.status(401).json(createApiFailureResponse(createApiError("security.auth", "validation", "Missing bearer token.")));
    const context = await deps.verifyToken({ token, now: new Date() });
    (request as any).authContext = context;
    if (!context.authenticated) return response.status(401).json(createApiFailureResponse(createApiError("security.auth", "validation", "Invalid token.")));
    if (policy.scopes?.some((scope) => !context.principal.scopes.includes(scope))) {
      return response.status(403).json(createApiFailureResponse(createApiError("security.authz", "validation", "Forbidden.")));
    }
    next();
  };
}
