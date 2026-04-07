# AI Companion: Secret Metadata Management Operations

## Scope

- Story 8.3.2 operational guidance for the first secret metadata admin UI slice.

## Entry surface

- Route: `/settings/secrets`
- Linked from `SettingsPage` action shortcuts.

## Behavior summary

- Supports create, list, metadata detail inspect, rotate, and disable actions.
- Uses explicit owner scope filtering (`server`, `workspace`, `user`).
- Plaintext fields exist only in submit forms (create/rotate) and are cleared after mutation.
- Metadata detail intentionally shows `Redacted by design` for plaintext.

## Safety and authorization posture

- Authenticated session gating remains fail-closed.
- Authorization failures and other API denials are surfaced as safe user alerts.
- No UI flow renders stored plaintext after initial submission.

## Key artifacts

- `src/ui/pages/SecretMetadataManagementPage.tsx`
- `src/ui/services/SecretMetadataManagementService.ts`
- `src/ui/shared/security/SecretMetadataManagementClient.ts`
- `src/ui/shared/security/tests/SecretMetadataManagementClient.test.ts`
- `src/ui/pages/tests/SecretMetadataManagementPage.test.tsx`
