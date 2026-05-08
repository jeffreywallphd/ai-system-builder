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

Prompt 7 has added pure application-layer validation services under `modules/application/services/asset` for definitions, instances, bindings, and compositions. Prompt 8 has added application-layer repository ports under `modules/application/ports/asset` and use cases under `modules/application/use-cases/asset` for registering/creating, reading, listing, updating, and validating asset definitions, instances, and compositions. Prompt 9 adds minimal local JSON persistence adapters under `modules/adapters/persistence/asset` behind those ports: text filters are simple value-based substring checks, manifests check schema version/store kind without migrations, and writes accept JSON-compatible records only. Prompt 10 adds resource-backed mapping contracts under `modules/contracts/asset` and pure application helpers under `modules/application/services/asset`; external repository object paths stay provider metadata, primary backing links use safe `asset-resource-backing` references, and mapping helpers are deterministic contract mappers, not runtime, transport, UI, automatic-composition, prompt-assembly, retrieval, embedding, AI-generation, artifact storage, or durable resource-backed registration behavior. Phase 2B Prompt 3 adds an application-owned built-in asset definition seeding service under `modules/application/services/asset`; seeds are application metadata descriptors, not shared contract families or UI route/component identities, and the service validates before save, persists only missing valid definitions, is idempotent only for matching seed ID, seed version, and fingerprint, skips user/custom or conflicting definitions without overwrite, and returns structured sanitized diagnostics. Phase 2B Prompt 4 adds the initial application-owned built-in catalog under `modules/application/services/asset/built-ins` with stable `builtin.*` seed/definition IDs, explicit `1.0.0` versions, concise AI context/configuration/ports, shared runtime-capability requirements for runtime-backed built-ins, resource-backed descriptor definitions, `builtin.artifact` as a generic `data-source` resource-backed definition distinct from document-specific `builtin.document`, and a model-publishing limitation that execution is unavailable/not implemented until runtime support exists. Phase 2B is now stabilized internally: local Asset Kernel persistence, validated/idempotent seeding, version-aware built-in definitions, computed resource-backed internal views, the read-only `AssetRegistryReadFacade` with repository-supported filter forwarding plus diagnostic facade-side filtering for unsupported query shapes, centralized application-owned safe metadata/view sanitization, and host-private `composeInternalAssetRegistry` diagnostics that omit seed catalog content are available for internal consumers only. Phase 2C should expose read-only transport wrappers around the facade before any Asset Library UI; UI code must consume transport wrappers rather than local persistence adapters, and generated outputs/external repository objects/previews remain non-assets until finalized/imported/registered.

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

Phase 2B Prompt 5 status: `modules/contracts/asset` includes the transport/UI-neutral `AssetResourceBackedView` read model, and `modules/application/services/asset/asset-resource-backed-view.service.ts` computes internal resource-backed views from existing artifacts, finalized image assets, generated outputs, datasets, model inventory records, document-like artifact descriptors, external/artifact repository objects, Hugging Face-like files, and previews. The views are not persisted durable mappings, do not refactor source feature ownership, do not create asset instances automatically, and add no API/IPC/preload/renderer/thin-client/host public surface. Generated outputs are generated-output views until finalized/registered; external repository objects are external-object views until imported/registered; previews are preview views only. The mapper is pure application code and performs no filesystem/network/runtime/AI/file parsing/OCR/preview generation behavior.

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
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The initial `/api/assets` surface is GET-only for asset definition list/detail/version reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Desktop IPC/preload/renderer UI and thin-client UI/client exposure remain deferred.

## Phase 2C Prompt 3: read-only Asset Registry desktop IPC/preload foundation

Desktop IPC and preload now expose read-only Asset Registry definition list/read/version-read wrappers around the application read facade/read port. The handlers must not receive persistence adapters, host composition helpers, mutation use cases, seed services, runtime/storage adapters, provider clients, or resource scan seams. Renderer UI, thin-client UI/client work, mutations, seeding, import/finalize/register, resource scans, runtime execution, and provider calls remain deferred.

## Phase 2C cleanup checkpoint

Server API and desktop IPC/preload are now expected to stay in parity for the definitions-only read surface: list definitions, read definition, and read definition version. Public query/input normalization belongs at the transport-adapter boundary before the facade is called, and malformed asset type/family/status, built-in, boolean, expansion, limit, or cursor inputs must fail validation instead of falling through to facade or persistence defaults.

The wrappers must depend only on `AssetRegistryDefinitionReadPort` or an equivalent narrow read-only facade. They must not import or receive `InternalAssetRegistryComposition`, local asset repositories/persistence, mutation use cases, built-in seeding services, resource scanners, runtime adapters, provider clients, or host composition helpers. Asset instances, compositions, registry summaries, resource-backed views, renderer UI, and thin-client UI remain deferred unless a later prompt explicitly adds them.

## Phase 2C Prompt 4: shared Asset Library read clients

Phase 2C now has shared UI-facing Asset Library read models and client helpers for the definitions-only surface. `modules/ui/shared/asset-library` owns display-oriented cards/details, query/detail option types, mapper helpers, safe client errors, and result envelopes; desktop renderer and thin-client clients consume preload/API reads and expose that shared UI shape. They must not call application services, local persistence, host composition, runtime adapters, server route handlers, or Electron IPC handlers directly.

## Phase 2C Prompt 5: desktop Asset Library page

Desktop now includes a top-level `Assets` navigation item and a definitions-only read-only Asset Library page. The page uses the desktop preload-backed Asset Library client, supports read-facade query filters, renders safe definition cards/details, and keeps advanced AI context, configuration, ports, requirements, provenance, validation, and safe metadata sections collapsed by default when available. It must not seed, mutate, import, finalize, register, scan, execute, read bytes, call runtimes/providers, or bypass the desktop read-only client. Thin-client Asset Library UI, instances/compositions/resource-backed views, and registry summaries remain deferred.

## Phase 2C Prompt 6: thin-client Asset Library page

Thin-client now includes an `Assets` navigation item at `/assets` and a definitions-only read-only Asset Library page. The page uses the thin-client GET-only server API Asset Library client, supports read-facade query filters, renders shared sanitized definition cards/details, and keeps advanced AI context, configuration, ports, requirements, provenance, validation, and safe metadata sections collapsed by default when available. It must not seed, mutate, import, finalize, register, scan, execute, read bytes, call runtimes/providers, import application/host/persistence/API-route/desktop IPC internals, or bypass the read-only server API client. Desktop and thin-client Asset Library UIs remain separate read-only host-specific surfaces.

Phase 2C cleanup requires normal Asset Library selection to read detail without validation. Validation details are explicit/user-triggered read-only diagnostics through `includeValidation: true`, and shared UI mappers must render invalid or missing asset type/family/status as unknown display state rather than silently defaulting to valid Asset Kernel values.

Phase 2C Prompt 7 adds shared read-only advanced detail panels for AI-readable context, configuration summaries, ports, requirements, source/provenance, validation summaries only when already available or explicitly requested, and sanitized metadata. Advanced technical sections remain collapsed by default. Safe metadata rendering must omit unsafe path, blob/base64, raw payload, command, stack, env, token, secret, and auth values. Shared UI helpers/components under `modules/ui/shared/asset-library` must stay presentational/read-model only and must not import application services, host composition, persistence adapters, transport handlers, runtime/storage adapters, desktop preload internals, or thin-client API clients.
