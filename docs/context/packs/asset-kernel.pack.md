# Context Pack: Asset Kernel

- Pack name: `asset-kernel`

## Purpose

- Keep future prompts aligned to the canonical Asset Kernel vocabulary and Phase 2A implementation sequence.
- Prevent parallel models for assets, artifacts, resources, UI components, workflows, tools, pages, systems, generated outputs, previews, Hugging Face objects, and AI-readable context.

## Use When

Read this pack for tasks involving:

- assets, asset definitions, asset instances, asset bindings, or asset compositions,
- systems, subsystems, features, pages, workflows, tools, UI components, or tests as composable assets,
- resource-backed assets, generated outputs as assets, previews, artifacts, resources, models, datasets, images, documents, or Hugging Face objects as asset/resource backings,
- AI-readable asset context,
- asset configuration,
- persistence adapters or resource-backed mapping.

Prompt 7 has added pure application-layer validation services under `modules/application/services/asset` for definitions, instances, bindings, and compositions. Prompt 8 has added application-layer repository ports under `modules/application/ports/asset` and use cases under `modules/application/use-cases/asset` for registering/creating, reading, listing, updating, and validating asset definitions, instances, and compositions. Prompt 9 adds minimal local JSON persistence adapters under `modules/adapters/persistence/asset` behind those ports: text filters are simple value-based substring checks, manifests check schema version/store kind without migrations, and writes accept JSON-compatible records only. Prompt 10 adds resource-backed mapping contracts under `modules/contracts/asset` and pure application helpers under `modules/application/services/asset`; external repository object paths stay provider metadata, primary backing links use safe `asset-resource-backing` references, and mapping helpers are deterministic contract mappers, not runtime, transport, UI, automatic-composition, prompt-assembly, retrieval, embedding, AI-generation, artifact storage, or durable resource-backed registration behavior. Phase 2B Prompt 3 adds an application-owned built-in asset definition seeding service under `modules/application/services/asset`; seeds are application metadata descriptors, not shared contract families or UI route/component identities, and the service validates before save, persists only missing valid definitions, is idempotent only for matching seed ID, seed version, and fingerprint, skips user/custom or conflicting definitions without overwrite, and returns structured sanitized diagnostics. Phase 2B Prompt 4 adds the initial application-owned built-in catalog under `modules/application/services/asset/built-ins` with stable `builtin.*` seed/definition IDs, explicit `1.0.0` versions, concise AI context/configuration/ports, shared runtime-capability requirements for runtime-backed built-ins, resource-backed descriptor definitions, `builtin.artifact` as a generic `data-source` resource-backed definition distinct from document-specific `builtin.document`, and a model-publishing limitation that execution is unavailable/not implemented until runtime support exists. Phase 2B is now stabilized internally: local Asset Kernel persistence, validated/idempotent seeding, version-aware built-in definitions, computed resource-backed internal views, the read-only `AssetRegistryReadFacade` with repository-supported filter forwarding plus diagnostic facade-side filtering for unsupported query shapes, centralized application-owned safe metadata/view sanitization, and host-private `composeInternalAssetRegistry` diagnostics that omit seed catalog content are available for internal consumers only. Phase 2C now exposes read-only definition transport wrappers and desktop/thin-client Asset Library pages through API/preload clients and shared UI helpers only; UI code must not consume local persistence, host composition, or application services directly, and generated outputs/external repository objects/previews remain non-assets until finalized/imported/registered.

## Canonical Asset Terminology

