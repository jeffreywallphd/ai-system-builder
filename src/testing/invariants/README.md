# Invariant Framework Test Support

This module provides a shared baseline for cross-system invariant testing:

- authorization decision consistency;
- workspace and resource scoping semantics;
- feature-capability enforcement outcomes;
- composed runtime behavior checks.

## Location

- Contracts and harness: `src/testing/invariants/`
- Tests for this module: `src/testing/invariants/tests/`
- Asset feature-slice invariant coverage (shared framework): `src/application/authorization/tests/AssetAuthorizationInvariantCoverage.test.ts`
- Workflow feature-slice invariant coverage (shared framework): `src/application/authorization/tests/WorkflowAuthorizationInvariantCoverage.test.ts`
- Run feature-slice invariant coverage (shared framework): `src/application/authorization/tests/RunAuthorizationInvariantCoverage.test.ts`
- System feature-slice invariant coverage (shared framework): `src/application/authorization/tests/SystemAuthorizationInvariantCoverage.test.ts`
- Storage feature-slice invariant coverage (shared framework): `src/application/authorization/tests/StorageAuthorizationInvariantCoverage.test.ts`
- Secret metadata feature-slice invariant coverage (shared framework): `src/application/authorization/tests/SecretAuthorizationInvariantCoverage.test.ts`
- Admin/deployment capability invariant coverage (shared framework): `src/infrastructure/api/deployment/tests/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.test.ts`
- Shared authorization slice adapter/test support: `src/application/authorization/tests/AuthorizationInvariantCoverageTestSupport.ts`
- Shared runtime-composed invariant fixture support: `src/testing/invariants/composedRuntimeFixtures.ts`
- Asset family runtime-composed invariant coverage: `src/application/authorization/tests/AssetAuthorizationRuntimeComposedInvariantCoverage.test.ts`

## Core Contracts

- `InvariantScenarioDefinition<TInput>`
  - scenario id/title, feature family, actor/workspace/target context, optional resource context, input, and expected outcome metadata.
- `InvariantFamilyAdapter<TInput, TResult>`
  - family-specific evaluator contract for assets, workflows, systems, runs, storage, secrets, and admin/deployment surfaces.
- `InvariantExecutionResult`
  - observed decision/runtime metadata and optional adapter result payload.

## Reusable Helpers

- `composeInvariantFixtures(...)`
  - deterministic fixture bag composition for shared setup across scenarios.
- `buildInvariantActorContext(...)`
  - canonical actor fixture builder with normalized identity/workspace fields.
- `buildInvariantWorkspaceContext(...)`
  - canonical workspace fixture builder for active/target/resource workspace contexts.
- `buildInvariantResourceContext(...)`
  - canonical resource fixture builder for resource-family/type/identifier scope.
- `buildInvariantTargetContext(...)` and `buildCapabilityTargetContext(...)`
  - canonical target fixture builders for concrete-resource targets and capability-only targets.
- `buildInvariantWorkspaceRelationshipFixture(...)`
  - composes aligned or divergent active-vs-target-vs-resource workspace relationships without ad hoc setup.
- `normalizeInvariantIdentifier(...)` and `normalizeInvariantIdentifierMap(...)`
  - shared identifier normalization helpers (trim + empty rejection) used by all context builders.
- `InvariantAdapterRegistry`
  - explicit family-to-adapter registration with duplicate-family protection.
- `executeInvariantScenario(...)`
  - run scenario against resolved adapter with fixed evaluation timestamp.
- `executeAndAssertInvariantScenario(...)`
  - run + assert expected outcome/metadata using shared assertions.
- `createAuthorizationInvariantRuntimeFixture(...)`
  - composed runtime fixture that boots `IdentityHttpServer` with real authorization-management wiring (policy evaluator + sqlite repositories/adapters) for runtime-backed invariants.
- `assertAuthorizationDecisionAllowed(...)` and `assertAuthorizationDecisionDenied(...)`
  - canonical allow/deny assertions with readable drift messages for authorization-sensitive stories.
- `assertInvariantExecution(...)`
  - canonical assertion entry point that validates outcome plus decision/runtime metadata, including reason code, source kind, target kind, scope, matched/unmatched identifiers, and decision provenance when supplied.
