# Documentation Placement Guide for Contributors

## Purpose

Provide one consistent placement rule set so contributors and AI coding agents put new docs in the correct area and avoid taxonomy drift.

## Placement Responsibilities by Area

| Area | Create here when the primary goal is... | Do not place here when the primary goal is... |
| --- | --- | --- |
| `docs/architecture/` | Explaining system design contracts, boundaries, invariants, or architecture-level extension seams. | Giving runtime operational steps or contributor implementation checklists. |
| `docs/contributors/` | Explaining how contributors should safely implement, extend, or refactor code. | Recording formal architecture decisions or live operations runbooks. |
| `docs/operations/` | Providing runbooks, diagnostics, incident handling, or admin operations. | Capturing architecture rationale or long-term design contracts. |
| `docs/baselines/` | Capturing historical snapshots, migration inventories, and completion baselines. | Serving as the canonical source for current behavior. |
| `docs/adr/` | Routing, templates, and ADR system navigation. | Housing architecture references or runtime procedures. |
| `docs/adr/records/` | Storing individual ADR decision files with status, alternatives, and supersession history. | Providing broad architecture explanation without a specific decision record. |
| `docs/context/` | Providing shared taxonomy, glossary, and AI/human cross-domain context packs. | Publishing operational instructions or contributor coding workflows. |
| `docs/prompts/` | Storing reusable prompt templates and prompt-engineering helpers. | Defining architecture or operational authority for the product itself. |
| `docs/ui/` | Documenting UI behavior contracts, UX states, and frontend interaction rules. | Describing non-UI system architecture or backend operations. |

## Simple Decision Flow

1. Is this document a formal architecture decision with status and alternatives?
   - Yes: place it in `docs/adr/records/`.
   - No: continue.
2. Is this document mostly a system design contract or architecture explanation?
   - Yes: place it in `docs/architecture/`.
   - No: continue.
3. Is this document mostly runtime/admin operation guidance, diagnostics, or troubleshooting?
   - Yes: place it in `docs/operations/`.
   - No: continue.
4. Is this document mostly implementation workflow guidance for contributors/agents?
   - Yes: place it in `docs/contributors/`.
   - No: continue.
5. Is this document a historical baseline, migration snapshot, or completion artifact?
   - Yes: place it in `docs/baselines/`.
   - No: continue.
6. Is this document a taxonomy/context pack meant to help both humans and AI reasoning?
   - Yes: place it in `docs/context/`.
   - No: continue.
7. Is this document a prompt template or prompt-workflow helper?
   - Yes: place it in `docs/prompts/`.
   - No: continue.
8. Is this document primarily a UI behavior/UX contract?
   - Yes: place it in `docs/ui/`.
   - No: put it in the closest authoritative area above and link from secondary areas instead of duplicating content.

## ADR Thresholds For Planned Changes

### ADR Required

- The planned change introduces or revises a durable architectural invariant.
- The planned change modifies control-plane design or authority boundaries between hosts/services.
- The planned change changes workspace model guarantees (scope, tenancy, lifecycle, or sharing boundaries).
- The planned change changes security trust boundaries or identity/authorization enforcement model.
- The planned change sets or reverses storage policy direction (durability, persistence authority, sync/replication, retention).
- The planned change commits to studio/system modeling semantics reused across subsystems.

### ADR Recommended

- The planned change introduces a cross-domain tradeoff likely to be debated again without durable rationale.
- The planned change introduces a platform-level extension seam or abstraction that other work will follow.
- The planned change is long-lived and high-impact even if rollback remains feasible.

### ADR Unnecessary

- The planned change only clarifies existing accepted ADR intent without changing the decision.
- The planned change is implementation-local and preserves existing architecture contracts.
- The planned change belongs to operational runbooks, diagnostics, or incident procedures.
- The planned change is a baseline, migration inventory, or completion handoff snapshot.

### Placement For Non-ADR Changes

- Architecture contract and invariant details -> `docs/architecture/`.
- Contributor implementation workflow and extension rules -> `docs/contributors/`.
- Operational procedure and troubleshooting -> `docs/operations/`.
- Historical baseline or migration snapshots -> `docs/baselines/`.
- Shared taxonomy/context for humans and AI -> `docs/context/`.

## Placement Examples

- Architecture explanation example:
  - Topic: queue arbitration invariants and layer boundaries.
  - Placement: `docs/architecture/`.
- Runbook example:
  - Topic: restore a failed node enrollment path in production-like runtime.
  - Placement: `docs/operations/`.
- Historical baseline example:
  - Topic: Story completion snapshot or migration inventory from a prior architecture state.
  - Placement: `docs/baselines/`.
- ADR example:
  - Topic: decide between event-sourcing and state-snapshot persistence with accepted outcome.
  - Placement: `docs/adr/records/`.
- AI-context document example:
  - Topic: taxonomy/glossary that helps agents and humans navigate cross-domain terms consistently.
  - Placement: `docs/context/`.

## Anti-Patterns to Avoid

- Anti-pattern: putting a runbook in `docs/architecture/` because it mentions architecture terms.
  - Correct action: move run steps to `docs/operations/` and link to architecture contracts.
- Anti-pattern: writing contributor implementation guardrails inside `docs/operations/`.
  - Correct action: place implementation workflow guidance in `docs/contributors/`.
- Anti-pattern: storing historical completion snapshots in active router or architecture docs.
  - Correct action: place historical snapshots in `docs/baselines/` and link from active docs.
- Anti-pattern: copying the same authoritative guidance across multiple folders.
  - Correct action: keep one authoritative source and link from related areas.
- Anti-pattern: placing AI-context taxonomy notes directly in feature runbooks.
  - Correct action: place shared context in `docs/context/` and reference it from runbooks or contributor guides.

## Consistency Rules for Humans and AI Agents

- Choose folder placement by the document's primary role, not by where related docs already exist.
- If a document spans multiple roles, keep a single authoritative copy and add links for discoverability.
- Start from `docs/context/templates/README.md` and select the matching `doc_type` template before drafting new docs.
- Apply the standard metadata header contract defined in `docs/context/documentation-metadata-header.md`.
- Use `doc_type`, `status`, and `authoritativeness` values exactly as defined in `docs/context/documentation-taxonomy.md`.
- Maintain `.md` and `.ai.md` companions together when both are required by local conventions.
- Keep top-level router READMEs (`Purpose`, `Belongs Here`, `Does Not Belong Here`, `Start Here`) aligned as docs evolve.
