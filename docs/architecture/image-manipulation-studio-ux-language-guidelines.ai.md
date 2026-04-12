# AI Companion: Image Manipulation Studio UX Language Guidelines (Story 7.1.3)

## Scope

Story 7.1.3 defines the canonical user-facing language posture for the image manipulation studio so the full vertical flow remains approachable for non-technical users while retaining optional advanced diagnostics.

## Canonical seam

- `src/ui/shared/images/ImageStudioUxCopy.ts`
- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- Tests: `src/ui/shared/tests/ImageStudioUxCopy.test.ts`, `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
- Human architecture note: `docs/architecture/image-manipulation-studio-ux-language-guidelines.md`

## Primary language rules

- Use plain-language action labels in the main path.
- Avoid platform/data/workflow jargon in default headings and descriptions.
- Keep advanced technical details available but hidden by default.

## Approved primary terms

Flow labels:

1. `Choose image`
2. `Choose edit`
3. `Adjust settings`
4. `Check readiness`
5. `Start edit`
6. `Track progress`
7. `Review results`

Surface titles:

1. `Choose an image`
2. `Choose an edit`
3. `Check readiness`
4. `Run progress`
5. `Your results`
6. `Continue where you left off`

## Reserved advanced terms

Keep these out of default copy and only in diagnostics/troubleshooting contexts:

- `workflow`, `node`, `adapter`, `backend`, `transport`
- IDs and versions (`workflowId`, `systemId`, `runId`)
- gate/blocker code identifiers

## State microcopy contract

Use stable patterns per state kind:

- `loading`: what is in progress
- `empty`: what action the user should take next
- `error`: what failed + retry posture
- `ready`: concise success/availability confirmation
- `degraded`: partial availability + immediate next action

## Blocker/message mapping posture

- Blocker codes remain internal.
- User-facing blocker guidance is centralized in the copy seam.
- Presenter surfaces render mapped plain-language messages only.

## Continuation + diagnostics posture

- Continuation copy stays task-focused (`Continue where you left off`).
- Advanced diagnostics remain in `advanced` contracts with `hiddenByDefault: true`.
- Primary UX copy should remain understandable without opening advanced sections.