- `buildAuthorizationBaselineScenarioBuilders()`
  - reusable baseline authorization scenario set covering persisted role applicability, synthesized workspace-role fallback, scope mismatch, explicit deny precedence, read/list-vs-create distinctions, and no-applicable-permission default-deny behavior.
- `validateAuthorizationBaselineScenario(...)`
  - validates that baseline scenario expectations reference concrete role/grant inputs so builder drift is caught by tests before feature-family adapters reuse the scenarios.

## Canonical Authorization Expectation Fields

Use these on `scenario.expectation.decision` to assert architecture-level truth beyond raw allow/deny:

- `reasonCode`, `denialReason`, `requiredPermissionKey`
- `sourceKind` (for example role grant vs sharing grant vs no-effective-permission)
- `targetKind` (resource vs capability target semantics)
- `scope`:
  - `isApplicable`, `scopeKind`, `workspaceId`, `resourceFamily`, `resourceType`, `resourceId`
- `matchedRoleAssignmentIds`, `matchedPermissionGrantIds`, `matchedSharingGrantIds`
- `unmatchedRoleAssignmentIds`, `unmatchedPermissionGrantIds`, `unmatchedSharingGrantIds`
- `provenance` (key/value diagnostics fields emitted by adapters or deeper policy layers)

The assertion helpers are designed to accept currently available result fields and absorb richer decision diagnostics over time.

## Extension Workflow

1. Define a scenario with `InvariantScenarioDefinition` and include expectation metadata.
2. Reuse or compose fixtures with `composeInvariantFixtures` and context builders (`buildInvariant*Context`).
3. Implement a family adapter that maps scenario input to real policy/runtime evaluation.
4. Register the adapter in `InvariantAdapterRegistry` and execute with `executeAndAssertInvariantScenario`.
5. Keep family-specific details in adapters, not in shared harness contracts.

## Workflow Integration

The invariant suite is part of normal repository test flows:

1. full default workflow: `npm test` (runs docs lint + `test:unit`)
2. targeted invariant workflow: `npm run test:unit -- src/testing/invariants/tests src/application/authorization/tests/*InvariantCoverage.test.ts`

Use the targeted command for local iteration on permission-sensitive changes, then run full `npm test` before review.

## When Invariant Coverage Is Expected

Add or update invariant scenarios when a change affects any of the following:

1. authorization allow/deny behavior, reason codes, or policy source semantics
2. workspace target/resource scope applicability rules
3. capability-to-feature-family permission mapping behavior
4. runtime-composed authorization behavior through route-family composition

## Test Selection Guidance

1. use invariant tests for cross-system truth: policy intent + workspace semantics + capability rules + observed runtime outcomes
2. use integration tests for transport mapping, payload shape, status translation, and middleware composition behavior
3. use lower-level unit tests for isolated domain/application logic that does not require composed policy/runtime proof

## Permission-Sensitive PR Checklist

1. include invariant scenarios covering both changed allow and deny paths
2. include scope-mismatch or cross-workspace denial scenarios when scope behavior changes
3. include runtime-composed invariant scenarios when route-family wiring or runtime authorization composition changes
4. keep adapters/scenarios fixture-driven and reusable across feature families
5. state explicitly in the PR description when invariant coverage is intentionally not required

## Runtime-Composed Fixture Pattern

- Use `createAuthorizationInvariantRuntimeFixture(...)` when a scenario should prove live composed behavior across transport route families, identity session handling, and policy-backed persistence wiring.
- Keep fixture scope narrow: include only route-family dependencies needed for the invariant family under test.
- Surface participating dependencies explicitly in test setup by asserting fixture `participants` metadata (evaluator, repositories, adapters, route-family id).
- Use runtime-composed fixtures for high-value slices where isolated evaluator-only tests would miss composition drift.

## Guardrails

- Keep contracts explicit and typed; avoid adding a generic DSL layer.
- Keep adapter behavior family-local; shared module should stay orchestration-only.
- Prefer metadata assertions tied to stable policy/runtime invariants instead of internal implementation details.
- Keep actor context, target context, and resource context distinct so tests can assert workspace-aligned and mismatch paths explicitly.

