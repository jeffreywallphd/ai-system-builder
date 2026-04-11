---
title: "AI Companion: Documentation Indexing Model and Goals"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationIndexingModelGuardrails.test.ts
---

# AI Companion: Documentation Indexing Model and Goals (Story 6.1.1)

Use this file for the canonical intent of documentation indexing and findability.

## Canonical Source

- Human-readable model: `docs/context/documentation-indexing-model.md`

## Model Summary

- Folder structure remains primary organization.
- Metadata headers provide machine-readable discovery signals.
- A lightweight registry layer captures discovery records for authoritative docs.
- Routing and context packs consume indexed signals; they are not replaced by indexing.
- Validation stays structural and maintainable.

## Core Goals

- Enable fast discovery of authoritative docs by intent.
- Support deterministic human and AI routing.
- Reduce noisy broad-scans by using metadata-guided lookup.
- Keep operational complexity low for routine contributor maintenance.
- Preserve a stable baseline for future registry/metadata implementation work.

## Discovery Problems Addressed

- Similar filenames and broad folders make canonical docs hard to find quickly.
- Folder paths alone do not express authority, lifecycle, or intended usage.
- AI assistants need machine-readable discovery hints to avoid context bloat.
- Contributors need a repeatable indexing pattern without introducing heavy tooling.

## Relationship Contract

- Taxonomy defines doc role and authority semantics.
- Metadata header fields serialize taxonomy for tooling.
- Registry entries provide discoverability records.
- Routing maps select minimal context paths using indexed authority signals.
- Context packs remain curated reuse units for task classes.

## Non-Goals

- No full-text search platform in this story.
- No replacement of routers, taxonomy, or context packs.
- No embedding/ranking retrieval pipeline.
- No complex per-team custom indexing schema.

## Complexity Target

- Keep indexing as a small, explicit contract plus lightweight consistency checks.

## Guardrail

- Story guardrail test: `dev/tests/DocumentationIndexingModelGuardrails.test.ts`
- Foundation validator rule: `dev/scripts/validate-docs-foundation.cjs`
