import { describe, expect, it } from "bun:test";
import { PolicyDecisionOutcomes } from "@domain/authorization/AuthorizationDomain";
import type { AuthorizationPolicyDecision } from "../contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationResponseAccessLevels,
  deriveAuthorizationResponseAccessLevel,
  shapeAuthorizationAwareResponse,
} from "../use-cases/AuthorizationResponseRedaction";

describe("AuthorizationResponseRedaction", () => {
  it("derives full response level for owner and explicit sharing decisions", () => {
    expect(deriveAuthorizationResponseAccessLevel(createAllowedDecision("owner-override"))).toBe(
      AuthorizationResponseAccessLevels.full,
    );
    expect(deriveAuthorizationResponseAccessLevel(createAllowedDecision("matched-sharing-grant"))).toBe(
      AuthorizationResponseAccessLevels.full,
    );
  });

  it("derives partial response level for role and visibility-based access", () => {
    expect(deriveAuthorizationResponseAccessLevel(createAllowedDecision("matched-role-grant"))).toBe(
      AuthorizationResponseAccessLevels.partial,
    );
    expect(deriveAuthorizationResponseAccessLevel(createAllowedDecision("visibility-workspace-member"))).toBe(
      AuthorizationResponseAccessLevels.partial,
    );
  });

  it("returns deny level for denied decisions", () => {
    const denied = Object.freeze({
      ...createAllowedDecision("no-effective-permission"),
      isAllowed: false,
      outcome: PolicyDecisionOutcomes.deny,
      denialReason: "insufficient-permissions",
    } satisfies AuthorizationPolicyDecision);
    expect(deriveAuthorizationResponseAccessLevel(denied)).toBe(AuthorizationResponseAccessLevels.deny);
  });

  it("removes and masks partial fields for redacted responses", () => {
    const response = shapeAuthorizationAwareResponse({
      accessLevel: AuthorizationResponseAccessLevels.partial,
      value: Object.freeze({
        runId: "run:workspace-1",
        executionContext: Object.freeze({
          executionInput: Object.freeze({
            parameters: Object.freeze({
              prompt: "highly sensitive prompt",
            }),
          }),
        }),
        trace: Object.freeze({
          logs: Object.freeze([
            Object.freeze({ message: "secret log line" }),
          ]),
        }),
      }),
      partialRules: Object.freeze([
        Object.freeze({ path: "executionContext.executionInput", mode: "remove" as const }),
        Object.freeze({ path: "trace.logs", mode: "mask" as const }),
      ]),
    });

    expect(response.accessLevel).toBe(AuthorizationResponseAccessLevels.partial);
    const value = response.value as {
      executionContext?: { executionInput?: unknown };
      trace: { logs: unknown };
    };
    expect(value.executionContext?.executionInput).toBeUndefined();
    expect(value.trace.logs).toBe("[REDACTED]");
    expect(response.redactedPaths).toEqual([
      "executionContext.executionInput",
      "trace.logs",
    ]);
  });
});

function createAllowedDecision(reasonCode: string): AuthorizationPolicyDecision {
  return Object.freeze({
    isAllowed: true,
    outcome: PolicyDecisionOutcomes.allow,
    requiredPermissionKey: "run.read",
    reasonCode,
    reason: reasonCode,
    evaluatedAt: "2026-04-05T16:00:00.000Z",
    matchedRoleAssignmentIds: Object.freeze([]),
    matchedPermissionGrantIds: Object.freeze([]),
    matchedSharingGrantIds: Object.freeze([]),
  });
}

