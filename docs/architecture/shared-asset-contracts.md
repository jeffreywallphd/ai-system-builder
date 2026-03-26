# Shared Asset Contracts (Foundation Slice)

## Purpose
This note captures the minimal integration seam that complements shared taxonomy with a shared asset-contract model.

## Taxonomy vs contract
- **Taxonomy** classifies what an asset is (`structuralKind`, `semanticRole`, `behaviorKind`).
- **Asset contract** describes how an asset is used (input/output surface, configurable parameters, and optional execution metadata).

These concerns remain separate and compatible.

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
- Canonical-entity contract resolution now includes workflow definitions plus installed/base models and execution artifacts when matching repositories/catalogs are wired.

## Canonical read integration seam
- Canonical operational reads now carry optional `contract` alongside canonical identity/taxonomy/provenance/dependency metadata.
- `CanonicalEntityReadResolver` is the preferred seam for reading taxonomy + contract together where available.

## Scope boundaries
- This is an integration foundation only.
- It does **not** add a full system-composer UI, contract editor UI, or a parallel agent-only contract universe.
- Agents continue to extend the shared composition model and use the shared contract seam.
