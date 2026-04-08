# Feature 7 / Epic 7.1 Story 7.1.2: Image Studio Presenter Contracts and DTO Composition

## Story alignment

- Feature 7: Image Manipulation Studio UX and End-to-End Vertical Flow
- Epic 7.1: Studio Flow Architecture, View Models, and UX Contracts
- Story 7.1.2: Define studio-facing DTO composition and presenter contracts for the full slice

## Purpose

Define one canonical presenter composition seam that combines image input metadata, edit selection options, readiness state, run monitoring, result previews, and continuation context into stable UI-facing contracts.

## Canonical implementation seam

- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
- `src/ui/shared/images/ImageStudioUxCopy.ts`
- `src/ui/shared/tests/ImageStudioUxCopy.test.ts`

Story 7.1.3 extends this seam with centralized UX copy and language rules so presenter state mapping and user-facing messaging remain consistent.

## Presenter contract scope

`ImageStudioPresenterContracts` introduces a single composition model for major image studio surfaces:

1. Input selection surface (`input`)
2. Edit selection surface (`workflow`)
3. Readiness surface (`readiness`)
4. Run monitoring surface (`run`)
5. Results surface (`results`)
6. Continuation surface (`continuation`)

Each surface now uses the same state-shape contract:

- `loading`
- `empty`
- `error`
- `ready`
- `degraded`

This gives desktop and future web/mobile surfaces one stable UI readiness vocabulary.

## DTO composition strategy

Composition input is explicit through `ImageStudioPresenterComposeInput`:

- canonical interaction state from `ImageStudioInteractionModel`
- authoritative snapshot envelopes (`idle|loading|ready|error`) for:
  - image options
  - workflow/system options
  - run monitoring
  - result previews
  - continuation context

Raw transport payloads are intentionally projected into studio DTOs first (`ImageStudioInputOptionDto`, `ImageStudioWorkflowOptionDto`, `ImageStudioRunMonitoringDto`, `ImageStudioResultPreviewDto`) so UI components consume stable user-facing contracts instead of persistence/adapter structures.

## User-facing language posture

Primary surface titles and actions avoid implementation jargon in the main path:

- "Choose image"
- "Choose edit"
- "Adjust settings"
- "Check readiness"
- "Start edit"
- "Track progress"
- "Review results"

This keeps the default path understandable for non-technical users while preserving full flow capability.

## Advanced diagnostics posture

Technical detail remains available without polluting the main path:

- `advanced.hiddenByDefault` is always `true`
- technical summary and notes are exposed through a dedicated `advanced` contract branch
- primary surface states remain concise and task-focused

## Centralized selector and mapping seams

The presenter module now owns:

- blocker-to-user-message mapping (`mapImageStudioStepGateToPresenterBlockers`)
- primary action derivation (`selectImageStudioPrimaryAction`)
- surface-state selection (`selectImageStudioSurfaceState`)
- complete view-model composition (`composeImageStudioPresenterViewModel`)

This prevents view-model composition logic from being scattered across page components.

## Validation coverage

`ImageStudioPresenterContracts.test.ts` verifies:

- full-flow composed contract output across all major surfaces
- consistent loading/empty/error/ready/degraded mapping behavior
- user-facing blocker-message projection from flow gates
