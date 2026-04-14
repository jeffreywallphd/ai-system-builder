import type {
  InvariantExecutionResult,
  InvariantExpectedDecisionScope,
  InvariantExpectedDecisionMetadata,
  InvariantExpectedRuntimeMetadata,
  InvariantObservedDecisionScope,
  InvariantObservedDecisionMetadata,
  InvariantObservedRuntimeMetadata,
  InvariantScenarioDefinition,
} from "./contracts";

function summarizeScenario(scenario: InvariantScenarioDefinition): string {
  return `scenarioId='${scenario.scenarioId}', title='${scenario.title}', family='${scenario.family}', capability='${scenario.capability}'`;
}

function summarizeObservedDecision(
  decision: InvariantObservedDecisionMetadata | undefined,
): string {
  if (!decision) {
    return "decision=<undefined>";
  }

  return [
    `reasonCode='${String(decision.reasonCode)}'`,
    `denialReason='${String(decision.denialReason)}'`,
    `sourceKind='${String(decision.sourceKind)}'`,
    `targetKind='${String(decision.targetKind)}'`,
    `requiredPermissionKey='${String(decision.requiredPermissionKey)}'`,
    `scope=${JSON.stringify(decision.scope ?? null)}`,
    `matchedRoleAssignmentIds=${JSON.stringify(decision.matchedRoleAssignmentIds ?? [])}`,
    `matchedPermissionGrantIds=${JSON.stringify(decision.matchedPermissionGrantIds ?? [])}`,
    `matchedSharingGrantIds=${JSON.stringify(decision.matchedSharingGrantIds ?? [])}`,
    `unmatchedRoleAssignmentIds=${JSON.stringify(decision.unmatchedRoleAssignmentIds ?? [])}`,
    `unmatchedPermissionGrantIds=${JSON.stringify(decision.unmatchedPermissionGrantIds ?? [])}`,
    `unmatchedSharingGrantIds=${JSON.stringify(decision.unmatchedSharingGrantIds ?? [])}`,
    `provenance=${JSON.stringify(decision.provenance ?? {})}`,
  ].join(", ");
}

function resolveDecisionTargetKind(
  observed: InvariantObservedDecisionMetadata | undefined,
  scenario: InvariantScenarioDefinition,
): string | undefined {
  return observed?.targetKind ?? scenario.target.targetKind;
}

function resolveDecisionScope(
  observed: InvariantObservedDecisionMetadata | undefined,
  scenario: InvariantScenarioDefinition,
): InvariantObservedDecisionScope | undefined {
  if (observed?.scope) {
    return observed.scope;
  }

  const workspaceId = scenario.target.targetWorkspaceId
    ?? scenario.target.workspaceId
    ?? scenario.resource?.workspaceId
    ?? scenario.workspace.workspaceId;
  const isCapabilityTarget = scenario.target.targetKind === "capability";
  const scopeKind = isCapabilityTarget ? "workspace-capability" : (workspaceId ? "workspace" : "resource");

  return Object.freeze({
    isApplicable: true,
    scopeKind,
    workspaceId,
    resourceFamily: scenario.target.resourceFamily,
    resourceType: scenario.target.resourceType,
    resourceId: scenario.target.resourceId,
  });
}

function assertExact(
  expectedValue: string | boolean | undefined,
  observedValue: string | boolean | undefined,
  field: string,
  scenario: InvariantScenarioDefinition,
  decision: InvariantObservedDecisionMetadata | undefined,
): void {
  if (expectedValue === undefined) {
    return;
  }

  if (observedValue !== expectedValue) {
    throw new Error(
      `${scenario.scenarioId}: expected ${field}='${String(expectedValue)}' but observed '${String(observedValue)}'. `
      + `Context: ${summarizeScenario(scenario)}. Observed decision: ${summarizeObservedDecision(decision)}`,
    );
  }
}

