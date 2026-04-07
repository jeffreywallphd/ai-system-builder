# AI Companion: Audit Taxonomy, Capture Boundaries, and Extension Rules

## Purpose

Story 18.1.8 contributor-facing guidance for audit taxonomy usage, authoritative capture boundaries, extension workflow, and prohibited data/content.

Canonical human doc: `docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md`

## Canonical seams

- `src/domain/audit/AuditDomain.ts`
- `src/application/audit/AuditApplicationContracts.ts`
- `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
- `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- `src/application/audit/shared/AuditReferenceNormalization.ts`
- `src/shared/contracts/audit/AuditEventContracts.ts`
- `src/shared/dto/audit/AuditEventDtos.ts`
- `src/shared/schemas/audit/AuditEventSchemaContracts.ts`

## Key rules

- New canonical audit events must flow through `AuthoritativeAuditRecordingPort` and `AuthoritativeAuditRecordingService`.
- Action namespace to category mapping must align to `resolveAuditCategoryForAction(...)`.
- Audit emission belongs in application/infrastructure boundaries, not UI or transport handlers.
- `userSafeDetails` and `adminOnlyDetails` must stay redaction-safe and free of prohibited raw sensitive payloads.

## Prohibited content

- raw secret material, credentials, tokens, key bytes
- raw prompts/completions/transcripts and raw sensitive tool bodies
- raw filesystem/object-key locators and connection strings
- unconstrained sensitive diagnostics

## Tests

- `src/application/audit/tests/AuditTaxonomyExtensionDocumentation.test.ts`