- `Asset`: reusable/composable semantic unit known to AI System Builder; may represent structure, behavior, interface, data, instructions, resources, compositions, or logic containers.
- `AssetDefinition`: reusable, versioned blueprint/template for a composable building block.
- `AssetInstance`: configured use of an asset definition in a specific composition or system context.
- `AssetBinding`: typed connection between instances, ports, resources, runtime capabilities, storage objects, or external repository objects.
- `AssetComposition`: validated assembly of configured instances and bindings into a feature, workflow, page, subsystem, system, or system-of-subsystems.
- `AssetReference`: stable transport-neutral reference to a definition, definition version, instance, composition, reusable asset requirement, asset-resource backing, or referenceable resource/artifact object.
- `AssetConfiguration`: definition-owned configuration surface plus instance-selected values.
- `AssetAiContext`: structured AI-readable metadata for retrieval, validation support, and prompt assembly.
- `AssetPort`: formal input/output/event/control/action/data/error connection point.
- `AssetCompositionRule`: machine-checkable parent/child, dependency, incompatibility, ordering, cardinality, or binding rule.
- `AssetValidationIssue`: structured application-layer validation result whose `details` are JSON-compatible metadata. General and composition validation summaries share `not-validated`, `valid`, `valid-with-warnings`, `invalid`, and `unknown`.
- `AssetLifecycleStatus`: `draft`, `validated`, `published`, `deprecated`, `archived`, or `failed-validation`.
- `AssetProvenance`: creation/source/derivation/authorship/review metadata that must avoid secrets and unsafe implementation details.
- `AssetRequirement`: first-class declarative runtime/host/permission/safety/resource/artifact/external-provider requirements owned inline by definitions; external reusable requirement references can use `requirementRefs` later.
- `Resource-backed Asset`: asset whose semantic value is backed by a resource or artifact.

Outside-but-referenceable concepts:

- `Resource`: addressable content/data object.
- `Artifact`: stored, managed resource with metadata, storage identity, provenance, and possibly external repository identity.
- `Generated Output`: runtime-task-produced resource/artifact that becomes reusable only after finalization/registration.
- `Preview`: derived readable representation of a resource-backed asset or artifact.
- `External Repository Object`: provider object such as a Hugging Face repo/file until registered/imported as a resource-backed asset.

## Architecture Boundaries

- Assets are broader than stored files/artifacts.
- Artifacts/resources can back assets but are not the full asset model.
- Definitions, instances, bindings, and compositions are separate concepts.
- Logic containers describe behavioral/composition assets; do not add a separate `logic-container` type unless a later canonical doc does so.
- AI-readable context and machine-composable contracts are complementary; neither replaces the other.
- Runtime requirements reference shared `RuntimeCapabilityId` values and do not duplicate runtime readiness snapshots, runtime task statuses, or provider lifecycle concepts.
- Asset metadata/details use JSON-compatible `AssetMetadata` values for future persistence/transport and must not embed raw bytes, buffers, streams, filesystem handles, local file paths, temp paths, secrets, tokens, command lines, raw environment values, stack traces, runtime objects, or raw adapter details.
- Transport/UI-specific asset models are not allowed.
- Preserve clean architecture placement: contracts in `modules/contracts`, application validation/use cases in `modules/application`, adapters in `modules/adapters`, host wiring in `modules/hosts`, UI in apps/modules UI areas.

## Required Docs to Inspect

- `docs/architecture/asset-kernel.md`
- `docs/adr/ADR-0016-asset-kernel-terminology-and-architecture-baseline.md`
- `docs/adr/ADR-0005-builder-core-platform-capabilities-and-user-composable-assets.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/module-dependency-rules.md`
- `docs/architecture/persistence-and-storage.md` when artifacts/resources/storage are involved
- `docs/architecture/runtime-model.md` when runtime capabilities/readiness are involved
- `docs/architecture/host-model.md` when host/permission placement is involved
- `docs/adr/ADR-0015-security-architecture-and-policy-boundaries.md` when metadata exposure or permission policy is involved

## Anti-Drift Rules

- Do not rename existing artifact/model/dataset/image concepts during Phase 2A.
- Do not treat generated outputs as reusable assets until they are finalized/registered as artifacts or resource-backed assets.
- Do not treat Hugging Face repo objects as assets until registered/imported as resource-backed assets.
- Do not create renderer-, IPC-, API-, image-generation-, workflow-, or provider-specific asset vocabularies.
- Do not duplicate persistence/storage/runtime readiness/task-registry concepts inside asset contracts.
- Keep the initial kernel small and extensible; do not implement every example asset type at once.

