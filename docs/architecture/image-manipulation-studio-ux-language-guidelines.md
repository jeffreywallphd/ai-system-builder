# Feature 7 / Epic 7.1 Story 7.1.3: Image Manipulation Studio UX Language Guidelines

## Story alignment

- Feature 7: Image Manipulation Studio UX and End-to-End Vertical Flow
- Epic 7.1: Studio Flow Architecture, View Models, and UX Contracts
- Story 7.1.3: Define user-friendly content and UX language guidelines for the image slice

## Purpose

Standardize user-facing language for the image manipulation studio so non-technical users can complete the full flow without platform jargon, while still allowing advanced technical detail when explicitly needed.

## Canonical implementation seams

- `src/ui/shared/images/ImageStudioUxCopy.ts`
- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- `src/ui/shared/tests/ImageStudioUxCopy.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`

## Primary UX language posture

- Use action-first plain language in headings and buttons.
- Treat words like `workflow`, `node`, `adapter`, `backend`, and transport-level terms as advanced/diagnostic vocabulary.
- Keep default surface copy task-oriented and outcome-oriented.
- Keep advanced diagnostics available but collapsed by default.

## Canonical user-facing terms

Use these terms for the primary flow:

1. Choose image
2. Choose edit
3. Adjust settings
4. Check readiness
5. Start edit
6. Track progress
7. Review results

Use these terms for shared surfaces:

1. Choose an image
2. Choose an edit
3. Check readiness
4. Run progress
5. Your results
6. Continue where you left off

## Reserved technical terms

Reserve these for advanced diagnostics, admin-only detail, or troubleshooting views:

- workflow ID/version
- system ID/version
- run ID
- node, adapter, backend, transport
- step gate/blocker code

Default surface titles, helper text, and validation messages should not require these terms.

## Microcopy patterns by state

Use consistent state framing across surfaces:

- `loading`: Explain what is being checked or fetched now.
- `empty`: Explain what the user should do next.
- `error`: Explain what failed in plain language and allow retry.
- `ready`: Confirm current readiness/status in plain language.
- `degraded`: Explain partial availability or action needed without exposing low-level failure codes.

## Validation and readiness copy rules

- Surface one clear blocking message first.
- Use concrete action verbs (`Choose`, `Run`, `Save`, `Resolve`, `Load`, `Wait`).
- Keep message text short and direct.
- Keep blocker-code to user-message mapping centralized in the presenter copy layer.

## Progress and result copy rules

- Running state: describe current activity (`Your edit is running.`).
- Terminal success: confirm completion (`Your edit is complete.`).
- Terminal failure/cancelled: explain outcome and recovery (`Review details and try again.`).
- Result reuse: describe user intent (`reuse any image as your next input`).

## Centralization and anti-duplication contract

- Treat `ImageStudioUxCopy.ts` as the source of truth for user-facing labels and blocker-to-message text.
- Presenter composition should reference the copy module instead of embedding duplicate string literals across components.
- Components should render presenter-provided text and avoid ad hoc rewrites.

## Advanced detail posture

- Keep advanced diagnostics in `advanced` presenter contracts with `hiddenByDefault: true`.
- Technical notes may include IDs and machine-oriented state values, but only in advanced sections.
- Primary surface copy remains non-technical even when advanced details are present.
