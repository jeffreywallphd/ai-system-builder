# Shared Asset Contracts (Foundation Slice)

## Purpose
This note captures the minimal integration seam that complements shared taxonomy with a shared asset-contract model.

## Taxonomy vs contract
- **Taxonomy** classifies what an asset is (`structuralKind`, `semanticRole`, `behaviorKind`).
- **Asset contract** describes how an asset is used (input/output surface, configurable parameters, and optional execution metadata).

These concerns remain separate and compatible.

Specialized composite semantics remain explicit in these shared contracts: workflow = orchestrator, agent = decision unit, context-bundle = input preparer.

## Shared contract model
- Inner-layer contract types live in `domain/contracts/AssetContract.ts`.
- The model is intentionally compact:
  - input shape
  - output shape
  - public parameters/config surface
  - optional execution metadata

## Resolver/projection seam
- `application/contracts/CompositionAssetContractResolver.ts` projects contracts from existing entities without requiring broad entity rewrites.
- Current grounded projections include:
  - workflows
  - agents
  - tool capabilities
  - context packages
  - context recipes
- Bounded taxonomy-driven projections cover atomic dataset/model/config-profile roles and revised composite/system roles without creating a second contract system:
  - `dataset`
  - `model`
  - `config-profile`
  - `dataset-pipeline`
  - `training-recipe`
  - `tool-chain`
  - `app-template`
- Canonical-entity contract resolution now includes workflow definitions plus installed/base models and execution artifacts when matching repositories/catalogs are wired.
- Direction 5 atomic studios now use this same taxonomy-driven contract seam for authoring/publish enforcement:
  - Model Studio and Dataset Studio publish with `atomic/*/none` contract projections.
  - Tool Studio publish supports `atomic/tool/(conditional|deterministic)` projections.
- Cross-studio end-to-end consistency coverage now verifies that projected contracts remain stable through create/update/validate/publish/reload paths over shared shell seams.

## Canonical read integration seam
- Canonical operational reads now carry optional `contract` alongside canonical identity/taxonomy/provenance/dependency metadata.
- `CanonicalEntityReadResolver` is the preferred seam for reading taxonomy + contract together where available.
- Agent Studio output/memory asset exploration now reuses canonical asset-management reads (`loadAssetDetail`, `listVersionChain`) so run/session references stay asset-native and lineage-friendly instead of introducing agent-only output APIs.

## Scope boundaries
- This is an integration foundation only.
- It does **not** add a full system-composer UI, contract editor UI, or a parallel agent-only contract universe.
- Agents continue to extend the shared composition model and use the shared contract seam.
- Prompt/Embedding/Config Profile studios are not implemented yet in Direction 5 UI/application slices; only their taxonomy/contract groundwork exists in this shared seam.
