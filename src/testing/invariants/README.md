# Invariant Framework Test Support

This module provides a shared baseline for cross-system invariant testing:

- authorization decision consistency;
- workspace and resource scoping semantics;
- feature-capability enforcement outcomes;
- composed runtime behavior checks.

## Location

- Contracts and harness: `src/testing/invariants/`
- Tests for this module: `src/testing/invariants/tests/`

## Core Contracts

- `InvariantScenarioDefinition<TInput>`
  - scenario id/title, feature family, actor/workspace/target context, input, and expected outcome metadata.
- `InvariantFamilyAdapter<TInput, TResult>`
  - family-specific evaluator contract for assets, workflows, systems, runs, storage, secrets, and admin/deployment surfaces.
- `InvariantExecutionResult`
  - observed decision/runtime metadata and optional adapter result payload.

## Reusable Helpers

- `composeInvariantFixtures(...)`
  - deterministic fixture bag composition for shared setup across scenarios.
- `InvariantAdapterRegistry`
  - explicit family-to-adapter registration with duplicate-family protection.
- `executeInvariantScenario(...)`
  - run scenario against resolved adapter with fixed evaluation timestamp.
- `executeAndAssertInvariantScenario(...)`
  - run + assert expected outcome/metadata using shared assertions.

## Extension Workflow

1. Define a scenario with `InvariantScenarioDefinition` and include expectation metadata.
2. Reuse or compose fixtures with `composeInvariantFixtures`.
3. Implement a family adapter that maps scenario input to real policy/runtime evaluation.
4. Register the adapter in `InvariantAdapterRegistry` and execute with `executeAndAssertInvariantScenario`.
5. Keep family-specific details in adapters, not in shared harness contracts.

## Guardrails

- Keep contracts explicit and typed; avoid adding a generic DSL layer.
- Keep adapter behavior family-local; shared module should stay orchestration-only.
- Prefer metadata assertions tied to stable policy/runtime invariants instead of internal implementation details.
