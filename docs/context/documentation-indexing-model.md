---
title: Documentation Indexing Model and Goals
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

# Documentation Indexing Model and Goals (Story 6.1.1)

This document defines the core indexing model for documentation findability in AI Loom Studio.

## Purpose

Define a lightweight, explicit discovery model so readers and AI systems can locate authoritative documentation without relying on brittle folder guessing.

## Discovery Problems This Model Solves

- Canonical guidance exists, but can be hard to locate quickly when multiple related docs share similar names.
- Folder location alone does not capture intent such as authority level, lifecycle state, or best-entry routing path.
- AI workflows need machine-readable hints to avoid broad scanning and context overload.
- Contributors need a repeatable way to register new docs for discovery without introducing a heavy documentation platform.

## Indexing Model

1. Keep folder structure as the primary physical organization system.
2. Treat metadata headers as per-document discovery signals (`doc_type`, `status`, `authoritativeness`, ownership, review date).
3. Add a documentation registry as a lightweight machine-readable index of high-value discovery records.
4. Use routing assets and context packs to assemble task-specific context from indexed authority paths.
5. Keep validation focused on structural integrity and linkability, not content scoring heuristics.

The indexing layer is additive. It improves lookup and routing, but does not replace taxonomy, folder boundaries, or authoring standards.

## Goals

- Make canonical documentation discoverable by intent, not only by folder path.
- Improve deterministic routing for both humans and AI assistants.
- Reduce retrieval noise by preferring authoritative docs over broad neighboring scans.
- Keep maintenance overhead low so contributors can sustain the system with normal doc updates.
- Provide a stable model that later metadata and registry stories can implement without reinterpretation.

## Non-Goals and Complexity Boundaries

- Do not build full-text search infrastructure in this story.
- Do not replace existing folder taxonomy, routers, or context packs.
- Do not introduce ranking models, embeddings, or probabilistic retrieval pipelines.
- Do not require per-team custom schemas beyond the shared metadata contract.
- Do not centralize all doc intent in one mega-registry that duplicates existing docs.

The target complexity is "small contract, strong consistency checks."

## Relationship to Taxonomy, Routing, and Context Packs

- Taxonomy defines document roles and authority semantics.
- Metadata headers make taxonomy values machine-readable at the document level.
- Indexing registry records point to authoritative docs and discovery cues.
- Routing contracts use indexed metadata and curated mappings to select minimal relevant context.
- Context packs remain curated bundles for common task classes; indexing helps find the right packs and source docs.

In short: taxonomy defines meaning, indexing records discoverability, routing selects path, and context packs provide reusable assembly units.

## Human and AI Workflow Support

### Human workflow

- Start in routers (`docs/README.md`, `docs/context/README.md`).
- Use indexing metadata and registry records to confirm authoritative destinations quickly.
- Follow taxonomy/status signals before using a doc as implementation authority.

### AI workflow

- Read routing contracts and seeds first.
- Use indexing signals to favor canonical, active docs and avoid historical noise unless explicitly requested.
- Build minimum sufficient context by combining routing maps with indexed authority paths.

## Lightweight Validation Approach

For this story, validation stays intentionally lightweight:

- Guardrail tests verify the indexing model docs exist and keep required model sections.
- Foundation validation checks ensure this model remains present and structurally complete.
- Indexed-record metadata structure is defined in `docs/context/documentation-indexed-document-metadata.md`.

Rationale: model-definition stories should enforce contract clarity first; deeper registry schema validation belongs to follow-on implementation stories.