function assertPartialArray(
  expected: ReadonlyArray<string> | undefined,
  observed: ReadonlyArray<string> | undefined,
  field: string,
  scenario: InvariantScenarioDefinition,
  decision: InvariantObservedDecisionMetadata | undefined,
): void {
  if (!expected) {
    return;
  }
  if (!observed) {
    throw new Error(
      `${scenario.scenarioId}: expected observed '${field}' array but it was undefined. `
      + `Context: ${summarizeScenario(scenario)}. Observed decision: ${summarizeObservedDecision(decision)}`,
    );
  }
  const missing = expected.filter((value) => !observed.includes(value));
  if (missing.length > 0) {
    throw new Error(
      `${scenario.scenarioId}: observed '${field}' is missing expected values [${missing.join(", ")}]. `
      + `Observed values: [${observed.join(", ")}]. Context: ${summarizeScenario(scenario)}.`,
    );
  }
}

function assertExcludedArrayValues(
  disallowedValues: ReadonlyArray<string> | undefined,
  observed: ReadonlyArray<string> | undefined,
  field: string,
  scenario: InvariantScenarioDefinition,
  decision: InvariantObservedDecisionMetadata | undefined,
): void {
  if (!disallowedValues || disallowedValues.length === 0) {
    return;
  }

  const observedValues = observed ?? [];
  const unexpectedValues = disallowedValues.filter((value) => observedValues.includes(value));
  if (unexpectedValues.length > 0) {
    throw new Error(
      `${scenario.scenarioId}: observed '${field}' unexpectedly contains disallowed values [${unexpectedValues.join(", ")}]. `
      + `Observed values: [${observedValues.join(", ")}]. Context: ${summarizeScenario(scenario)}. `
      + `Observed decision: ${summarizeObservedDecision(decision)}`,
    );
  }
}

function assertDecisionScope(
  expected: InvariantExpectedDecisionScope | undefined,
  observed: InvariantObservedDecisionScope | undefined,
  scenario: InvariantScenarioDefinition,
  decision: InvariantObservedDecisionMetadata | undefined,
): void {
  if (!expected) {
    return;
  }
  if (!observed) {
    throw new Error(
      `${scenario.scenarioId}: expected decision scope metadata but no scope information was available. `
      + `Context: ${summarizeScenario(scenario)}. Observed decision: ${summarizeObservedDecision(decision)}`,
    );
  }

  assertExact(expected.isApplicable, observed.isApplicable, "decision.scope.isApplicable", scenario, decision);
  assertExact(expected.scopeKind, observed.scopeKind, "decision.scope.scopeKind", scenario, decision);
  assertExact(expected.workspaceId, observed.workspaceId, "decision.scope.workspaceId", scenario, decision);
  assertExact(expected.resourceFamily, observed.resourceFamily, "decision.scope.resourceFamily", scenario, decision);
  assertExact(expected.resourceType, observed.resourceType, "decision.scope.resourceType", scenario, decision);
  assertExact(expected.resourceId, observed.resourceId, "decision.scope.resourceId", scenario, decision);
}