## Implementation Sequence Reminders

1. Prompt 1 — Asset Kernel audit and plan.
2. Prompt 2 — ADR and canonical terminology baseline.
3. Prompt 3 — Core Asset Kernel contracts: first shared `modules/contracts/asset` family only.
4. Prompt 4 — Detailed asset configuration contracts.
5. Prompt 5 — Detailed asset AI-context contracts.
6. Prompt 6 — Detailed asset ports, binding compatibility, and composition-rule contracts.
7. Prompt 7 — Asset validation services for definitions, instances, bindings, and compositions.
8. Prompt 8 — Asset registry and application ports.
9. Prompt 9 — Local persistence adapter for definitions, instances, compositions, and bindings.
10. Prompt 10 — Resource-backed asset mapping and final Phase 2A regression.

Prompt 7 validation services are pure/deterministic and transport/UI-neutral. They validate configuration structure, AI-context completeness, port/binding compatibility, composition structure, lifecycle/provenance, dependencies, and declared requirements; they do not execute workflows, query runtime readiness, start runtimes, access filesystem/network, call LLMs, or persist anything.

Phase 2B Prompt 5 status: `modules/contracts/asset` includes the transport/UI-neutral `AssetResourceBackedView` read model, and `modules/application/services/asset/asset-resource-backed-view.service.ts` computes internal resource-backed views from existing artifacts, finalized image assets, generated outputs, datasets, model inventory records, document-like artifact descriptors, external/artifact repository objects, Hugging Face-like files, and previews. The views are not persisted durable mappings, do not refactor source feature ownership, do not create asset instances automatically, and add no API/IPC/preload/renderer/thin-client/host public surface. Generated outputs are generated-output views until finalized/registered; external repository objects are external-object views until imported/registered; previews are preview views only. The mapper is pure application code and performs no filesystem/network/runtime/AI/file parsing/OCR/preview generation behavior. Phase 3 Prompt 2 moves the provider seam to `modules/application/ports/asset`, adds structured provider list results/diagnostics, and adds a read-only aggregate provider foundation. Phase 3 Prompt 3 adds the first concrete application-layer artifact/document provider over the artifact browser metadata list seam only: it computes sanitized artifact/document views when injected, uses metadata-only document detection, omits storage paths/unsafe keys/secrets/raw/blob values, reads no bytes/content, creates no asset instances, persists no mappings, and leaves host wiring/public transport/UI exposure deferred. Phase 3 Prompt 4 adds the image/generated-output provider with the same computed read-model posture: finalized image assets require an explicit descriptor-only list seam, missing image seams produce safe unsupported diagnostics, injected generated-output descriptors remain unfinalized/unregistered `generated-output` views, prompt text is hidden by default, and no image bytes/base64/content/previews, runtime task reads, finalization, asset instance creation, durable mappings, or host/API/IPC/UI wiring are introduced. Phase 3 Prompt 6 adds the external repository object provider over explicitly injected metadata-only descriptor sources; external objects remain not imported/localized/registered assets, missing seams return safe diagnostics, and the provider must not browse Hugging Face/artifact repositories, call provider clients, read tokens/cache/object bytes, publish/import/localize, persist mappings, or add host/API/IPC/UI exposure. Phase 3 Review B hardens the pre-host-wiring provider baseline: cross-family aggregate output is deterministic and bounded, duplicate public view IDs are diagnosed with first-provider-wins behavior, unsupported/deferred providers and source failures return sanitized diagnostics, and all implemented family providers remain computed read-only descriptor projections. External `provider` labels including `local`, `http`, and `custom` are metadata labels only and grant no filesystem, network, token, provider-client, import/localize/publish, registration, runtime, or byte-read authority. Repository object paths are omitted from public output by default, even when repository-relative paths are safe descriptor input. Descriptor-source interfaces remain provider-local input seams unless later host wiring proves they should become application ports.

