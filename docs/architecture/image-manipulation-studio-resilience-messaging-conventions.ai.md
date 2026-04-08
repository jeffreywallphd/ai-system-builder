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
- Story 8.3.2 extends this with safe action execution so retry/recovery controls are explicit, policy-gated, and continuity-safe.

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
- Runtime action selection (`retry launch`, `wait and refresh`, `reopen latest setup`, `reuse prior result`, `reselect source image`) is derived from recovery policy + authoritative context (precheck/history/recent work), not local shortcut state.

## Safety posture for Story 8.3.2
- `Retry launch` is shown/enabled only when retry is eligible and safe and launch precheck is ready.
- User-fixable or terminal failures do not expose enabled immediate retry.
- `Reuse prior result` only appears when authoritative run history contains reusable output records.
- Recovery actions continue to route through authoritative APIs and preserve durable IDs; no hidden local continuity forks.

## Tests
- `src/ui/shared/tests/ImageStudioOperationalMessaging.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
