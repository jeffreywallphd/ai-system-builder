# Feature 7 / Epic 7.1 Story 7.1.1: Image Studio Interaction Model

## Story alignment

- Feature 7: Image Manipulation Studio UX and End-to-End Vertical Flow
- Epic 7.1: Studio Flow Architecture, View Models, and UX Contracts
- Story 7.1.1: Define the end-to-end studio interaction model for the image slice

## Purpose

Define one canonical presentation interaction model for the image manipulation studio flow that composes existing authoritative services for assets, workflow/system definitions, readiness, run orchestration, and persisted results into a production-ready UX contract.

## Canonical implementation seam

- `src/ui/shared/images/ImageStudioInteractionModel.ts`
- `src/ui/shared/tests/ImageStudioInteractionModel.test.ts`

## Ordered studio journey

The canonical ordered journey is represented by `ImageStudioFlowStepIds` / `ImageStudioFlowStepSequence`:

1. `select-image`
2. `select-workflow`
3. `configure-parameters`
4. `assess-readiness`
5. `launch-run`
6. `monitor-run`
7. `review-results`

`deriveImageStudioPresentationState(...)` computes the current step from authoritative truth plus transient UI edits, so desktop and future thin-client surfaces can present the same flow behavior.

## State ownership model

`ImageStudioInteractionState` is explicitly partitioned into:

1. `authoritative`
- Server-backed truth from platform APIs.
- Includes selected input references, workflow/system selection, committed parameters, readiness snapshots, run summaries/history, and persisted result listings.
- This is the source of truth for continuation/reopen and result review.

2. `transient`
- UI-only state that must never replace authoritative records.
- Includes uncommitted parameter draft values, in-flight request flags, polling toggles, focused step, and local selection emphasis (selected result/reusable result markers).

3. `derived`
- Computed presentation read model only.
- Includes per-step blockers (`stepGates`), `currentStepId`, completed step projection, launch/review eligibility, and monitor posture (`idle|active|terminal`).
- Recomputed after every reducer action.

## Transition model and cross-step dependency rules

`reduceImageStudioInteractionState(...)` defines canonical transitions and dependency invalidation:

- `select-input-image` resets readiness, active run, and results to prevent stale downstream truth.
- `select-workflow-system` resets readiness/run/results and re-seeds parameter draft/committed defaults from authoritative workflow/system defaults.
- `set-parameter-draft` invalidates readiness/run/results until the draft is committed.
- `commit-parameter-draft` promotes transient draft into authoritative committed parameters and clears downstream readiness/run/results.
- `readiness-resolved` is authoritative; launch eligibility comes from this snapshot plus blocker checks.
- `run-launch-accepted` and `run-status-updated` update authoritative run truth and run history.
- `results-synchronized` enables canonical review/reuse behavior after completed runs.
- `resume-session` binds continuation session context to authoritative run truth so reopening work does not create conflicting local state.

## Authoritative API dependency posture

`ImageStudioAuthoritativeApiContract` documents the required authoritative service surface for this flow model. The contract intentionally references API-backed operations for:

- image upload + input listing/reuse,
- workflow/system definition discovery,
- readiness assessment,
- run launch/status/history,
- output listing and input-chaining.

This flow model does not permit direct backend provider probing or local-only run execution shortcuts.

## Continuation and reopen behavior

The model supports continuation by preserving authoritative session/run/result context (`continuationSessionId`, `activeRun`, `runHistory`, `results`) and deriving the correct step from current authoritative state. A reopened completed run with persisted outputs resolves to `review-results` without inventing an alternate local truth source.

## Prohibited shortcuts

- Direct studio-to-provider run dispatch or status probing outside authoritative APIs.
- Local filesystem path assumptions as image-input truth.
- Treating transient UI draft state as canonical readiness or run lifecycle truth.
- Parallel per-surface state machines that diverge from this shared model.
