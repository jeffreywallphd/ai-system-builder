import { describe, expect, it } from "bun:test";
import { EffectivePermissionResolutionService } from "@application/authorization/use-cases/EffectivePermissionResolutionService";
import { AuthorizationPolicyDecisionDenialReasons } from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import {
  InvariantAdapterRegistry,
  InvariantFeatureFamilies,
  buildAuthorizationBaselineScenarioBuilders,
  executeAndAssertInvariantScenario,
  validateAuthorizationBaselineScenario,
  type InvariantEvaluationRequest,
  type AuthorizationInvariantBaselineInput,
  type InvariantFamilyAdapter,
  type InvariantObservedResult,
} from "../index";

class AuthorizationBaselineInvariantAdapter implements InvariantFamilyAdapter<AuthorizationInvariantBaselineInput> {
  public readonly family = InvariantFeatureFamilies.asset;
  private readonly resolver = new EffectivePermissionResolutionService({
    clock: {
      now: () => new Date("2026-04-13T00:00:00.000Z"),
    },
  });

  public async evaluate(
    request: InvariantEvaluationRequest<AuthorizationInvariantBaselineInput>,
  ): Promise<InvariantObservedResult> {
    const input = request.scenario.input;
    if (!input) {
      throw new Error(`Scenario '${request.scenario.scenarioId}' must include authorization baseline input.`);
    }

    const resolution = this.resolver.resolvePermission({
      actor: input.actorContext,
      resource: input.resourceContext,
      requiredPermissionKey: input.requiredPermissionKey,
      asOf: input.asOf,
    });

    const scopeKind = input.resourceContext.workspaceId ? "workspace" : "resource";
    const denialReason = resolution.decision.outcome === "deny"
      ? (resolution.decision.reasonCode === "explicit-deny-permission-grant"
          ? AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant
          : AuthorizationPolicyDecisionDenialReasons.insufficientPermissions)
      : undefined;

    return Object.freeze({
      outcome: resolution.decision.outcome === "allow" ? "allow" : "deny",
      decision: Object.freeze({
        reasonCode: resolution.decision.reasonCode,
        denialReason,
        sourceKind: resolution.sourceKind,
        targetKind: request.scenario.target.targetKind,
        requiredPermissionKey: resolution.decision.requiredPermissionKey,
        scope: Object.freeze({
          isApplicable: true,
          scopeKind,
          workspaceId: input.resourceContext.workspaceId,
          resourceFamily: request.scenario.target.resourceFamily,
          resourceType: input.resourceContext.resourceType,
          resourceId: input.resourceContext.resourceId,
        }),
        matchedRoleAssignmentIds: resolution.decision.matchedRoleAssignmentIds,
        matchedPermissionGrantIds: resolution.decision.matchedPermissionGrantIds,
        matchedSharingGrantIds: resolution.decision.matchedSharingGrantIds,
      }),
      runtime: Object.freeze({
        statusCode: resolution.decision.outcome === "allow" ? "ok" : "forbidden",
      }),
    });
  }
}

describe("Authorization baseline scenario builders", () => {
  it("publishes all requested baseline categories", () => {
    const builders = buildAuthorizationBaselineScenarioBuilders();
    const scenarioIds = builders.all.map((scenario) => scenario.scenarioId);
    expect(scenarioIds).toEqual(expect.arrayContaining([
      "authorization-baseline-persisted-role-assignment-applicable",
      "authorization-baseline-synthesized-workspace-role-fallback",
      "authorization-baseline-scope-mismatch-prevents-applicability",
      "authorization-baseline-explicit-deny-remains-deny",
      "authorization-baseline-visibility-read-allowed",
      "authorization-baseline-visibility-create-denied",
      "authorization-baseline-no-applicable-permission-path",
    ]));
  });

  it("validates scenario-builder assumptions for explicit inputs and expected match references", () => {
    const builders = buildAuthorizationBaselineScenarioBuilders();
    const validationIssues = builders.all.flatMap((scenario) => validateAuthorizationBaselineScenario(scenario));
    expect(validationIssues).toEqual([]);
  });

  it("executes all baseline scenarios against real permission-resolution semantics", async () => {
    const registry = new InvariantAdapterRegistry().register(new AuthorizationBaselineInvariantAdapter());
    const builders = buildAuthorizationBaselineScenarioBuilders();

    for (const scenario of builders.all) {
      const execution = await executeAndAssertInvariantScenario(registry, {
        scenario,
      });
      expect(execution.observed.decision?.reasonCode).toBe(scenario.expectation.decision?.reasonCode);
    }
  });
});
