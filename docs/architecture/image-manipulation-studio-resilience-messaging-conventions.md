# Feature 8 / Epic 8.3 Story 8.3.1: Image Studio Resilience Messaging Conventions

## Story alignment

- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.3: User-Facing Recovery UX, Operational Messaging, and Safe Retry Flows
- Story 8.3.1: Unified user-facing error and degraded-state messaging across the image manipulation studio flow

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
