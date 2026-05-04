import type { NextFunction, Request, Response } from "express";
import { ANONYMOUS_AUTH_CONTEXT, type AuthContext } from "../../../../contracts/security";
import { resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";
import { setExpressAuthContext } from "./expressAuthContext";
import { createSecurityApiFailure, mapSecurityFailure } from "./createSecurityApiFailure";
import { extractBearerToken } from "./extractExpressSecurityInput";

export function createExpressSecurityMiddleware(deps: { verifyToken: (req: { token: string; now: Date }) => Promise<AuthContext>; httpsRequired: boolean; authRequired: boolean }) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const policy = resolveApiRoutePolicy(request.method, request.path);
    setExpressAuthContext(request, ANONYMOUS_AUTH_CONTEXT);

    if (deps.httpsRequired && request.protocol !== "https") {
      return response.status(400).json(createSecurityApiFailure({ status: 400, code: "security.https-required", message: "HTTPS is required." }));
    }
    if (policy.deny) {
      return response.status(403).json(createSecurityApiFailure({ status: 403, code: policy.securityCode ?? "security.route-policy-missing", message: "Route policy missing." }));
    }
    const token = extractBearerToken(request.headers.authorization);
    if (policy.public) {
      if (!token) return next();
      try {
        const context = await deps.verifyToken({ token, now: new Date() });
        setExpressAuthContext(request, context);
        return next();
      } catch (error) {
        const mapped = mapSecurityFailure(error);
        return response.status(mapped.status).json(createSecurityApiFailure(mapped));
      }
    }

    if (!token) {
      if (!deps.authRequired) return next();
      return response.status(401).json(createSecurityApiFailure({ status: 401, code: "security.unauthenticated", message: "Missing bearer token." }));
    }

    try {
      const context = await deps.verifyToken({ token, now: new Date() });
      setExpressAuthContext(request, context);
      if (policy.scopes?.some((scope) => !context.principal.scopes.includes(scope as AuthContext["principal"]["scopes"][number]))) {
        return response.status(403).json(createSecurityApiFailure({ status: 403, code: "security.forbidden", message: "Forbidden." }));
      }
      return next();
    } catch (error) {
      const mapped = mapSecurityFailure(error);
      return response.status(mapped.status).json(createSecurityApiFailure(mapped));
    }
  };
}
