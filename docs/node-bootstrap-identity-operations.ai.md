# AI Companion: Node Bootstrap Identity Operations

## Purpose

Operational quick-reference for Story 5.2.1 node bootstrap identity creation and local trust-material storage.

## Canonical files

- `src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts`
- `src/infrastructure/security/nodes/tests/NodeBootstrapIdentityService.test.ts`
- `src/shared/contracts/nodes/NodeTrustApiContracts.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`

## Key behavior

- Supports bootstrap for `compute` and `hybrid` nodes.
- Generates durable `nodeId` + Ed25519 keypair + normalized bootstrap record.
- Persists bootstrap record/private/public key files in a node-local directory.
- Applies atomic writes and best-effort restrictive file permissions.
- Recovers idempotently if full bootstrap material already exists.
- Rejects partial/corrupt bootstrap material rather than silently rotating identity.

## Enrollment payload output

- Produces `NodeEnrollmentSubmissionRequestDto` compatible payloads from persisted bootstrap material.
- Bootstrap envelope includes trust-material reference + public key metadata (algorithm, fingerprint, PEM).
- Bootstrap state remains untrusted: `approvalStatus=pending`, `trustState=pending-enrollment`.
