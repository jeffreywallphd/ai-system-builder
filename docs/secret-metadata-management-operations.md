# Secret Metadata Management Operations

This runbook documents the initial administrative and user-facing secret metadata flows delivered for Story 8.3.2.

## UI entry point

- Desktop/web authenticated route: `/settings/secrets`
- Settings quick link: `Secret metadata management`

## Supported operations

- Create secret metadata record with initial plaintext submission
- List secret metadata by explicit owner scope (`server`, `workspace`, `user`)
- Inspect metadata detail for a selected secret
- Rotate secret by submitting replacement plaintext
- Disable secret record

## Plaintext safety posture

- Plaintext is accepted only in create/rotate submission forms.
- Secret detail and list screens render metadata only.
- UI labels explicitly indicate plaintext is redacted by design after submission.
- Mutation success notices confirm submission without echoing plaintext values.

## Scope ownership guidance

- `server` scope has no workspace/user owner id.
- `workspace` scope requires `workspaceId`.
- `user` scope requires `userIdentityId` (defaults to the signed-in identity if available).

## Authorization and failure behavior

- Authenticated session is required to access the page.
- API denial responses are surfaced as safe alert messages.
- Missing required owner fields are rejected client-side before mutation/query calls.

## Verification artifacts

- `ui/pages/SecretMetadataManagementPage.tsx`
- `ui/pages/tests/SecretMetadataManagementPage.test.tsx`
- `ui/shared/security/SecretMetadataManagementClient.ts`
- `ui/shared/security/tests/SecretMetadataManagementClient.test.ts`
