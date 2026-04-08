# AI Companion: Image Manipulation Studio Interaction Model (Story 7.1.1)

## Scope

Story 7.1.1 adds a shared, deterministic presentation interaction model for the image manipulation vertical slice so desktop and future thin-client surfaces can use one canonical flow and one state-ownership contract.

## Canonical seam

- `src/ui/shared/images/ImageStudioInteractionModel.ts`
- Tests: `src/ui/shared/tests/ImageStudioInteractionModel.test.ts`
- Human architecture note: `docs/architecture/image-manipulation-studio-interaction-model.md`

## Canonical flow model

The ordered flow is explicit and reusable:

1. `select-image`
2. `select-workflow`
3. `configure-parameters`
4. `assess-readiness`
5. `launch-run`
6. `monitor-run`
7. `review-results`

`deriveImageStudioPresentationState(...)` computes current step, blockers, completion projection, launch eligibility, and monitor posture from authoritative + transient state.

## State partitioning contract

- `authoritative`: API-backed truth (selected image refs, workflow/system selection, committed parameters, readiness, active run/history, persisted results).
- `transient`: UI-only draft and interaction state (parameter draft, pending flags, focused step, local selection emphasis).
- `derived`: computed presentation projection (`currentStepId`, `stepGates`, `canLaunchRun`, `canReviewResults`, `runMonitorState`).

This split prevents conflicting truth sources and keeps continuation/reopen deterministic.

## Transition and invalidation rules

- Upstream changes (`select-input-image`, `select-workflow-system`, `set-parameter-draft`, `commit-parameter-draft`) invalidate downstream readiness/run/result state.
- Launch/readiness/run/result transitions are explicit reducer actions.
- Continuation (`resume-session`) anchors reopen behavior on authoritative run/result records.

## Authoritative dependency posture

`ImageStudioAuthoritativeApiContract` captures the required API-backed operations (upload/list inputs, workflow/system discovery, readiness, launch, run history, output listing, input chaining). Direct provider calls and local-only run logic remain prohibited.
