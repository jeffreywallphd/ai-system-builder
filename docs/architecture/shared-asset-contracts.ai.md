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
- Taxonomy-driven bounded contract projections now cover all planned Direction 5 composite roles with truthful baselines (`workflow`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`) plus system roles (`app-template`, `system`) for recursive system composition foundations, while preserving existing atomic role coverage.
- Projection remains combination-aware (structural/semantic/behavior). Unsupported taxonomy combinations intentionally return no projection rather than fabricating speculative contracts.
- Canonical operational reads expose optional `contract` where resolver-backed projection is available (workflow-definition, installed-model, base-model, and execution-artifact when backing adapters are available).
- Agent Studio output/memory reference UX reuses canonical asset-management read seams (asset detail + version chain lineage) instead of adding agent-only output contract surfaces.
- Direction 5 atomic studios now reuse this seam directly for publish-time enforcement and default metadata in the shared shell:
  - Model Studio + Dataset Studio use `atomic/*/none` contract projections.
  - Tool Studio uses `atomic/tool/(conditional|deterministic)` projections.
- Shared Studio Shell publish-time enforcement now uses the same resolver seam for composite consistency checks (taxonomy shape + derivable/compatible contract), rather than introducing a separate composite enforcement path.
- System Studio contract projection now extends the same shared resolver seam with bounded recursive projection (`resolveSystemContract`) so system contracts truthfully reflect explicit system I/O/parameters, child bindings, and nested-system topology without creating a parallel contract model.
- System Studio now has first-class interface/config authoring operations (`updateSystemInterfaces`, `updateSystemParameters`) so explicit system inputs/outputs/parameters/default values persist through the real draft/update/validate/publish/reload path and are consumed directly by recursive contract projection.
- System Studio now also includes bounded execution metadata authoring (`updateSystemExecutionMetadata`) for runtime/environment hints, orchestration posture, publish/export metadata, execution profile metadata, and operational ownership metadata; this remains metadata-only and does not introduce a parallel runtime/deployment stack.
- Registry/system detail lineage surfaces now make system version lineage explicit with bounded nested-system/child-version reference alignment (`includedInUpstream`) so recursive system-of-systems derivation remains deterministic and grounded in canonical version/upstream truth.
- System publish enforcement now extends the same shared studio-shell enforcement seam with bounded recursive checks for system child references/contracts, binding endpoint compatibility, and recursion cycle/depth safety before publish.
- Tool Chain Studio now reuses this same composite publish-consistency seam (`tool-chain`/`deterministic`) and the shared taxonomy-driven contract projection (`executionOrdering=sequential`) for draft authoring and publish gating.
- Cross-studio end-to-end consistency tests now verify contract coherence through create/update/validate/publish/reload over real service/bridge/backend/application/SQLite seams.

## Architectural intent
- Keep changes incremental, inner-layer-first, and adapter-driven.
- No parallel agent contract architecture.
- No system-composer UI in this slice.
- Direction 5 atomic studio slices now consume taxonomy-driven atomic contract projection for Prompt Template, Embedding Index, and Config Profile (`atomic/prompt-template/none`, `atomic/embedding-index/none`, `atomic/config-profile/none`) through shared shell metadata + publish-enforcement seams.

## Implementation status snapshot (Direction 5 through stories 5.24)
- Fully implemented now: shared taxonomy-driven contract projection for implemented atomic/composite studios, shared composite publish-consistency enforcement, and composite-to-atomic interop validation through shared dependency + taxonomy/contract seams.
- Fully implemented now: bounded System Studio authoring/publish orchestration uses recursive system contract projection through shared Studio Shell seams, and registry detail/lineage projections surface system child/nested-version lineage alignment (`includedInUpstream`) for published system versions.
- Partially implemented / bounded: projections are baseline authoring/publish-gating contracts, not a full runtime behavior-contract system.
