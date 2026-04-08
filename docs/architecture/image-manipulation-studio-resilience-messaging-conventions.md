# Feature 8 / Epic 8.3 Story 8.3.1: Image Studio Resilience Messaging Conventions

## Story alignment

- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.3: User-Facing Recovery UX, Operational Messaging, and Safe Retry Flows
- Story 8.3.1: Unified user-facing error and degraded-state messaging across the image manipulation studio flow
- Story 8.3.2: Safe retry and recovery actions for supported failure and degraded scenarios

## Purpose

Define one UI messaging convention for invalid, degraded, unavailable, delayed, and failed states across image selection, workflow selection, readiness, run launch, run monitoring, result review, preview availability, and continuation retrieval.

The goal is consistent user trust: users should always understand whether they need to fix setup, wait and retry, or escalate.

## Canonical seams

- `src/ui/shared/images/ImageStudioOperationalMessaging.ts`
- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- Tests:
  - `src/ui/shared/tests/ImageStudioOperationalMessaging.test.ts`
  - `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
  - `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`

## Messaging contract

Primary message kinds:

1. `user-action-required`
2. `wait-and-retry-later`
3. `operator-action-required`
4. `terminal-failure`

Each kind must provide:

- a plain-language summary,
- a small list of recommended next actions,
- a safe retry posture (`canRetryNow`).

## Required behavior by state

- User-fixable validation/setup issues map to `user-action-required`.
- Temporary backend/service disruptions map to `wait-and-retry-later`.
- Operator-level service conditions map to `operator-action-required`.
- Terminal/non-retryable conditions map to `terminal-failure`.

## Boundary and copy posture

- Classification and retryability come from Feature 8 taxonomy/recovery contracts.
- Presenter and runtime panel consume normalized guidance; they do not define retry policy heuristics per component.
- Main copy remains non-technical; technical details stay in advanced diagnostics sections.
- Fallback classification from non-taxonomy codes is centralized in `ImageStudioOperationalMessaging`, not duplicated in components.

## Story 8.3.2 safe recovery action posture

Runtime recovery actions are now derived from normalized guidance plus authoritative context (launch precheck, run history, recent work), not ad hoc per-button checks.

Primary supported actions:

1. `Retry launch`
2. `Revisit setup`
3. `Refresh readiness`
4. `Wait and refresh`
5. `Reopen latest setup`
6. `Reuse prior result`
7. `Reselect source image`

Safety rules:

- `Retry launch` is only enabled when shared recovery policy says retry is both eligible and safe, and launch precheck is currently ready.
- User-fixable and terminal conditions never expose an enabled retry-launch path.
- `Reuse prior result` is only offered when authoritative run history contains a reusable output record.
- `Reopen latest setup` remains bound to authoritative saved-system APIs and draft synchronization.
- Recovery actions preserve durable run/result/system IDs and do not create hidden local continuity state.

Scenario mapping highlights:

- Missing/invalid setup (for example no source image) => `Reselect source image`, `Revisit setup`.
- Backend unavailable or pending recovery => `Wait and refresh`, `Refresh readiness`.
- Retry-safe transient run failure => `Retry launch`.
- Recover without rerun pressure => `Reuse prior result` from successful prior output.
