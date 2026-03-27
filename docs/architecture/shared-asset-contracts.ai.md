# AI Companion: Shared Asset Contracts (Foundation Slice)

## Why this exists
- Shared taxonomy already answers **what an asset is**.
- Shared contracts now answer **how that asset is used**.
- Specialized composite semantics are explicit in shared contract projections: workflow = orchestrator, agent = decision unit, context-bundle = input preparer.

## Core distinction
- Taxonomy = classification (`structuralKind`, `semanticRole`, `behaviorKind`).
- Contract = interaction surface (input/output/config parameters + optional execution metadata).

## Where to look
- Contract model: `domain/contracts/AssetContract.ts`
- Contract projection seam: `application/contracts/CompositionAssetContractResolver.ts`
- Canonical integration seam: `application/assets-system/CanonicalEntityReadResolver.ts`

## Current grounded coverage
- Workflow, agent, tool capability, context package, and context recipe contract projections are supported.
- Taxonomy-driven bounded contract projections now cover revised roles where concrete adapters may not yet exist: `config-profile`, `dataset-pipeline`, `training-recipe`, `tool-chain`, and `app-template`.
- Canonical operational reads expose optional `contract` where resolver-backed projection is available (workflow-definition, installed-model, base-model, and execution-artifact when backing adapters are available).
- Agent Studio output/memory reference UX reuses canonical asset-management read seams (asset detail + version chain lineage) instead of adding agent-only output contract surfaces.

## Architectural intent
- Keep changes incremental, inner-layer-first, and adapter-driven.
- No parallel agent contract architecture.
- No system-composer UI in this slice.
