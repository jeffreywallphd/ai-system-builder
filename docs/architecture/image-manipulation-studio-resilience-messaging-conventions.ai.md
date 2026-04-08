# AI Companion: Image Studio Resilience Messaging Conventions

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-studio-resilience-messaging-conventions.md`
- Canonical implementation seams:
  - `src/ui/shared/images/ImageStudioOperationalMessaging.ts`
  - `src/ui/shared/images/ImageStudioPresenterContracts.ts`
  - `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`

## Why this exists
- Story 8.3.1 requires one coherent user-facing messaging experience across degraded and failure states.
- Feature 8 taxonomy/resilience/recovery contracts already provide normalized semantics; this story standardizes how studio UX consumes them.

## Contract summary
- Main message kinds:
  - `user-action-required`
  - `wait-and-retry-later`
  - `operator-action-required`
  - `terminal-failure`
- Message kinds must provide:
  - plain-language summary,
  - recommended next actions,
  - explicit retry posture.

## Integration posture
- Presenter surface state now carries normalized message kind and recommended actions.
- Runtime panel failure guidance now derives from shared normalization/taxonomy helpers instead of local code-token heuristics.
- Temporary outage, user-fixable setup, and terminal/operator conditions are intentionally distinct in the user path.

## Tests
- `src/ui/shared/tests/ImageStudioOperationalMessaging.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