Prompt 8 status: `modules/contracts/asset` remains the shared contract family, `modules/application/services/asset` provides validation services over those contracts, `modules/application/ports/asset` defines repository interfaces for definitions, instances, compositions, and first-class bindings, and `modules/application/use-cases/asset` provides transport/UI-neutral application seams. Create/register/update use cases validate before save, validation-only use cases return reports without saving, read/list use cases do not revalidate by default, `bindingRefs` are structurally checked as `asset-binding` references, and composition validation context may resolve them through `AssetBindingRepositoryPort`, minimal local JSON persistence is available through Prompt 9 adapters, resource-backed mapping contracts/helpers are present after Prompt 10, and API/IPC/UI remain deferred. Deferred registry concerns remain: no automatic definition version incrementing, no conflict-detection policy beyond natural adapter behavior, no version-history service, no new delete use cases, no runtime readiness/guard calls, and no direct filesystem/network access from use cases.

Transport/UI work is deferred until after the kernel is proven through shared contracts, configuration, AI context, ports/composition, validation, registry ports, persistence, resource-backed mapping, and private host composition. Prompt 10 does not add workflow execution, graph execution, UI page routing, API/IPC exposure, runtime behavior, durable resource-backed mapping registration, or automatic composition; Phase 2B Prompt 2 adds the shared internal `composeLocalAssetKernel` helper only and no public asset surface.

## Explicit Non-Goals

- No TypeScript implementation when a prompt is documentation-only.
- No API/IPC/UI asset models before shared contracts stabilize.
- No persistence adapter outside `modules/adapters/persistence/asset`; local persistence stores records/metadata only and validation remains application-layer before save.
- No marketplace/plugin package registry, persistent task history, workflow execution store, scheduler/queue changes, runtime readiness changes, storage rewrite, or broad refactor in Phase 2A unless a later prompt explicitly changes scope.

## Prompt 9 local persistence checkpoint

- Local Asset Kernel persistence stores `AssetDefinition`, `AssetInstance`, `AssetComposition`, and `AssetBinding` records as JSON-compatible metadata behind application repository ports.
- The store layout is `asset-kernel/manifest.json`, `definitions.json`, `instances.json`, `compositions.json`, and `bindings.json`; the manifest currently declares `schemaVersion: 1`.
- Definition versions are keyed by `definitionId@version`; exact version references resolve exact versions and unversioned definition references resolve a deterministic latest version without auto-incrementing.
- The adapter does not store resource bytes, blob payloads, generated model/image/dataset bytes, secrets, filesystem handles, or raw adapter paths.
- Application use cases continue to validate before save; adapters do not duplicate the validation services.
- Phase 2B Prompt 2 adds `modules/hosts/shared/composition/composeLocalAssetKernel.ts` as a shared internal helper; it accepts a storage root and composes local repositories/use cases while returning path-safe diagnostics, and the adapter continues to own `<storageRoot>/asset-kernel/`.
- Phase 2B now composes `modules/hosts/shared/composition/composeInternalAssetRegistry.ts` inside desktop `registerArtifactUploadIpc` and server `registerApi`, using each host `storageRootDirectory` so records live under `<storageRootDirectory>/asset-kernel/`. Runtime roots must not be used for Asset Kernel records. The host seam is internal only: no asset API routes, IPC channels, preload methods, renderer UI, or thin-client clients are added. Built-in seeding remains explicit through `BuiltInAssetDefinitionSeedingService`; startup composition only initializes the local store/read facade. Resource-backed views are computed only through an injected safe read provider seam, are not durable mappings, and must not scan directories, call providers/network/runtimes, or read resource bytes.
- Phase 3 Prompt 7 injects a composed resource-backed provider aggregate into the internal registry for desktop/server hosts. The shared host helper wires only safe descriptor/read seams that are already composed: artifact browser metadata, finalized image asset descriptors, persisted model inventory records with model discovery disabled by provider policy, and persisted model publishing summaries. Dataset descriptors, generated-output descriptors, artifact-repo object descriptors, and artifact storage binding list sources remain unsupported/not wired when no safe seam exists, with sanitized diagnostics instead of host-invented discovery.
- Phase 3 Prompt 8 stabilizes the resource-backed provider baseline, and the final Phase 3 cleanup exposes it through read-only public API/IPC/preload/desktop Asset Library/thin-client Asset Library list/detail reads. Resource-backed views are computed, descriptor-only, sanitized, non-persistent read models exposed through the Asset Registry read facade when a safe provider aggregate is composed. Family implementation exists for artifact/document, image/generated-output, dataset/model, and external-repository object views, but host availability depends on the corresponding safe descriptor/read seam being wired; missing family seams return safe unsupported diagnostics. They do not create asset instances, persist mappings, register/import/finalize/localize/publish resources, scan storage, call providers/network/runtimes/task registries, use runtime roots for provider reads, or read bytes/content. Generated outputs remain unfinalized/unregistered, external repository objects remain unimported/unregistered, external provider labels do not authorize network/provider calls, and model discovery remains disabled.

