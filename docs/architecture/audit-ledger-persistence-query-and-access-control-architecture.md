# Audit Ledger Persistence, Query, and Access-Control Architecture

This note captures Story 18.2.8 for Feature 18 / Epic 18.2.

## Architecture scope and purpose

Document the production baseline for how canonical audit events are:

- written through authoritative append workflows,
- persisted with immutable-enough guardrails,
- read through query/detail services,
- permission-checked and visibility-shaped for governance/admin consumers,
- prepared for future retention and lifecycle governance without destructive behavior in this slice.

Use this architecture note together with:

- `docs/architecture/audit-authoritative-recording-service-and-ports.md`
- `docs/architecture/audit-durable-ledger-persistence-and-repositories.md`
- `docs/audit-governance-contributor-guide.md`

## Canonical write path (authoritative append workflow)

Canonical append path:

1. Source adapters map feature events into canonical-authoritative audit inputs:
   - `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`
   - `src/infrastructure/audit/AuthoritativeSchedulingGovernanceEventSink.ts`
   - `src/infrastructure/audit/AuthoritativeStorageManagementAuditSink.ts`
   - `src/infrastructure/audit/AuthoritativeSecretAccessAuditHook.ts`
2. `AuthoritativeAuditRecordingService` enforces source/action alignment, normalizes references, and sanitizes payload boundaries:
   - `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
   - `src/application/audit/shared/AuditReferenceNormalization.ts`
3. Canonical event construction occurs in domain contracts:
   - `src/domain/audit/AuditDomain.ts`
4. Durable append is delegated only through the ledger port:
   - `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
   - `IAuditLedgerRepository.appendAuditEvent(...)`
5. SQLite adapter persists canonical rows and replay metadata:
   - `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
   - `src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts`

## Append invariants and immutable-enough safeguards

Current invariants:

- Canonical writes are append-oriented and operation-key replay-safe.
- `operationKey` is normalized and required by append contracts.
- Duplicate `eventId` with different payload is rejected.
- Replay metadata is tracked in `authoritative_audit_ledger_mutation_replays`.
- SQL triggers prohibit `UPDATE` and `DELETE` on event and replay tables.
- Hash-chained immutability events enforce digest continuity (`integrity_event_digest`, `integrity_previous_event_digest`).

Current trust limits:

- The baseline is immutable-enough within runtime/repository/SQLite controls.
- It is not external notarization and not independent cryptographic attestation.
- Future stronger tamper-evidence (signed/off-box anchoring) is intentionally outside this story.

## Canonical read path (query and detail retrieval)

Canonical read path:

1. Authoritative API routes expose list/detail retrieval:
   - `src/infrastructure/transport/http-server/authoritative-route-families/AuditAuthoritativeApiRoutes.ts`
   - `GET /api/v1/audit/events`
   - `GET /api/v1/audit/events/:eventId`
2. Backend API normalizes request requirements and maps query errors:
   - `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`
3. `AuditLedgerQueryService` validates/normalizes queries and applies scoped retrieval:
   - `src/application/audit/use-cases/AuditLedgerQueryService.ts`
4. `AuditGovernanceProjectionQueryService` builds UI-ready governance/admin summary/detail projections and page-bounded filter facets without moving projection logic into UI:
   - `src/application/audit/use-cases/AuditGovernanceProjectionQueryService.ts`
5. `AuditLedgerBackendApi` exposes both canonical and projection retrieval seams:
   - `GET /api/v1/audit/events`
   - `GET /api/v1/audit/events/:eventId`
   - `GET /api/v1/audit/governance/events`
   - `GET /api/v1/audit/governance/events/:eventId`
6. Repository filters by canonical dimensions, linkage/correlation, retention/lifecycle selectors, and paging/sort:
   - `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`

Query coverage includes:

- category/action/eventType/outcome/actor/workspace/resource selectors,
- temporal windows (`occurredAfter`, `occurredBefore`),
- correlation/request selectors,
- linkage selectors (`eventGroupId`, `rootEventId`, `parentEventId`, `workflowId`, `sessionRef`, `runId`, `governanceActionId`),
- retention/lifecycle selectors (`retentionPosture`, `lifecycleState`, `retentionPolicyKey`, `retainUntilAfter`, `retainUntilBefore`).

## Access-control and redacted view enforcement

Authorization and visibility are application-layer responsibilities:

- `WorkspaceAuditLedgerReadAuthorizer` derives role-aware workspace scope and sensitivity posture.
- `AuditLedgerQueryService` intersects caller filters with authorization scope before repository reads.
- non-admin actors are constrained to thin-safe posture (`includeThinSafeOnly`) and protected-data exclusion.
- detail retrieval returns `notFound` for non-visible events to avoid leaking hidden records.

View shaping:

- summary/detail DTOs are produced from shared contracts:
  - `src/shared/contracts/audit/AuditEventContracts.ts`
  - `src/shared/dto/audit/AuditEventDtos.ts`
- governance projection DTOs/facets are produced in the application query boundary:
  - `src/application/audit/use-cases/AuditGovernanceProjectionQueryService.ts`
- detail projection is visibility-driven via `toAuditEventDetailView(...)`:
  - `user-safe` excludes `adminOnlyDetails`
  - `admin` includes `adminOnlyDetails`

## Correlation and linkage handling

The ledger is designed for workflow and governance traversal without duplicating business truth:

- correlation/request identifiers support cross-service join points;
- linkage metadata captures event lineage and operational relationships;
- related resources are normalized references, not raw payload dumps;
- list filters support linkage-aware investigations and workflow replay analysis.

## Retention/lifecycle seams and current limits

Retention is metadata-first in this slice:

- canonical events support `retentionMetadata` and indexed lifecycle columns;
- environment defaults are resolved through:
  - `src/infrastructure/config/AuditRetentionLifecycleConfig.ts`
- only `metadata-only` execution mode is supported;
- destructive retention actions are explicitly rejected;
- no purge/archive worker is implemented here.

This seam exists so future governance policy engines and admin tooling can add lifecycle workflows without replacing persistence/query contracts.

## Prohibited shortcuts

- Writing canonical audit records directly from UI code is prohibited.
- Writing canonical audit records directly from route handlers/controllers is prohibited.
- Bypassing `AuthoritativeAuditRecordingService` for new canonical events is prohibited.
- Bypassing `AuditLedgerQueryService`/`WorkspaceAuditLedgerReadAuthorizer` for privileged reads is prohibited.
- Returning `adminOnlyDetails` from non-admin paths is prohibited.
- Implementing destructive retention deletes in this slice is prohibited.

## Tests and verification anchors

- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/application/audit/tests/WorkspaceAuditLedgerReadAuthorizer.test.ts`
- `src/infrastructure/api/audit/tests/AuditLedgerBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuditLedger.test.ts`

