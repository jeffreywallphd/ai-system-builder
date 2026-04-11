---
title: ADR-004 Studios as Views Over Shared System and Asset Model
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 004
decision_status: accepted
decision_date: 2026-04-11
review_tier: routine
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/studio-shell/StudioShellDomain.ts
  - src/application/studio-shell/DefaultStudioShellApplicationService.ts
  - src/application/studio-entry/ContextualStudioInitializer.ts
  - src/application/studio-handoff/StudioHandoffOrchestrationService.ts
  - src/application/studio-handoff/SystemStudioHandoffIntegrationService.ts
  - src/domain/system-studio/SystemAssetDomain.ts
  - src/ui/routes/StudioHandoffContract.ts
  - src/ui/pages/StudioShellPage.tsx
  - src/ui/studio-shell/StudioShellExtensions.ts
---

# ADR-004: Studios as Views Over Shared System and Asset Model

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio treats studios as bounded authoring/interaction views over one shared underlying system and asset model, not as disconnected tools with separate truth models. Studio-specific UX modes may shape presentation and workflow, but read/write behavior must run through shared domain/application contracts for assets, workflows, systems, and handoff semantics. Studio implementations must preserve canonical identity, lifecycle, lineage, and compatibility behavior across surfaces.

## Context and Problem Statement

The repository includes multiple studio surfaces (workflow, system, data, selector-driven cross-studio launches, and return/resume flows) that all touch overlapping entities. Without an explicit decision record, implementation can drift into studio-local models and route-local orchestration shortcuts, creating fragmented truth and repeated reconciliation.

This ADR records that studios are composition views over shared platform models, so contributors and AI agents extend common seams instead of creating studio-specific architecture forks.

## Decision Drivers

- Preserve one authoritative system/asset model across studio surfaces.
- Prevent drift from studio-local contract variants and duplicate lifecycle semantics.
- Keep cross-studio handoff, return, and reopen behavior consistent and inspectable.
- Maintain domain/application authority boundaries while allowing studio-specific UX composition.
- Improve extensibility so new studios can be added without parallel persistence/identity/compatibility models.

## Considered Options

1. Studios as views/modes over a shared system and asset model (accepted): keeps identity, lifecycle, lineage, compatibility, and handoff contracts authoritative in shared seams while allowing studio-specific UX.
2. Studios as disconnected tools with local models (rejected): speeds isolated iteration but introduces conflicting truth, brittle handoff behavior, duplicated validation, and costly reconciliation.
3. Hybrid model with optional studio-local forks (rejected): eases short-term migration but leaves authority ambiguous and encourages long-term drift.
4. Single monolithic studio with no bounded modes (rejected): centralizes model truth but harms UX clarity and task-focused authoring ergonomics.

## Chosen Approach

Studios are bounded composition surfaces (routes/pages/modes) that project and orchestrate shared domain/application contracts. Studio shell registration, selector contracts, and handoff contracts provide differentiation points for UX while preserving one underlying model.

Workflow and system authoring remain distinct user experiences, but definitions, compatibility checks, identity references, and lifecycle posture stay on shared contracts instead of studio-local payload formats. Cross-studio launch/return flows must carry canonical handoff context and rehydrate shared model references, not reconstruct truth from ad hoc route state.

## Consequences

- UI composition: studio pages stay focused on presentation and orchestration while shared contracts/services own durable model semantics.
- Workflow integration: workflow authoring, selector attachments, and return handling remain reference-consistent across studio transitions.
- System modeling: system assets remain first-class entities with stable identity/lifecycle/lineage regardless of which studio last edited them.
- Extensibility: new studios can be added as views by registering composition behavior and reusing shared contracts rather than building parallel model stacks.
- Tradeoff: studio delivery depends on shared seam evolution, which can add upfront coordination.
- Risk: legacy studio-local assumptions require deliberate migration toward shared model boundaries.

## Related Documentation

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/architecture/studio-handoff-contract.ai.md`
- `docs/architecture/shared-composition-taxonomy.ai.md`
- `docs/architecture/image-workflow-system-definition-layer.ai.md`
- `docs/architecture/image-system-domain-foundation.ai.md`
- `docs/architecture/asset-selector-framework.ai.md`
- `docs/context/packs/studio-and-system-composition.pack.ai.md`
- `docs/context/context-map.ai.md`

## Related Code Paths

- `src/domain/studio-shell/StudioShellDomain.ts`
- `src/application/studio-shell/DefaultStudioShellApplicationService.ts`
- `src/application/studio-entry/ContextualStudioInitializer.ts`
- `src/application/studio-handoff/StudioHandoffOrchestrationService.ts`
- `src/application/studio-handoff/SystemStudioHandoffIntegrationService.ts`
- `src/domain/system-studio/SystemAssetDomain.ts`
- `src/ui/routes/StudioHandoffContract.ts`
- `src/ui/routes/StudioReturnPayloadResolution.ts`
- `src/ui/pages/StudioShellPage.tsx`
- `src/ui/studio-shell/StudioShellExtensions.ts`
- `src/ui/studio-shell/asset-selector/AssetSelectorStudioLaunchService.ts`

## Follow-Up Actions

- Use this ADR as a review gate when studio work introduces model payloads, lifecycle fields, or identity semantics outside shared contracts.
- Keep studio/system architecture docs linked to this ADR under `## Related ADRs`.
- Track and migrate remaining studio-local state assumptions to shared model and handoff seams.
