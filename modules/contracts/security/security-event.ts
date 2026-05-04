import type { AuthorizationResource } from "./authorization-decision";

export const SECURITY_EVENT_KINDS = [
  "auth.succeeded",
  "auth.failed",
  "authz.denied",
  "pairing.completed",
  "token.revoked",
  "security.config.resolved",
] as const;

export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number];

export interface SecurityEvent {
  eventId: string;
  kind: SecurityEventKind;
  occurredAt: string;
  principalId?: string;
  operation?: string;
  resource?: AuthorizationResource;
  outcome: "allowed" | "denied" | "success" | "failure";
  details?: Record<string, unknown>;
}