function assertDecisionMetadata(
  expected: InvariantExpectedDecisionMetadata | undefined,
  observed: InvariantObservedDecisionMetadata | undefined,
  scenario: InvariantScenarioDefinition,
): void {
  if (!expected) {
    return;
  }
  if (!observed) {
    throw new Error(
      `${scenario.scenarioId}: expected decision metadata but observed decision metadata is undefined. `
      + `Context: ${summarizeScenario(scenario)}.`,
    );
  }

  assertExact(expected.reasonCode, observed.reasonCode, "decision.reasonCode", scenario, observed);
  assertExact(expected.denialReason, observed.denialReason, "decision.denialReason", scenario, observed);
  assertExact(expected.sourceKind, observed.sourceKind, "decision.sourceKind", scenario, observed);
  assertExact(
    expected.targetKind,
    resolveDecisionTargetKind(observed, scenario),
    "decision.targetKind",
    scenario,
    observed,
  );
  assertExact(
    expected.requiredPermissionKey,
    observed.requiredPermissionKey,
    "decision.requiredPermissionKey",
    scenario,
    observed,
  );

  assertDecisionScope(expected.scope, resolveDecisionScope(observed, scenario), scenario, observed);
  assertPartialArray(
    expected.matchedRoleAssignmentIds,
    observed.matchedRoleAssignmentIds,
    "matchedRoleAssignmentIds",
    scenario,
    observed,
  );
  assertExcludedArrayValues(
    expected.unmatchedRoleAssignmentIds,
    observed.matchedRoleAssignmentIds,
    "matchedRoleAssignmentIds",
    scenario,
    observed,
  );
  assertPartialArray(
    expected.matchedPermissionGrantIds,
    observed.matchedPermissionGrantIds,
    "matchedPermissionGrantIds",
    scenario,
    observed,
  );
  assertExcludedArrayValues(
    expected.unmatchedPermissionGrantIds,
    observed.matchedPermissionGrantIds,
    "matchedPermissionGrantIds",
    scenario,
    observed,
  );
  assertPartialArray(
    expected.matchedSharingGrantIds,
    observed.matchedSharingGrantIds,
    "matchedSharingGrantIds",
    scenario,
    observed,
  );
  assertExcludedArrayValues(
    expected.unmatchedSharingGrantIds,
    observed.matchedSharingGrantIds,
    "matchedSharingGrantIds",
    scenario,
    observed,
  );

  if (expected.provenance) {
    const observedProvenance = observed.provenance ?? {};
    for (const [key, expectedValue] of Object.entries(expected.provenance)) {
      if (observedProvenance[key] !== expectedValue) {
        throw new Error(
          `${scenario.scenarioId}: expected decision.provenance['${key}']='${expectedValue}' but observed `
          + `'${String(observedProvenance[key])}'. Context: ${summarizeScenario(scenario)}. `
          + `Observed decision: ${summarizeObservedDecision(observed)}`,
        );
      }
    }
  }
}

function assertRuntimeMetadata(
  expected: InvariantExpectedRuntimeMetadata | undefined,
  observed: InvariantObservedRuntimeMetadata | undefined,
  scenario: InvariantScenarioDefinition,
): void {
  if (!expected) {
    return;
  }
  if (!observed) {
    throw new Error(
      `${scenario.scenarioId}: expected runtime metadata but observed runtime metadata is undefined. `
      + `Context: ${summarizeScenario(scenario)}.`,
    );
  }
  if (expected.statusCode && observed.statusCode !== expected.statusCode) {
    throw new Error(
      `${scenario.scenarioId}: expected statusCode '${expected.statusCode}' but got '${String(observed.statusCode)}'.`,
    );
  }
  assertPartialArray(
    expected.visibleResourceIds,
    observed.visibleResourceIds,
    "visibleResourceIds",
    scenario,
    undefined,
  );
  assertPartialArray(
    expected.redactedFields,
    observed.redactedFields,
    "redactedFields",
    scenario,
    undefined,
  );
}

function assertExpectedOutcome(
  execution: InvariantExecutionResult<unknown, unknown>,
  expectedOutcome: "allow" | "deny",
): void {
  const { scenario, observed } = execution;
  if (observed.outcome !== expectedOutcome) {
    throw new Error(
      `${scenario.scenarioId}: expected authorization outcome '${expectedOutcome}' but observed '${observed.outcome}'. `
      + `Context: ${summarizeScenario(scenario)}. Observed decision: ${summarizeObservedDecision(observed.decision)}`,
    );
  }
}

export function assertAuthorizationDecisionAllowed<TInput, TResult>(
  execution: InvariantExecutionResult<TInput, TResult>,
): void {
  assertExpectedOutcome(execution as InvariantExecutionResult<unknown, unknown>, "allow");
}

export function assertAuthorizationDecisionDenied<TInput, TResult>(
  execution: InvariantExecutionResult<TInput, TResult>,
): void {
  assertExpectedOutcome(execution as InvariantExecutionResult<unknown, unknown>, "deny");
}

export function assertInvariantExecution<TInput, TResult>(
  execution: InvariantExecutionResult<TInput, TResult>,
): void {
  const { scenario, observed } = execution;
  if (scenario.expectation.outcome === "allow") {
    assertAuthorizationDecisionAllowed(execution);
  } else {
    assertAuthorizationDecisionDenied(execution);
  }

  assertDecisionMetadata(scenario.expectation.decision, observed.decision, scenario);
  assertRuntimeMetadata(scenario.expectation.runtime, observed.runtime, scenario);
}