## Phase 4 handoff

- Phase 4 is now the controlled mutation baseline, not a general asset editor. Asset Library browsing remains read-only and side-effect-free until a user confirms one of the approved mutation actions.
- Public mutation scope is limited to `asset.register-resource-backed-view`, `asset.finalize-generated-output`, `asset.import-external-repository-object`, and `asset.localize-external-repository-object`.
- Phase 4 Prompt 2 introduces a contracts-only controlled mutation foundation in `modules/contracts/asset`: explicit operation names for resource-backed registration, generated-output finalization, external-object import, and external-object localization; command base shapes with approval, actor, optional request/correlation/idempotency context; source identity/deduplication; provenance summaries; typed failures/results; and command-specific payloads that carry safe ids rather than raw provider/view/file payloads. No mutation behavior, application writes, provider/storage/runtime calls, public API/IPC/preload/UI surface, host wiring, migrations, or general create/update/delete/patch/edit asset editor contract is added.
- Phase 4 Prompt 3 adds an internal application use case for `asset.register-resource-backed-view`: it re-reads the source view by id, requires explicit confirmation, accepts only eligible descriptor-backed views, validates or safely infers an existing target definition, derives sanitized source identity/provenance, checks duplicate source identity before save, validates the constructed `AssetInstance`, and persists only Asset Kernel metadata/references through `AssetInstanceRepositoryPort`. It adds no API/IPC/preload/UI/host exposure, no generated-output finalization, no external import/localization, no source-system writes, and no resource bytes/content persistence.
- Phase 4 Prompt 4 adds an internal application use case for `asset.finalize-generated-output`: it re-reads the generated-output source by view id or generated-output id, requires explicit finalization confirmation plus filesystem-write approval, rejects unnecessary network/credential approval, accepts only completed generated image outputs, validates or safely infers an existing image target definition, finalizes through a narrow image/artifact application port, and persists only Asset Kernel metadata/references after finalization succeeds. It checks duplicates before and after finalization, can restore a missing `AssetInstance` when the image/artifact seam reports already-finalized safe metadata, returns retry-safe partial failures after image/artifact finalization, remains unexposed through API/IPC/preload/UI/host wiring, and keeps external import/localization deferred.
- Phase 4 Review A cleanup requires command guards to run before source reads, duplicate detection, target-definition lookup, finalization calls, or repository writes. The first mutation use cases require injected or centrally controlled safe `AssetInstance` ID generation, keep deduplication keys opaque, and sanitize retry-safe partial failures. Public mutation exposure remained deferred at that checkpoint, and external import/localization remained deferred to Prompt 5.
- Phase 4 Prompt 5 adds internal application use cases for external object import/localization. They accept only the Phase 4 external-object mutation commands, guard before all reads/lookups/port calls/saves, re-read the external object view by id, reject unsupported, preview-only, repository-level, unsafe, already-registered, or insufficiently identified sources, call only the application external object import/localization port for provider/network/storage effects, and register an `AssetInstance` only after safe internal resource references/backings exist. Phase 4 keeps import approval conservative for both `remote-reference` and `catalog-registration`: both require network, credential, filesystem-write, and partial-completion approval because the application port may validate provider metadata, use credentials, create durable catalog/storage state, or leave retryable partial state. They remain unexposed through API/IPC/preload/UI/host wiring; browsing and public Asset Library reads stay provider-call-free and read-only.
- Phase 4 Prompt 6 centralizes operation-specific mutation guard requirements in the application guard service. Existing Phase 4 mutation use cases must run those guards before source reads, identity derivation, duplicate/definition lookups, port calls, validation, ID generation, or saves; approval flags, actor/initiation metadata, request context, source identity, deduplication, provenance, and typed failures stay sanitized and consistent. Public API/IPC/preload/UI/host mutation exposure remained deferred until Prompt 7, and this is not a broad RBAC or policy-engine layer.
- Phase 4 Prompt 7 exposes only `asset.register-resource-backed-view`, `asset.finalize-generated-output`, `asset.import-external-repository-object`, and `asset.localize-external-repository-object` through thin API/IPC/preload wrappers. Transports perform shallow command checks, preserve safe request/correlation/idempotency metadata, map typed results/failures into existing envelopes, sanitize unexpected errors, and delegate only to the matching application use cases. No general asset editor/create/update/delete/patch surface, built-in seeding route, provider browse/download route, runtime execution route, or byte/content route is added.
- Phase 4 Prompt 8 adds controlled Asset Library UI actions for exactly those four workflows. Actions are view-kind eligible, confirmation-driven, command-only, and routed through public API/preload clients; they must not import application services/use cases or expose arbitrary create/update/delete/edit/seed/bulk/composition/runtime/provider-browse/dataset/model/image-generation behavior. UI action availability is advisory and conservative; application mutation guards remain authoritative. Resource-backed view diagnostics, mutation details, and transport errors rendered by the UI must stay sanitized and must not expose paths, tokens, prompts, workflow JSON, provider payloads, base64/data URLs, stacks, command lines, or environment values.

