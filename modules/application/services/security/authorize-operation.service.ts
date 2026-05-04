import { createSecurityError, type AuthorizationRequest } from "../../../contracts/security";
import type { AuthorizationPolicyPort } from "../../ports/security";

export class AuthorizeOperationService {
  public constructor(private readonly policy: AuthorizationPolicyPort) {}

  public async execute(request: AuthorizationRequest): Promise<void> {
    const decision = await this.policy.authorize(request);
    if (!decision.allowed) {
      throw createSecurityError("security.forbidden", decision.reason ?? "Forbidden", {
        operation: request.operation,
        missingScopes: decision.missingScopes,
      });
    }
  }
}
