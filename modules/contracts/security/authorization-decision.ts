import type { AuthContext } from "./auth-context";
import type { SecurityScope } from "./auth-scope";

export interface AuthorizationResource {
  kind: string;
  id?: string;
}

export interface AuthorizationRequest {
  authContext: AuthContext;
  operation: string;
  requiredScopes: SecurityScope[];
  resource?: AuthorizationResource;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
  missingScopes?: SecurityScope[];
}