## Phase 5 handoff

- Recommended next phase: `Phase 5 - Foundational Built-In Asset Library and Composition Primitives`.
- Phase 5 should populate reviewed reusable default definitions for UI containers, panels/cards/sections, forms, field groups, text/number/select fields, checkboxes/radio groups, text areas, file uploads, validation messages, submit/cancel actions, tables/lists/detail views, status badges, loading/error/empty states, page layouts, feature shells, workflow step shells, and system/subsystem shells.
- Phase 5 Prompt 2 begins the contract-only asset pack vocabulary in `modules/contracts/asset`: asset pack identity/version/source metadata, source layers, trust/install status vocabulary, compatibility/dependency declarations, pack asset entries, non-destructive override rules, manifests, and resolver request/result diagnostics. System defaults should be representable as versioned system asset packs, but Prompt 2 adds no foundational asset definitions, pack services, resolver behavior, seeding/install behavior, import/export/sharing, marketplace/package-registry behavior, persistence adapters, host wiring, transport, or UI.
- Phase 5 Prompt 3 adds pure application-side pack catalog scaffolding in `modules/application/services/asset-packs`: the placeholder `system.foundation` manifest, foundation category constants, manifest builder, manifest validation, pack quality gates, and resolver-planning fixtures. It adds no real foundational definitions yet; UI/form/data/page/workflow/system primitive definitions begin in Prompt 4. Pack install/seeding/import/export/marketplace behavior remains deferred, and full resolver behavior remains deferred to Prompt 10.
- Phase 5 Prompt 4 adds the first real `system.foundation` entries: semantic UI structural primitives under `ui-structure` for container, section, panel, card, stack, grid, tabs, and collapsible section. Each is a declarative `AssetDefinition` with semantic configuration schema, AI context, ports, and composition guidance. They are not renderer components, CSS classes, visual editor nodes, UI implementation, workflow behavior, resolver behavior, public transport, seeding/install behavior, or provider/runtime calls. Dialog, drawer, toolbar, and navigation item remain deferred.
- Phase 5 Prompt 5 adds semantic form and field primitive entries under `forms-fields`: form, field group, text field, number field, text area, select field, checkbox field, radio group, validation message, submit action, and cancel action. These are pack entries with configuration schemas, AI context, ports, and composition guidance, and form composition may reference the Prompt 4 UI structural primitives. They are not renderer components or executable forms and do not implement validation processing, submission handling, file transfer handling, storage writes, visual editing, runtime behavior, seeding/install behavior, or resolver behavior. Date/time and file upload fields remain deferred; data display/state primitives are deferred to Prompt 6.
- Override rules are reference mappings for future effective assets. They must not overwrite or mutate system-owned `builtin.*` definition records; exact version references should be able to bypass overrides later, while semantic/default references may opt into override-aware resolution later.
- Build on Phase 4 controlled registration/seeding/versioning semantics. Do not jump to a free-form asset editor, workflow execution, canvas/graph editor, plugin marketplace, scheduler/queue, or automatic AI-generated asset library without explicit scope and review.
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The initial `/api/assets` surface is GET-only for asset definition list/detail/version reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Later Phase 2C prompts add matching read-only desktop IPC/preload and desktop/thin-client Asset Library clients/pages over the same definitions-only read surface.

