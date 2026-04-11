# AI Companion: ADR Records Home

## Audience
- AI assistants creating or updating ADR files.
- Engineers checking ADR naming and supersession rules.

## Purpose
- Canonical ADR file location and indexing rules for decision records.

## ADR Record Contract
- Place all ADR decision files in this folder.
- Use `adr-<NNN>-<kebab-case-title>.md` for human docs and `adr-<NNN>-<kebab-case-title>.ai.md` for AI companions.
- Keep decision numbers unique and strictly increasing; never renumber historical ADRs.
- Keep supersession metadata and replacement links current when statuses change.
- Keep all required sections from the ADR template in each record.
- Use optional sections when relevant; treat `Supersession` as required whenever replacement links are involved.

## Authoring Guidance
- Apply [ADR Authoring Guide](./authoring-guide.ai.md) to keep ADRs concise, decision-first, and durable.
- Use the guide for writing quality and the template for section contract.

## ADR Status Taxonomy
- `proposed`: pending review and not yet architecture authority.
- `accepted`: approved and authoritative for current direction.
- `superseded`: replaced by a newer accepted ADR.
- `deprecated`: retained for legacy compatibility but not for new decisions.

## ADR Lifecycle Handling
- Amend in place only when decision intent is unchanged.
- Create a new ADR when durable architecture direction changes.
- Full replacement flow: old ADR `decision_status: superseded` + old `superseded_by` + new `supersedes`.
- Partial revision flow: publish a scoped ADR for changed boundaries, keep old ADR `accepted` or `deprecated`, and document narrowed validity.
- Keep supersession links bi-directional so current authority is unambiguous for humans and assistants.

## ADR Index and Sorting Rules
- Keep `docs/adr/records/adr-registry.json` as the canonical ADR discovery registry.
- Keep `records` entries sorted by `adrNumber` ascending.
- Keep each registry entry synchronized with ADR frontmatter fields (`adr_number`, `decision_status`, `decision_date`, and title).
- Keep each ADR listed once with both human and AI paths.
- Keep registry entries current when status changes (especially `superseded` and `deprecated`).
- Keep `discoveryIndex` aligned with the `records` list for deterministic ADR routing.

## ADR Validation
- Run `npm run docs:validate:adr` before merging ADR updates.
- The validator checks required ADR sections, required metadata, and identifier consistency across filename, registry, frontmatter, and H1.
- It also checks `.md` and `.ai.md` ADR pairs for metadata alignment to prevent quiet drift.

## Current Index
Canonical source: `docs/adr/records/adr-registry.json`

| ADR | Decision Status | Decision Date | Title | Related Domains | Summary | Path |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | accepted | 2026-04-11 | Single Authoritative Control Plane | control-plane, runtime-host-composition, orchestration | Single authoritative server-host control plane for lifecycle mutations and orchestration truth. | `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md` |
| 002 | accepted | 2026-04-11 | Workspace-Centered Tenancy and Resource Ownership | workspace-tenancy, ownership, authorization | Workspace identity is the primary tenancy boundary, including private resources as workspace-scoped policy posture. | `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md` |
| 003 | accepted | 2026-04-11 | Storage as Managed Platform Resource | storage, platform-resource-management, provisioning | Storage is a managed platform capability governed by lifecycle, policy, and access contracts. | `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md` |
| 004 | accepted | 2026-04-11 | Studios as Views Over Shared System and Asset Model | studio-composition, shared-model, ui-handoff | Studios remain bounded UX views over shared system/asset contracts rather than independent model authorities. | `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md` |
| 005 | accepted | 2026-04-11 | Trust, Identity, and Security Boundary Enforcement | identity-security, authorization, transport-trust | Security boundaries enforce separate fail-closed gates for authentication, trust, authorization, and auditability. | `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md` |
| 006 | accepted | 2026-04-11 | Policy-Aware Scheduling and Controlled Execution | scheduling, execution, policy-enforcement | Scheduling and execution remain policy-aware and centrally controlled with explainable outcomes and guarded retries. | `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md` |

## Start Here
- [ADR Router](../README.ai.md)
- [ADR Discovery Registry](./adr-registry.json)
- [ADR Authoring Guide](./authoring-guide.ai.md)
- [ADR Template](../../context/templates/adr.template.ai.md)
- [Architecture Router](../../architecture/README.ai.md)
