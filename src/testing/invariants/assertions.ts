import type {
  InvariantExecutionResult,
  InvariantExpectedDecisionMetadata,
  InvariantExpectedRuntimeMetadata,
  InvariantObservedDecisionMetadata,
  InvariantObservedRuntimeMetadata,
  InvariantScenarioDefinition,
} from "./contracts";

function assertPartialArray(
  expected: ReadonlyArray<string> | undefined,
  observed: ReadonlyArray<string> | undefined,
  field: string,
  scenario: InvariantScenarioDefinition,
): void {
  if (!expected) {
    return;
  }
  if (!observed) {
    throw new Error(`${scenario.scenarioId}: missing observed '${field}' array.`);
  }
  const missing = expected.filter((value) => !observed.includes(value));
  if (missing.length > 0) {
    throw new Error(
      `${scenario.scenarioId}: observed '${field}' is missing values: ${missing.join(", ")}.`,
    );
  }
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
    throw new Error(`${scenario.scenarioId}: expected decision metadata was not produced.`);
  }
  if (expected.reasonCode && observed.reasonCode !== expected.reasonCode) {
    throw new Error(
      `${scenario.scenarioId}: expected reasonCode '${expected.reasonCode}' but got '${String(observed.reasonCode)}'.`,
    );
  }
  if (expected.denialReason && observed.denialReason !== expected.denialReason) {
    throw new Error(
      `${scenario.scenarioId}: expected denialReason '${expected.denialReason}' but got '${String(observed.denialReason)}'.`,
    );
  }
  if (expected.requiredPermissionKey && observed.requiredPermissionKey !== expected.requiredPermissionKey) {
    throw new Error(
      `${scenario.scenarioId}: expected requiredPermissionKey '${expected.requiredPermissionKey}' but got '${String(observed.requiredPermissionKey)}'.`,
    );
  }
  assertPartialArray(
    expected.matchedRoleAssignmentIds,
    observed.matchedRoleAssignmentIds,
    "matchedRoleAssignmentIds",
    scenario,
  );
  assertPartialArray(
    expected.matchedPermissionGrantIds,
    observed.matchedPermissionGrantIds,
    "matchedPermissionGrantIds",
    scenario,
  );
  assertPartialArray(
    expected.matchedSharingGrantIds,
    observed.matchedSharingGrantIds,
    "matchedSharingGrantIds",
    scenario,
  );
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
    throw new Error(`${scenario.scenarioId}: expected runtime metadata was not produced.`);
  }
  if (expected.statusCode && observed.statusCode !== expected.statusCode) {
    throw new Error(
      `${scenario.scenarioId}: expected statusCode '${expected.statusCode}' but got '${String(observed.statusCode)}'.`,
    );
  }
  assertPartialArray(expected.visibleResourceIds, observed.visibleResourceIds, "visibleResourceIds", scenario);
  assertPartialArray(expected.redactedFields, observed.redactedFields, "redactedFields", scenario);
}

export function assertInvariantExecution<TInput, TResult>(
  execution: InvariantExecutionResult<TInput, TResult>,
): void {
  const { scenario, observed } = execution;
  if (observed.outcome !== scenario.expectation.outcome) {
    throw new Error(
      `${scenario.scenarioId}: expected outcome '${scenario.expectation.outcome}' but got '${observed.outcome}'.`,
    );
  }
  assertDecisionMetadata(scenario.expectation.decision, observed.decision, scenario);
  assertRuntimeMetadata(scenario.expectation.runtime, observed.runtime, scenario);
}