## Phase 2C Prompt 3: read-only Asset Registry desktop IPC/preload foundation

Desktop IPC and preload now expose read-only Asset Registry definition list/read/version-read wrappers around the application read facade/read port. The handlers must not receive persistence adapters, host composition helpers, mutation use cases, seed services, runtime/storage adapters, provider clients, or resource scan seams. Later Phase 2C prompts add read-only renderer and thin-client clients/pages; mutations, seeding, import/finalize/register, resource scans, runtime execution, and provider calls remain deferred.

## Phase 2C cleanup checkpoint

Server API and desktop IPC/preload are now expected to stay in parity for the read-only surface: list definitions, read definition, read definition version, list resource-backed views, and read resource-backed view detail. Public query/input normalization belongs at the transport-adapter boundary before the facade is called, and malformed asset type/family/status, view kind, built-in, boolean, expansion, limit, or cursor inputs must fail validation instead of falling through to facade or persistence defaults.

The wrappers must depend only on `AssetRegistryDefinitionReadPort` or an equivalent narrow read-only facade. They must not import or receive `InternalAssetRegistryComposition`, local asset repositories/persistence, mutation use cases, built-in seeding services, resource scanners, runtime adapters, provider clients, provider objects, or host composition helpers. Asset instances, compositions, registry summaries, and mutation workflows remain deferred.

## Phase 2C Prompt 4: shared Asset Library read clients

Phase 2C now has shared UI-facing Asset Library read models and client helpers for the read-only definition and resource-backed view surface. `modules/ui/shared/asset-library` owns display-oriented cards/details, query/detail option types, mapper helpers, safe client errors, and result envelopes; desktop renderer and thin-client clients consume preload/API reads and expose that shared UI shape. They must not call application services, local persistence, host composition, runtime adapters, server route handlers, Electron IPC handlers, providers, or resource storage directly.

## Phase 2C Prompt 5: desktop Asset Library page

Desktop now includes a top-level `Assets` navigation item and a definitions-only read-only Asset Library page. The page uses the desktop preload-backed Asset Library client, supports read-facade query filters, renders safe definition cards/details, and keeps advanced AI context, configuration, ports, requirements, provenance, validation, and safe metadata sections collapsed by default when available. It must not seed, mutate, import, finalize, register, scan, execute, read bytes, call runtimes/providers, or bypass the desktop read-only client. Thin-client Asset Library UI, instances/compositions/resource-backed views, and registry summaries remain deferred.

## Phase 2C Prompt 6: thin-client Asset Library page

