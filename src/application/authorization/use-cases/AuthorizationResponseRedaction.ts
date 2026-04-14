import type { AuthorizationPolicyDecision } from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationDecisionReasonCodes } from "@shared/contracts/authorization/AuthorizationDiagnosticCatalogs";

export const AuthorizationResponseAccessLevels = Object.freeze({
  deny: "deny",
  partial: "partial",
  full: "full",
});

export type AuthorizationResponseAccessLevel =
  typeof AuthorizationResponseAccessLevels[keyof typeof AuthorizationResponseAccessLevels];

export interface AuthorizationResponseRedactionRule {
  readonly path: string;
  readonly mode?: "remove" | "mask";
  readonly maskValue?: unknown;
}

export interface AuthorizationAwareResponse<TValue> {
  readonly accessLevel: AuthorizationResponseAccessLevel;
  readonly value?: TValue;
  readonly redactedPaths?: ReadonlyArray<string>;
}

const FullAccessReasonCodes = new Set([
  AuthorizationDecisionReasonCodes.ownerOverride,
  AuthorizationDecisionReasonCodes.matchedSharingGrant,
  AuthorizationDecisionReasonCodes.matchedPermissionGrant,
]);

const PartialAccessReasonCodes = new Set([
  AuthorizationDecisionReasonCodes.matchedRoleGrant,
  AuthorizationDecisionReasonCodes.visibilityWorkspaceMember,
  AuthorizationDecisionReasonCodes.visibilityPublished,
]);

const DefaultMaskValue = "[REDACTED]";

export function deriveAuthorizationResponseAccessLevel(
  decision: AuthorizationPolicyDecision | undefined,
): AuthorizationResponseAccessLevel {
  if (!decision?.isAllowed) {
    return AuthorizationResponseAccessLevels.deny;
  }

  if (FullAccessReasonCodes.has(decision.reasonCode)) {
    return AuthorizationResponseAccessLevels.full;
  }

  if (PartialAccessReasonCodes.has(decision.reasonCode)) {
    return AuthorizationResponseAccessLevels.partial;
  }

  return AuthorizationResponseAccessLevels.partial;
}

export function shapeAuthorizationAwareResponse<TValue>(input: {
  readonly accessLevel: AuthorizationResponseAccessLevel;
  readonly value: TValue;
  readonly partialRules?: ReadonlyArray<AuthorizationResponseRedactionRule>;
}): AuthorizationAwareResponse<TValue> {
  if (input.accessLevel === AuthorizationResponseAccessLevels.deny) {
    return Object.freeze({
      accessLevel: AuthorizationResponseAccessLevels.deny,
    });
  }

  if (
    input.accessLevel === AuthorizationResponseAccessLevels.full
    || !input.partialRules
    || input.partialRules.length === 0
  ) {
    return Object.freeze({
      accessLevel: input.accessLevel,
      value: input.value,
      redactedPaths: Object.freeze([]),
    });
  }

  const mutable = cloneForRedaction(input.value) as Record<string, unknown>;
  const redactedPaths: string[] = [];
  for (const rule of input.partialRules) {
    if (applyRuleAtPath(mutable, rule)) {
      redactedPaths.push(rule.path);
    }
  }

  return Object.freeze({
    accessLevel: input.accessLevel,
    value: deepFreeze(mutable) as TValue,
    redactedPaths: Object.freeze(redactedPaths),
  });
}

function applyRuleAtPath(root: Record<string, unknown>, rule: AuthorizationResponseRedactionRule): boolean {
  const segments = rule.path
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return false;
  }

  let cursor: unknown = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!cursor || typeof cursor !== "object") {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[segments[index]];
  }
  if (!cursor || typeof cursor !== "object") {
    return false;
  }

  const container = cursor as Record<string, unknown>;
  const key = segments[segments.length - 1];
  if (!(key in container)) {
    return false;
  }

  if ((rule.mode ?? "remove") === "mask") {
    container[key] = rule.maskValue ?? DefaultMaskValue;
    return true;
  }

  delete container[key];
  return true;
}

function cloneForRedaction<TValue>(value: TValue): TValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cloneForRedaction(entry)) as TValue;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = cloneForRedaction(nested);
  }
  return output as TValue;
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}
