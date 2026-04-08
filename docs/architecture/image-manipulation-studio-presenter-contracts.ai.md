# AI Companion: Image Manipulation Studio Presenter Contracts and DTO Composition (Story 7.1.2)

## Scope

Story 7.1.2 adds the shared presenter composition seam for the image manipulation studio so the full slice can expose stable UI-facing contracts independent of raw transport and persistence shapes.

## Canonical seam

- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- Tests: `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
- `src/ui/shared/images/ImageStudioUxCopy.ts`
- Tests: `src/ui/shared/tests/ImageStudioUxCopy.test.ts`
- Human architecture note: `docs/architecture/image-manipulation-studio-presenter-contracts.md`

Story 7.1.3 adds centralized UX copy and language posture so presenter mapping and UI messaging stay aligned.

## Contract model

The presenter view model now composes all major studio surfaces under one stable structure:

1. input selection
2. edit selection
3. readiness
4. run monitoring
5. results
6. continuation

Each surface maps into one standardized state kind:

- `loading`
- `empty`
- `error`
- `ready`
- `degraded`

## DTO composition posture

Composition input uses `ImageStudioPresenterComposeInput` with snapshot envelopes (`idle|loading|ready|error`) and canonical interaction state.

Raw subsystem DTOs are projected into studio-facing DTOs before UI consumption:

- `ImageStudioInputOptionDto`
- `ImageStudioWorkflowOptionDto`
- `ImageStudioSystemOptionDto`
- `ImageStudioRunMonitoringDto`
- `ImageStudioResultPreviewDto`
- `ImageStudioContinuationDto`

This keeps raw adapter/persistence/transport contracts out of surface rendering logic.

## Non-technical UX language posture

Main user-facing labels are intentionally plain-language:

- choose image
- choose edit
- adjust settings
- check readiness
- start edit
- track progress
- review results

Blocker mapping from flow gates is centralized and user-facing (`mapImageStudioStepGateToPresenterBlockers`) so low-level gate codes are never rendered directly.

## Advanced diagnostics posture

Technical details remain available through `advanced` contracts but are hidden by default (`hiddenByDefault: true`) so diagnostics are available for advanced users without polluting primary path copy.

## Selector seams

The module now centralizes presentation selectors:

- `selectImageStudioPrimaryAction(...)`
- `selectImageStudioSurfaceState(...)`

This reduces component-level conditional composition drift across studio surfaces.