Thin-client now includes an `Assets` navigation item at `/assets` and a definitions-only read-only Asset Library page. The page uses the thin-client GET-only server API Asset Library client, supports read-facade query filters, renders shared sanitized definition cards/details, and keeps advanced AI context, configuration, ports, requirements, provenance, validation, and safe metadata sections collapsed by default when available. It must not seed, mutate, import, finalize, register, scan, execute, read bytes, call runtimes/providers, import application/host/persistence/API-route/desktop IPC internals, or bypass the read-only server API client. Desktop and thin-client Asset Library UIs remain separate read-only host-specific surfaces.

Phase 2C cleanup requires normal Asset Library selection to read detail without validation. Validation details are explicit/user-triggered read-only diagnostics through `includeValidation: true`, and shared UI mappers must render invalid or missing asset type/family/status as unknown display state rather than silently defaulting to valid Asset Kernel values.

Phase 2C Prompt 7 adds shared read-only advanced detail panels for AI-readable context, configuration summaries, ports, requirements, source/provenance, validation summaries only when already available or explicitly requested, and sanitized metadata. Advanced technical sections remain collapsed by default. Safe metadata rendering must omit unsafe path, blob/base64, raw payload, command, stack, env, token, secret, and auth values. Shared UI helpers/components under `modules/ui/shared/asset-library` must stay presentational/read-model only and must not import application services, host composition, persistence adapters, transport handlers, runtime/storage adapters, desktop preload internals, or thin-client API clients.

Phase 2C Prompt 8 stabilizes the definition public baseline without adding mutation; the final Phase 3 cleanup extends it with read-only resource-backed view list/detail visibility. Validation diagnostics are available only when already present or explicitly requested via `includeValidation`, normal list/detail reads do not validate automatically, advanced technical details remain collapsed by default, built-in seeding remains explicit/internal, and resource-backed views remain computed read models with no scan/byte-read/provider-call/runtime behavior.

## Phase 3 Review A resource-backed provider cleanup

- Provider detail reads should prefer safe direct descriptor read seams when the view id is reversible without exposing unsafe source ids. Image assets use `readImageAssetDescriptor` when available; generated outputs use `readGeneratedImageOutputDescriptor` when available.
- List-fallback detail reads are bounded fallbacks only. Artifact/document views currently use this fallback because public view ids do not carry reversible locators or storage keys, and providers must diagnose that limitation instead of implying durable arbitrary lookup.
- Public view ids remain safe resource-backed view ids, not source ids, asset ids, storage keys, paths, command fragments, base64, or raw provider payloads. Aggregate routing may keep internal provider ownership metadata or explicit provider-scoped ids, but it must not introduce confusing public/source id mixing.
- Artifact metadata pagination is limited by the current browse seam: cursor input is unsupported, output is bounded after browse, and no provider should claim source-level pagination until the source seam supports it.
- Image cursor pass-through is allowed only for a single active source. Combining finalized image and generated-output sources should omit `nextCursor` and return a safe diagnostic.
- Image/generated-output prompt text, negative prompt text, workflow/ComfyUI payloads, request/task ids, bytes/blob/base64/data URLs, local/temp/storage paths, storage keys, secrets/tokens/auth values, command lines, stack traces, and raw provider payloads remain hidden from provider and facade output.
- Generated outputs remain generated-output views, not finalized/registered image assets.

## Phase 3 Prompt 5 dataset/model provider

- Dataset/model resource-backed views are computed application-layer read models only.
- Dataset views require an injected safe descriptor-only source. Missing dataset seams return empty results plus safe unsupported diagnostics and must not invent a dataset registry, prepare/materialize datasets, read rows/files, scan storage, or create descriptors.
- Model views read persisted inventory records through the model registry seam only. Provider list calls must pass `includeDiscovered: false`; the provider must not discover local models, scan Hugging Face caches, load models, validate/train/publish models, or read model files.
- Dataset/model output must omit local/cache/checkpoint/report/output/materialization/source paths, request/task/prompt ids, provider-native raw payloads, commands, env values, logs, bytes/blobs/base64, secrets, tokens, and auth values. Existing stored model validation or publishing metadata may be displayed only after sanitization and without triggering validation or publishing.
- Host wiring, API/IPC/preload, renderer, and thin-client behavior remain deferred/unchanged for this family.
