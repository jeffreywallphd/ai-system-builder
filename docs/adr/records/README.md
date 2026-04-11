# ADR Records Home

## Audience
- Engineers writing or updating Architecture Decision Records.
- Reviewers validating decision status and supersession history.

## Purpose
- Canonical storage location for individual ADR files.

## ADR Record Contract
- Place all ADR decision files in this folder.
- Use `adr-<NNN>-<kebab-case-title>.md` for human docs and `adr-<NNN>-<kebab-case-title>.ai.md` for AI companions.
- Keep decision numbers unique and increasing over time; do not renumber historical records.
- Track supersession with metadata and links in the ADR body.
- Include every required section from the standard ADR template; do not remove required headings.
- Use optional sections only when relevant; `Supersession` becomes required when replacement relationships exist.

## Authoring Guidance
- Use [ADR Authoring Guide](./authoring-guide.md) for concise, decision-focused writing standards and good/bad examples.
- Keep that guide complementary to the template: the template defines section shape, the guide defines quality and signal.

## ADR Status Taxonomy
- `proposed`: pending review and not yet architecture authority.
- `accepted`: approved and authoritative for current direction.
- `superseded`: replaced by a newer accepted ADR.
- `deprecated`: retained for legacy compatibility but not for new decisions.

## ADR Review Tier Taxonomy
- `routine`: standard architecture review depth for ADRs that do not alter high-risk boundaries.
- `heightened`: stronger cross-domain review depth for ADRs that alter high-risk boundaries (security/trust, runtime authority, or tenancy/isolation).
- Store review tier in ADR frontmatter as `review_tier`.
- High-risk ADRs must include `## Review Expectations` so reviewers can verify required evidence quickly.

## ADR Lifecycle Handling
- Amend existing ADRs only when the decision itself is unchanged.
- Publish a new ADR when architectural intent changes in a way future work must follow.
- For full replacement: set old ADR `decision_status: superseded`, set old `superseded_by`, and set new `supersedes`.
- For partial revision: create a focused ADR for the changed scope and keep old ADR `accepted` or `deprecated` with explicit scope notes.
- Keep old/new links bi-directional so maintainers can find the currently authoritative decision quickly.

## ADR Index and Sorting Rules
- Keep `docs/adr/records/adr-registry.json` as the canonical ADR discovery registry.
- Keep `records` entries sorted by `adrNumber` ascending.
- Keep each registry entry synchronized with ADR frontmatter fields (`adr_number`, `decision_status`, `decision_date`, and title).
- Keep each ADR listed once with both human and AI paths.
- Keep registry entries current when status changes (especially `superseded` and `deprecated`).
- Keep `discoveryIndex` entries synchronized with the registry `records` list.

## ADR Validation
- Run `npm run docs:validate:adr` before merging ADR changes.
- The validator checks required ADR sections, required metadata, and identifier consistency across filename, registry, frontmatter, and H1.
- It also checks `.md` and `.ai.md` ADR pairs for metadata alignment to reduce silent drift.
- It validates `review_tier` metadata and enforces heightened-review guardrails for high-risk ADR domains.
- It validates ADR cross-references so obvious broken paths are caught in highest-value paths:
  - `## Related Documentation` links inside ADR records.
  - `## Related ADRs` links inside architecture docs.
  - `## Authoritative Docs` ADR links inside context packs.
  - ADR references in `docs/adr/records/README.md` and `docs/adr/records/README.ai.md` against `adr-registry.json`.

## ADR Rollout Boundaries
- Initial ADR system scope is intentionally bounded and not exhaustive.
- Use [ADR System Rollout Boundaries and Future Expansion Areas](./rollout-boundaries.md) for current coverage, known gaps, and extension guidance.

## Current Index
Canonical source: `docs/adr/records/adr-registry.json`

| ADR | Decision Status | Review Tier | Decision Date | Title | Related Domains | Summary | Path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | accepted | heightened | 2026-04-11 | Single Authoritative Control Plane | control-plane, runtime-host-composition, orchestration | Single authoritative server-host control plane for lifecycle mutations and orchestration truth. | `docs/adr/records/adr-001-single-authoritative-control-plane.md` |
| 002 | accepted | heightened | 2026-04-11 | Workspace-Centered Tenancy and Resource Ownership | workspace-tenancy, ownership, authorization | Workspace identity is the primary tenancy boundary, including private resources as workspace-scoped policy posture. | `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md` |
| 003 | accepted | routine | 2026-04-11 | Storage as Managed Platform Resource | storage, platform-resource-management, provisioning | Storage is a managed platform capability governed by lifecycle, policy, and access contracts. | `docs/adr/records/adr-003-storage-as-managed-platform-resource.md` |
| 004 | accepted | routine | 2026-04-11 | Studios as Views Over Shared System and Asset Model | studio-composition, shared-model, ui-handoff | Studios remain bounded UX views over shared system/asset contracts rather than independent model authorities. | `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md` |
| 005 | accepted | heightened | 2026-04-11 | Trust, Identity, and Security Boundary Enforcement | identity-security, authorization, transport-trust | Security boundaries enforce separate fail-closed gates for authentication, trust, authorization, and auditability. | `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md` |
| 006 | accepted | heightened | 2026-04-11 | Policy-Aware Scheduling and Controlled Execution | scheduling, execution, policy-enforcement | Scheduling and execution remain policy-aware and centrally controlled with explainable outcomes and guarded retries. | `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md` |

## Start Here
- [ADR Router](../README.md)
- [ADR Discovery Registry](./adr-registry.json)
- [ADR System Rollout Boundaries and Future Expansion Areas](./rollout-boundaries.md)
- [ADR Authoring Guide](./authoring-guide.md)
- [ADR Template](../../context/templates/adr.template.md)
- [Architecture Router](../../architecture/README.md)
