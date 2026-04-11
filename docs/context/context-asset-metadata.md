# Context Asset Metadata Standard

This document defines a lightweight metadata contract for context-pack catalog entries and task-to-context routing records.

## Purpose

Provide a stable, machine-readable metadata baseline that keeps context assets indexable, auditable, and deterministic without adding high maintenance overhead.

## Canonical Contract Sources

- Human-readable: `docs/context/context-asset-metadata.md`
- AI-readable: `docs/context/context-asset-metadata.ai.md`
- Machine-readable: `docs/context/context-asset-metadata.contract.json`

## Required Metadata Fields

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `id` | Yes | `string` | Stable unique identifier for the context asset entry. |
| `title` | Yes | `string` | Human-readable label for routing and audit output. |
| `purpose` | Yes | `string` | Concise statement of why the asset exists and what it supports. |
| `domain` | Yes | `string` | Primary context domain (for example, `context-engineering`, `documentation`, `runtime-security`). |
| `owner` | Yes | `string` | Team or maintainer accountable for quality and review. |
| `status` | Yes | `enum` | Lifecycle state. Allowed values come from the asset-specific contract. |
| `relatedDocPaths` | Yes | `string[]` | Canonical docs paths used for source-of-truth retrieval. |
| `relatedCodePaths` | Yes | `string[]` | Canonical code paths tied to the asset's scope. |

## Optional Metadata Fields

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `tags` | No | `string[]` | Lightweight labels for filtering and index grouping. |
| `notes` | No | `string` | Short maintenance notes that do not alter contract behavior. |
| `reviewExpectations` | No | `object` | Explicit review cadence and optional recency metadata. |

`reviewExpectations` shape:

- Required when present:
`cadence`
- Optional:
`lastReviewed`, `nextReviewBy`, `notes`

## Asset-Specific Application

- Context-pack catalog entries must include all required fields from this standard plus pack-path fields required by `context-pack-catalog.contract.json`.
- Task-to-context routing mappings must include all required fields from this standard plus routing fields required by `task-to-context-routing.contract.json`.

## Cross-Field Rules

- `id` must remain stable once published.
- `status` must use the allowed values declared by the containing asset contract.
- `relatedDocPaths` and `relatedCodePaths` should stay minimal and canonical to reduce retrieval noise.
- `reviewExpectations` is optional, but when present it must include a `cadence` value.

## Enforcement

- Guardrail test: `dev/tests/ContextAssetMetadataStandardsGuardrails.test.ts`
- Pack contract guardrail: `dev/tests/ContextPackContractGuardrails.test.ts`
- Routing contract guardrail: `dev/tests/TaskToContextRoutingContractGuardrails.test.ts`
