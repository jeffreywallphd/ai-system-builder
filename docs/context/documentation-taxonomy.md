# Canonical Documentation Taxonomy (Story 1.2.1)

This document defines the canonical documentation taxonomy for AI Loom Studio. It is implementation-ready and uses exact field values for validation and indexing.

## Purpose

Define durable documentation roles and metadata dimensions so documents can be consistently classified, routed, and maintained.

## Canonical Contract Source

- Machine-readable contract: `docs/context/documentation-taxonomy.contract.json`
- This markdown document is normative for human readers and must stay aligned with the JSON contract.

## Metadata Dimensions

| Field | Dimension | Required | Allowed values |
| --- | --- | --- | --- |
| `document_type` | Role | Yes | `architecture-overview`, `architecture-reference`, `contributor-guide`, `runbook`, `adr`, `baseline`, `ai-context` |
| `authoritativeness` | Authority | Yes | `canonical`, `reference`, `supplemental`, `historical` |
| `status` | Lifecycle | Yes | `draft`, `active`, `deprecated`, `superseded`, `archived` |

The metadata header contract in `docs/context/documentation-metadata-header.md` uses `doc_type` as the concrete frontmatter key for this taxonomy `document_type` dimension.

## Field Meanings

### `document_type` (role)

- `architecture-overview`: top-level architecture boundaries and durable system shape.
- `architecture-reference`: detailed subsystem contracts, interfaces, and invariants.
- `contributor-guide`: implementation workflows and contributor guardrails.
- `runbook`: runtime operational procedures and troubleshooting.
- `adr`: architecture decision record with rationale and alternatives.
- `baseline`: historical migration/completion snapshot.
- `ai-context`: shared taxonomy or context pack for cross-domain reasoning.

### `authoritativeness` (authority)

- `canonical`: primary source of truth for the topic scope.
- `reference`: secondary reference that summarizes or points to canonical sources.
- `supplemental`: supporting material such as examples or walkthrough context.
- `historical`: retained for traceability; not authoritative for current behavior.

### `status` (lifecycle)

- `draft`: in progress; not ready for enforcement as stable guidance.
- `active`: approved for current use.
- `deprecated`: still available but should not be used for new work.
- `superseded`: replaced by another document.
- `archived`: retained only for record/history.

## Approved Document Types

### `architecture-overview`

- Purpose: explain system boundaries, major responsibilities, and cross-feature invariants.
- Expected audience: engineers, reviewers, architects.
- Allowed content scope: system composition maps, layer boundaries, durable architecture contracts.
- Common anti-patterns: operational procedures, implementation checklists, unscoped decision logs.

### `architecture-reference`

- Purpose: define deep technical contracts for a subsystem or interface.
- Expected audience: engineers, maintainers, reviewers.
- Allowed content scope: interface semantics, domain/application/infrastructure contracts, extension guardrails.
- Common anti-patterns: runbooks, onboarding tutorials, ADR-style decision alternatives without decision context.

### `contributor-guide`

- Purpose: instruct contributors and AI coding agents how to safely implement changes.
- Expected audience: contributors, reviewers, AI assistants.
- Allowed content scope: implementation workflows, coding guardrails, extension patterns.
- Common anti-patterns: runtime operation authority, architecture decision history, historical baselines as active guidance.

### `runbook`

- Purpose: provide operational procedures for runtime management and incident handling.
- Expected audience: operators, on-call engineers, support maintainers.
- Allowed content scope: diagnostics, recovery procedures, admin steps, troubleshooting flows.
- Common anti-patterns: architecture authority, contributor implementation guardrails, decision records.

### `adr`

- Purpose: record a specific architecture decision and its alternatives/tradeoffs.
- Expected audience: architects, engineers, reviewers.
- Allowed content scope: decision statement, context, alternatives, rationale, status/supersession.
- Common anti-patterns: broad architecture reference with no decision, operational instructions, implementation tutorials.

### `baseline`

- Purpose: preserve historical snapshots for migration and milestone traceability.
- Expected audience: maintainers, reviewers, program leads.
- Allowed content scope: inventories, completion artifacts, historical risk snapshots.
- Common anti-patterns: current operational authority, current contributor workflows, current architecture source-of-truth statements.

### `ai-context`

- Purpose: capture shared context and taxonomy anchors for human/AI reasoning.
- Expected audience: AI assistants, engineers, maintainers.
- Allowed content scope: glossary-style context packs, cross-domain mappings, routing context.
- Common anti-patterns: runbooks, feature-local implementation checklists, competing canonical architecture authority.

## Minimum Metadata Example

```yaml
document_type: architecture-reference
authoritativeness: canonical
status: active
```

## Enforcement

- Guardrail test: `dev/tests/DocumentationTaxonomyGuardrails.test.ts`
- Keep all value sets exact and synchronized with `docs/context/documentation-taxonomy.contract.json`.
