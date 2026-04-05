# Node Bootstrap Identity Operations

This operational note documents Story 5.2.1 (Feature 5 / Epic 5.2): local node bootstrap identity and trust-material creation before enrollment approval.

## Purpose

- Ensure new compute/hybrid nodes start untrusted but identifiable.
- Persist a durable node identity and bootstrap key material locally.
- Produce an enrollment submission payload suitable for administrator review.

## Canonical implementation

- `src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts`
- `src/infrastructure/security/nodes/tests/NodeBootstrapIdentityService.test.ts`
- `src/shared/contracts/nodes/NodeTrustApiContracts.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`

## Local bootstrap files

`NodeBootstrapIdentityService` stores three files in the configured bootstrap directory:

- `node-bootstrap-record.json`
- `node-bootstrap-private-key.pem`
- `node-bootstrap-public-key.pem`

Writes are atomic (temp file + rename) and use best-effort restrictive permissions (`0600`) after write.

## Bootstrap record fields

The persisted bootstrap record is normalized and includes:

- `nodeId` (durable, generated once)
- `nodeType` (`compute` or `hybrid`)
- `displayName`
- `capabilityProfile`
- `deploymentTags` (normalized lowercase, deduplicated)
- `publicTrustMaterialRef` (derived from public key fingerprint)
- `publicKeyAlgorithm` (`ed25519`)
- `publicKeyFingerprintSha256`
- `approvalStatus` (`pending`)
- `trustState` (`pending-enrollment`)
- `createdAt`

The node is not marked trusted or active during bootstrap.

## Idempotency behavior

- If all bootstrap files exist and pass validation, bootstrap is recovered without regeneration.
- If no bootstrap files exist, new identity material is generated.
- If files are partially present or invalid (for example fingerprint mismatch), bootstrap fails with an explicit error and does not silently regenerate.

## Enrollment payload generation

`buildEnrollmentSubmissionPayload(...)` maps local bootstrap material into `NodeEnrollmentSubmissionRequestDto`:

- node identity fields (`nodeId`, `nodeType`, `displayName`)
- capability and deployment tags
- bootstrap envelope fields including trust-material reference and public key metadata

This payload is schema-compatible with `parseNodeEnrollmentSubmissionRequestDto(...)`.
