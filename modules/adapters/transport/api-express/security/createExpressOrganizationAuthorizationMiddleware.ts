import type { NextFunction, Request, Response } from "express";

import type { AuthorizeOperationService } from "../../../../application/services/security";
import { getExpressAuthContext } from "./expressAuthContext";
import { getExpressOrganizationContext } from "./expressOrganizationContext";
import { createSecurityApiFailure, mapSecurityFailure } from "./createSecurityApiFailure";
import { resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";

/** Managed-host membership gate. Resource-specific policy remains in protected use cases. */
export function createExpressOrganizationAuthorizationMiddleware(deps: {
  authorizer: AuthorizeOperationService;
}) {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (resolveApiRoutePolicy(request.method, request.path).public) return next();
    const authContext = getExpressAuthContext(request);
    const organizationContext = getExpressOrganizationContext(request);
    if (!authContext || !organizationContext) {
      return response.status(403).json(createSecurityApiFailure({
        status: 403,
        code: "security.forbidden",
        message: "Forbidden.",
      }));
    }
    try {
      await deps.authorizer.execute({
        authContext,
        organizationId: organizationContext.organizationId,
        requestId: organizationContext.requestId,
        correlationId: organizationContext.correlationId,
        operation: `api.${request.method.toLowerCase()}`,
        requiredScopes: [],
      });
      return next();
    } catch (error) {
      const mapped = mapSecurityFailure(error);
      return response.status(mapped.status).json(createSecurityApiFailure(mapped));
    }
  };
}
