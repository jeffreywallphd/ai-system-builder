# Asset Kernel

## Purpose

The Asset Kernel is the canonical shared foundation for assets in `ai-system-builder`.

An asset is a versioned, configurable, AI-readable, machine-composable building block that can represent structure, behavior, interface, data, instructions, resources, compositions, or logic containers, and can be assembled into features, systems, subsystems, and systems composed of subsystems.

This document prevents parallel vocabularies for artifacts, resources, UI components, tools, workflows, pages, systems, generated outputs, previews, and AI context. It is an architecture baseline for Phase 2A. Prompt 3 added the first core TypeScript contract family in `modules/contracts/asset` for identity, lifecycle, review, provenance, definitions, instances, references, minimal binding/composition shells, and validation issue shapes. Prompt 4 added detailed configuration contracts for schemas, fields, JSON-compatible values, defaults, selected values, constraints, generic UI hints, validation rule descriptors, and examples. Prompt 5 added detailed structured AI-context contracts. Prompt 6 added detailed shared contracts for machine-readable ports, port contracts, binding constraints, dependencies, composition rules, composition cardinality, and composition validation summary shells only; the Phase 2A pre-Prompt 7 cleanup kept those contracts descriptor-only while tightening JSON-safe metadata, first-class declarative requirements, safe references, and shared validation summary statuses. Prompt 7 adds pure application-layer validation services in `modules/application/services/asset` that return structured `AssetValidationIssue` results for definitions, instances, bindings, and compositions. Prompt 8 adds application-layer asset repository ports in `modules/application/ports/asset` and transport-neutral use cases in `modules/application/use-cases/asset` for registering/creating, reading, listing, updating, and validating asset definitions, instances, bindings, and compositions. Prompt 9 adds minimal local JSON persistence adapters in `modules/adapters/persistence/asset` behind those repository ports; the adapters persist metadata/records only and do not store file/blob bytes, generated payloads, resource bytes, API/IPC/UI contracts, migrations beyond a schema-version manifest, prompt assembly, retrieval, embeddings, generation, workflow execution, graph execution, automatic composition, runtime readiness lookup, or runtime behavior. Prompt 10 adds resource-backed asset mapping contracts in `modules/contracts/asset` plus pure application mapping helpers in `modules/application/services/asset`; these map existing artifact, image, dataset, model, generated-output, storage-object, artifact-repository, external-repository, and preview concepts into safe Asset Kernel references/backings without converting those feature families or adding durable resource-backed registration. Phase 2B Prompt 3 adds an application-owned built-in asset definition seeding service in `modules/application/services/asset`; it validates seed definitions through the existing Asset Kernel validation logic, saves only missing valid definitions through repository/use-case seams, marks created records with JSON-compatible built-in seed metadata, treats matching seed ID, seed version, and fingerprint as already current, and refuses to overwrite user/custom, fingerprint-mismatched, or seed-version-mismatched records, reporting seed-version conflicts with the explicit `skipped-seed-version-mismatch` status. Phase 2B Prompt 4 adds the initial application-owned built-in definition catalog under `modules/application/services/asset/built-ins`: stable `builtin.*` definition/seed IDs, explicit `1.0.0` versions, concise AI context, minimal configuration/ports, runtime-capability requirements for behavioral runtime-backed entries, and resource-backed descriptors that do not store resource payload content; `builtin.artifact` is a generic `data-source` resource-backed descriptor distinct from `builtin.document`, which remains document-specific.
Phase 2B Prompt 5 adds a computed internal resource-backed view read model in `modules/contracts/asset` and a pure application-layer mapper in `modules/application/services/asset`. These views are read-side projections over existing artifact, finalized image asset, generated output, dataset, model inventory, document-like artifact, external repository object, Hugging Face-like repository object, artifact repository object, and preview descriptors. They are not persisted durable mappings, do not create asset instances automatically, and do not move ownership away from the existing artifact/image/dataset/model/storage/repository families. Generated outputs remain `generated-output` views until finalization/registration, external repository objects remain external object views until import/registration, and previews remain preview views unless existing metadata explicitly says otherwise. Prompt 5 adds no API, IPC, preload, renderer, thin-client, host public surface, filesystem/network access, runtime readiness lookup, runtime task reads, runtime execution, AI behavior, file parsing, OCR, or preview generation.

Phase 2B Prompt 6 adds an internal application Asset Registry read facade in `modules/application/services/asset`. The facade is read-only, transport-neutral, and UI-neutral: it aggregates Asset Kernel repository ports for definitions, instances, compositions, optional binding summaries, built-in definition metadata, explicit validation results, and optional computed resource-backed views supplied by an injected provider. It does not execute seeding, assume catalog entries are persisted, scan artifact/resource storage, save/update/delete records, call runtime readiness or task registry seams, or expose API/IPC/preload/renderer/thin-client/server routes. Validation remains explicit via `includeValidation`; list reads and detail reads do not perform validation by default. Host-level composition of this facade remains deferred to Prompt 7, and Phase 2C may later wrap its read models in read-only transport/UI layers.

Phase 3 Prompt 2 moves the resource-backed view provider seam to `modules/application/ports/asset`. Providers now return structured list results with `items`, optional `nextCursor`, and sanitized structured diagnostics. The application aggregate provider foundation remains read-only and computed: it can combine already-injected family providers, treat unsupported/not-wired families as safe diagnostics, and sanitize partial provider failures without scanning storage, reading bytes, calling networks, calling runtimes, or creating registered assets. Artifact, image, model, dataset, and external repository family providers remain deferred to later Phase 3 prompts.

Phase 3 Prompt 3 adds the first concrete family provider for artifacts and document-like artifacts in the application layer. It projects already-registered artifact browser metadata into computed resource-backed views when explicitly injected into the read facade or aggregate provider. These views do not create `AssetInstance` records, do not persist resource-backed mappings, do not read artifact bytes or document contents, and do not expose storage paths or unsafe storage keys. Document-like classification is metadata-only, using safe media type, format/extension, family/category, or type fields already present in artifact metadata; uncertain artifacts remain generic artifact views. Host wiring and public transport/UI exposure remain deferred.

Phase 3 Prompt 4 adds the image/generated-output resource-backed view provider in the application layer. It projects finalized image asset descriptors only through an explicit descriptor-only list seam and reports safe unsupported diagnostics when that seam is absent. Already-known generated image output descriptors can be injected through a safe descriptor source and remain `generated-output` views, explicitly not finalized or registered image assets. The provider does not finalize outputs, create asset instances, persist mappings, scan storage, read image bytes/base64/content/previews, or query runtime/task systems. Prompt and negative prompt text, raw workflow/ComfyUI payloads, local paths, storage roots, data URLs, secrets, command lines, stacks, and raw payloads are omitted from provider and facade output. Host wiring and public transport/UI exposure remain deferred.

Phase 3 Review A tightens the provider read baseline before adding more families. Finalized image and generated-output detail reads must use safe direct descriptor read seams when a reversible safe view id and descriptor-read method are available; otherwise list fallback is explicitly bounded and diagnostic rather than treated as durable lookup. Artifact/document detail reads remain metadata-only over the artifact browser browse seam because public view ids do not expose reversible locators or storage keys; their list-fallback detail reads and source pagination limits must be diagnosed. Aggregate provider reads preserve public view ids while using internal provider ownership learned from list results or explicit provider-scoped ids to avoid unnecessary fan-out where safe. Multi-provider cursor pagination is intentionally simple: source cursors may pass through for a single active provider/source, but combined sources return no cursor with a diagnostic. No family provider may read resource bytes, inspect document contents, scan storage, call providers/network/runtime/task registries, or expose prompt/workflow/base64/path/storage-key/raw payload data.

Phase 3 Prompt 5 adds the dataset/model resource-backed view provider in the application layer. Dataset views are computed only from an explicitly injected safe dataset descriptor source; when no safe descriptor seam is supplied, dataset views are deferred with sanitized unsupported diagnostics. Model views are computed only from persisted model inventory records through the model registry read seam, always using `includeDiscovered: false` for list reads so the provider cannot trigger local model discovery or Hugging Face cache scans. The provider does not prepare/materialize datasets, read dataset or model files, train/validate/publish/load models, call runtime readiness/task registries, scan storage, create asset instances, or persist resource-backed mappings. Local paths, cache paths, checkpoint/report/output/materialization/source paths, request/task/prompt ids, raw provider payloads, commands, environment values, logs, bytes/blobs/base64, secrets, and tokens are omitted from provider and facade output. Host wiring and public transport/UI behavior remain unchanged.

Phase 3 Prompt 6 adds the external repository object resource-backed view provider in the application layer. It projects only already-known safe external repository object descriptors, artifact-repo descriptor metadata, artifact storage binding target metadata, and persisted model publishing summaries when those metadata-only seams are explicitly injected. These views remain external object read models: they are not imported, localized, registered, or represented as Asset Kernel asset instances, and no durable resource-backed mappings are written. The provider does not browse Hugging Face or artifact repositories, call provider clients, read tokens/auth stores, inspect cache directories, read object bytes/content, validate remote existence, publish/import/localize, query runtimes/task registries, or add host/API/IPC/preload/UI exposure. Provider/repository/revision/object labels are included only after conservative sanitization; tokens, auth headers, signed or query-bearing URLs, local/cache/runtime/storage paths, raw provider payloads, command lines, stack traces, environment values, bytes/blobs/base64, and object contents are omitted with safe diagnostics where appropriate. Missing descriptor seams remain non-fatal unsupported diagnostics until host wiring is added separately.

Phase 3 Review B hardens the cross-family provider baseline before host composition wiring. Aggregate resource-backed views are combined in configured provider order, preserve each provider's item order, clamp limits deterministically, keep the first occurrence of duplicate public view IDs, and report sanitized diagnostics for duplicates, unsupported sources, and source failures. All family providers remain descriptor-only, computed, and read-only. External repository `provider` values such as `huggingface`, `artifact-repo`, `custom`, `local`, and `http` are descriptor labels only; they do not authorize filesystem reads, HTTP calls, provider-client calls, token access, browsing, existence checks, importing, localizing, publishing, registration, runtime work, or byte/content reads. Repository-relative `objectPath` values are used only as private descriptor identity input and are omitted from public metadata/details by default in this phase. Safe descriptor-source interfaces remain provider-local input seams until host wiring proves a need to promote shared contracts into application ports.

Phase 3 Prompt 7 wires safe resource-backed providers into desktop/server internal Asset Registry composition. `modules/hosts/shared/composition/composeResourceBackedViewProviders.ts` creates an aggregate provider from already-composed descriptor-only seams only: artifact browser metadata reads, finalized image asset descriptor reads, persisted model inventory reads with discovery disabled by provider policy, and persisted model publishing summaries for external-object views. Missing dataset, generated-output, artifact-repo object, and storage-binding list seams remain unsupported/not wired with sanitized diagnostics. Host wiring still uses `<storageRootDirectory>/asset-kernel/` for Asset Kernel records, never runtime roots, and adds no public mutation/import/finalization/registration behavior, automatic seeding, storage scans, provider/network calls, runtime/task-registry calls, or byte/content reads.

Phase 3 Prompt 8 plus the final scope-reconciliation cleanup stabilizes the public read-only baseline. Resource-backed views remain computed read models behind the application provider port and Asset Registry read facade; they are not `AssetInstance` records, are not durable mapping records, and are not registered/imported/finalized/localized/published by reads. The provider family implementations cover artifact/document, image/generated-output, dataset/model, and external-repository object views, but family availability in desktop/server hosts depends on a safe descriptor/read seam being wired for that family. Unsupported or unwired seams return sanitized diagnostics. Generated outputs remain explicitly unfinalized/unregistered views, external repository objects remain unimported/unregistered views, external provider labels do not authorize network/provider calls, runtime roots are not provider inputs, and model reads keep discovery disabled with `includeDiscovered: false`. Public API, IPC, preload, desktop Asset Library, and thin-client Asset Library surfaces now expose matching read-only resource-backed view list/detail reads through the read facade only. Phase 3 still adds no mutation workflows, seeding UI, registration, import, finalization, localization, publishing, scans, provider calls, network calls, runtime calls, or byte/content reads.

## Phase 4 handoff

Phase 3 deliberately does not implement asset registration workflows, generated-output finalization into asset instances, external object import/localization, asset authoring/editing, asset composition authoring, resource-backed mapping persistence, workflow execution, graph/canvas editing, AI-generated asset context, or built-in seeding UI.

A safe next phase candidate is **Phase 4 - Asset Registration and Controlled Mutation Workflows**. Candidate goals are explicit registration of selected resource-backed views as asset instances, finalization of generated outputs into registered image assets, import/localization of external repository objects through controlled workflows, guarded mutation contracts/use cases, review/approval and provenance tracking, and keeping those mutations separate from read-only Asset Library browsing.

Phase 4 Prompt 2 adds only the contract foundation for controlled asset mutations in `modules/contracts/asset`: narrow operation names, command base shapes, approval/actor/request context, source identity and deduplication keys, provenance summaries, typed failure/result envelopes, and command-specific contracts for registering resource-backed views, finalizing generated outputs, importing external repository objects, and localizing external repository objects. It does not implement mutation use cases, persistence writes, provider/storage/runtime behavior, API routes, IPC handlers, preload methods, UI actions, host wiring, migrations, general asset editor operations, or arbitrary create/update/delete/patch/edit contracts.

Phase 4 Prompt 3 adds the first internal application-layer controlled write workflow: registering an eligible resource-backed view as a managed `AssetInstance`. The use case re-reads the source view by id through the read facade/read port, requires explicit user approval, derives sanitized source identity and provenance, validates the target definition and constructed instance, detects duplicate source identities with a bounded instance-list scan, and writes only the Asset Kernel instance record through `AssetInstanceRepositoryPort`. It stores metadata and references only, never resource bytes, local paths, provider payloads, prompts, workflow JSON, credentials, or source-system content. This workflow is not exposed through API, IPC, preload, renderer UI, thin-client UI, or host wiring yet; public Asset Library browsing remains read-only. Generated-output finalization remains deferred to Prompt 4, and external repository object import/localization remains deferred to Prompt 5.

Phase 4 Prompt 4 adds the second internal application-layer controlled write workflow: finalizing an eligible generated image output and registering the finalized image as a managed `AssetInstance`. The use case re-reads the generated-output resource-backed view or descriptor by id, validates eligibility and approval, requires filesystem-write approval for image/artifact persistence, validates the target image definition, calls only a narrow application-layer generated-output finalization port, and saves an Asset Kernel instance only after finalization succeeds. Asset Kernel persistence stores safe metadata and references to finalized image/artifact identities only; image bytes, local paths, storage roots, prompts, workflow JSON, runtime/task payloads, provider payloads, and credentials remain outside Asset Kernel records. Duplicate checks use sanitized source identities before and after finalization, and partial failures after image/artifact finalization return retry-safe details instead of attempting unsafe rollback. The workflow remains unexposed through API, IPC, preload, renderer UI, thin-client UI, or host wiring; generated outputs remain unregistered until explicit finalization succeeds, external import/localization remains deferred, and public Asset Library browsing remains read-only.

Phase 4 Review A tightens the first mutation workflows before external import/localization. Mutation command guards must run before source reads, duplicate detection, target-definition lookups, finalization calls, or repository writes. Mutation use cases require an injected or centrally controlled safe `AssetInstance` ID generator; they must not fall back to ad hoc random IDs. Generated-output finalization partial failures expose only sanitized finalized image/artifact references needed for retry, and source identity deduplication keys remain opaque. Public API, IPC, preload, UI, host wiring, external import/localization, and general asset editing remain deferred.

Phase 4 Prompt 5 adds the third internal application-layer controlled mutation workflow: importing or localizing eligible external repository objects through a narrow application port and optionally registering the resulting safe internal backing as an `AssetInstance`. The use cases re-read the external object view by id, require explicit approval for network, credential use, partial completion, and filesystem writes, validate eligibility and target definitions, call only the external object import/localization port for provider/network/storage effects, and save Asset Kernel records only after safe internal resource references or backings exist. Phase 4 intentionally keeps import approval conservative for both `remote-reference` and `catalog-registration` modes because the application port may validate provider metadata, use credentials, create durable catalog/storage state, or leave retryable partial state; later public transport/UI wrappers must present import as potentially using provider/network/credential/filesystem resources. Browsing and Asset Library reads remain provider-call-free and read-only; no API, IPC, preload, UI, host wiring, seeding, provider client, token store, storage adapter, byte/content read, model publishing, dataset preparation, runtime, or general asset editor surface is added. Partial failures after durable import/localization are explicit and retry-safe with sanitized references only.

Phase 4 Prompt 6 centralizes mutation guard requirements for registration, generated-output finalization, external object import, and external object localization in the application guard layer. These guards run before source reads, source identity derivation, duplicate lookups, definition lookups, port calls, validation, ID generation, or saves; they enforce operation-specific confirmation kinds, approval flags, actor/initiation metadata, automation-safe limits, and safe request context. Source identity, deduplication, provenance, and failures remain sanitized and deterministic. Public API, IPC, preload, renderer, thin-client, and host mutation exposure remained deferred until Prompt 7. This is not a full RBAC or broad policy engine.

Phase 4 Prompt 7 exposes only the four approved controlled mutation workflows through thin public server API, desktop IPC, and desktop preload wrappers: resource-backed view registration, generated-output finalization, external repository object import, and external repository object localization. These wrappers accept command payloads, preserve safe request/correlation/idempotency context, perform only shallow transport-boundary validation, sanitize unexpected failures, and delegate to the corresponding application use cases. They do not contain mutation business logic, provider logic, persistence logic, finalization logic, direct resource access, arbitrary asset create/update/delete/patch/editor operations, built-in seeding routes, provider browse/download routes, or runtime execution routes.

Phase 4 Prompt 8 adds the first controlled Asset Library UI actions for those same four workflows only. Resource-backed view details may show confirmation-driven Register as asset, Finalize and register, Import external object, or Localize external object actions when the sanitized view kind is eligible. The UI builds narrow commands with explicit approval flags and safe actor/context metadata, calls only public API/preload clients, refreshes read-only Asset Library data after successful mutations, and renders sanitized status messages. It is not a general asset editor and still exposes no arbitrary create/update/delete/patch/edit, built-in seeding, bulk mutation, composition/canvas authoring, workflow execution, provider browsing, runtime execution, dataset preparation, model training, image generation, scans, or resource-byte/content previews.

## Final Phase 4 baseline

Phase 4 stabilizes controlled mutation workflows on top of the read-only Asset Library and resource-backed view foundation. Asset Library browsing remains side-effect-free: list/detail reads expose persisted Asset Kernel records and computed sanitized resource-backed views only. A resource-backed view becomes an `AssetInstance` only after one of the explicit approved commands succeeds.

The only public Asset Kernel mutation operations are `asset.register-resource-backed-view`, `asset.finalize-generated-output`, `asset.import-external-repository-object`, and `asset.localize-external-repository-object`. All four commands require explicit approval, actor metadata, safe request context, guard-first application use-case execution, source re-read by id, safe source identity/deduplication, validation before save, and sanitized provenance/failure/result data. Generated outputs remain unregistered until finalization succeeds. External repository objects remain unimported/unlocalized until the explicit import/localize workflow succeeds.

API, IPC, and preload wrappers are thin transport adapters over the four application use cases. They preserve safe request/correlation/idempotency metadata, reject malformed commands before calling use cases, sanitize unexpected failures, and do not import repositories, providers, storage/runtime adapters, token stores, host composition objects, or UI code. Desktop and thin-client Asset Library actions are confirmation-driven and use only public preload/API clients; they do not import application services or use cases directly. UI action availability is advisory and intentionally conservative; application use-case guards remain authoritative. Unsafe diagnostics, transport errors, mutation details, raw paths, tokens, prompts, workflow JSON, provider payloads, base64/data URLs, stacks, command lines, and environment values must not render in Asset Library list/detail or mutation-result UI.

Asset Kernel persistence remains metadata/reference-only. Resource bytes, generated image bytes, provider payloads, local/cache/runtime/storage paths, prompts, workflow JSON, secrets, tokens, signed URLs, raw errors, stack traces, command lines, environment values, and resource contents stay outside Asset Kernel records and public mutation/UI responses. Built-in seeding UI, general asset editing, composition/canvas authoring, workflow execution, provider browsing, storage scanning, and direct byte/content reads remain deferred.

## Phase 5 handoff

The next recommended phase is **Phase 5 - Foundational Built-In Asset Library and Composition Primitives**.

Phase 5 should populate reviewed reusable default asset definitions for foundational UI and system-building primitives: UI containers, panels/cards/sections, forms, field groups, text/number/select fields, checkboxes/radio groups, text areas, file upload fields, validation messages, submit/cancel actions, tables/lists/detail views, status badges, loading/error/empty states, page layouts, feature shells, workflow step shells, and system/subsystem shells.

Phase 5 should build on Phase 4 by using controlled registration, seeding, and versioning semantics rather than ad hoc public writes. It should not jump directly to full visual composition or canvas authoring unless that is explicitly scoped.

Phase 5 Prompt 2 starts the contract vocabulary for pack-compatible foundational assets in `modules/contracts/asset`. System defaults are intended to be representable as versioned system asset packs rather than only loose `builtin.*` definitions. Asset pack manifests, source kind/layer metadata, trust/install status vocabulary, compatibility/dependency declarations, pack asset entries, non-destructive override rules, and future resolver request/result diagnostics are declarative contracts only. Overrides map references to replacement references; they must not mutate system-owned records. Resolver contracts exist for future exact/semantic/compatible/latest-active behavior, but no resolver service, pack validation service, pack import/export/sharing, public marketplace/package-registry behavior, seeding/install behavior, persistence adapter, UI, transport, host wiring, or foundational asset definitions are added in Prompt 2.

Phase 5 Prompt 3 adds the application-side pack catalog foundation in `modules/application/services/asset-packs`. The placeholder `system.foundation` pack declares system source metadata, foundation category/group constants, an empty manifest, pure manifest construction helpers, manifest validation, reusable pack-asset quality gates, and resolver-planning fixtures for exact versus semantic override intent. It still adds no real foundational UI/form/data/page/workflow/system definitions, no pack install/seeding/import/export/marketplace behavior, no persistence, no host wiring, no API/IPC/preload/UI surface, and no full asset resolver. Foundational primitive definitions begin in Prompt 4, while full resolver behavior remains deferred to Prompt 10.

Phase 5 Prompt 4 populates `system.foundation` with the first real foundational pack entries: semantic UI structural primitives for containers, sections, panels, cards, stacks, grids, tabs, and collapsible sections. These are full `AssetDefinition` records with configuration schemas, AI context, ports, and composition guidance under the `ui-structure` category. They are not renderer components, visual editor nodes, CSS classes, UI route definitions, workflow behavior, runtime/provider calls, seeding/install behavior, or resolver implementation.

Phase 5 Prompt 5 adds semantic form and field primitive entries to `system.foundation` under the `forms-fields` category. These include form, field group, text field, number field, text area, select field, checkbox field, radio group, validation message, submit action, and cancel action definitions. They are pack entries with configuration schemas, AI context, ports, and composition guidance, including composition with the Prompt 4 UI structural primitives. They are not renderer components or executable forms, and they do not implement validation processing, submission handling, file transfer handling, storage writes, visual editing, runtime behavior, seeding/install behavior, or resolver behavior. Date/time and file upload field semantics remain deferred.

Phase 5 Prompt 6 adds semantic data display, state, and message primitive entries to `system.foundation` under `data-display` and `state-messages`. These include table, list, detail view, key/value summary, status badge, progress indicator, image preview placeholder, resource preview placeholder, empty state, loading state, error state, and success message definitions. They are pack entries with configuration schemas, AI context, ports, and composition guidance, including compatibility with UI structural and form primitives. They are not renderer components, data-grid implementations, preview renderers, resource readers, storage readers, API clients, executable workflows, seeding/install behavior, or resolver behavior, and they do not implement data fetching, resource preview rendering, storage reads, byte/content reads, runtime/provider/network behavior, or workflow execution.

Phase 5 Prompt 7 adds the final pre-Review-B foundational category: semantic page, feature, workflow, and system shell primitive entries under `page-feature-shells` and `workflow-system-shells`. These include page, feature, dashboard section, settings panel, resource browser, detail page, wizard step, navigation group, workflow, workflow step variants, system, subsystem, policy check, and test check definitions. They are pack entries with configuration schemas, AI context, ports, and composition guidance connecting shells to UI structural, form, display, state/message, workflow step, and system/subsystem/check semantics. They are not renderer pages, route implementations, workflow engines, runtime tasks, executable systems, schedulers, provider integrations, visual composition editors, AI-generated system composition, seeding/install behavior, or resolver behavior. They do not implement routing, workflow handling, runtime behavior, provider behavior, scheduling/queueing, storage behavior, or public API/IPC/preload/UI exposure. Review B should focus on composition boundaries, override semantics, and no-execution/no-editor drift.

Phase 5 Review A cleanup keeps the pack architecture descriptor-only while tightening durability rules. Pack validation is context-aware: explanatory non-goal language in descriptions, AI-context limitations, safety notes, anti-patterns, examples, and guidance may say that a primitive does not run workflows, does not include prompt text, does not store resource bytes, or avoids renderer implementation details, but payload-like fields, metadata, paths, tokens, provider payloads, workflow JSON, prompt text, resource content, execution code, base64/data URLs, and signed URLs remain invalid. `system.foundation` manifest metadata must use stable catalog descriptors rather than prompt or review labels. Manifest `categories` remain category IDs for now; the category labels/descriptions live as catalog-side metadata in `SYSTEM_FOUNDATION_PACK_CATEGORIES` until later serialization fixtures include category descriptors or an adjacent catalog descriptor. Option-based form fields describe `staticOptions` as semantic option descriptors with `optionId`, `label`, `value`, optional `description`, and optional `disabled`; richer item-schema enforcement is deferred and no renderer, data fetch, option resolver, validation engine, submission engine, or execution behavior is implied.

Phase 5 Prompt 8 adds explicit internal application-side install/seeding behavior for trusted system asset packs. `system.foundation` can be installed only by invoking the internal application service; the service validates the manifest identity, pack manifest, pack entries, full `AssetDefinition` records, and pack quality gates before saving anything. It persists missing definitions through Asset Kernel repository/use-case seams as normal definitions with safe pack/source metadata, is idempotent for matching system-owned pack entries, and treats user/custom same-ID/version conflicts as failed installs rather than silent skip success. It does not apply override rules, run resolver behavior, create a durable active-pack registry, expose public API/IPC/preload/UI install surfaces, add marketplace/import/export behavior, or seed automatically during host startup.

Phase 5 Prompt 9 improves read-only Asset Library discoverability for pack-compatible assets. Shared UI read models and the Asset Registry read facade may expose sanitized pack, source layer, category, badge, and informational override/resolution fields when already present in definition metadata or safe read contracts. `system.foundation` entries appear as `System default` assets from `System Foundation`, with category labels for the foundation categories, only when trusted system source metadata or an installer-managed marker proves system-default ownership. A bare `sourcePackId: "system.foundation"` is an informational source label only; user, imported, or custom definitions cannot become system defaults by setting that field. `workspace-pack` means a workspace pack source and must not be labeled as `Workspace override` unless explicit override metadata such as `overridesDefinitionRef` is present. Desktop and thin-client Asset Library pages can filter/group by pack, source layer, and category and show pack/source/category details in read-only cards and collapsed detail panels. Pack install/import/export/activate/disable UI, override editing, resolver implementation, general asset editing, and visual composition authoring remain deferred; Prompt 10 owns effective resolver behavior.

Phase 5 Prompt 10 adds a narrow pure application-layer asset resolver in `modules/application/services/asset-packs`. It resolves exact asset-definition-version references without overrides by default, resolves semantic/default definition references from explicit candidate definitions, may apply explicit enabled override rules only when requested, and returns deterministic trace, conflict, not-found, and missing-replacement diagnostics. Override application is non-destructive: target and replacement definitions are not mutated, and replacement selection exists only in the resolution result. Resolver results may include an internal `resolvedDefinition` for application callers, but that result is not a public transport/UI payload; API, IPC, preload, and UI surfaces must go through read-facade/read-model sanitization before display. The resolver consumes explicit definitions, manifests, source-layer order, and override rules supplied by callers; it does not read persistence, install or activate packs, create a workspace/user/org active-pack registry, edit override rules, scan storage, call providers/runtimes/network/filesystem, expose API/IPC/preload/UI behavior, or implement import/export/sharing/marketplace behavior. Full active-pack registry policy, public override editing, pack priority management, and package-manager behavior remain deferred.

Phase 5 Prompt 11 adds pure in-memory manifest serialization and fingerprint helpers for asset packs. `system.foundation` can now round-trip as a deterministic JSON manifest string with full definitions, category/source/trust metadata, dependencies, override rules when present, and semantic fingerprints/checksums. Fingerprinting is not validation or import approval: parse/readiness and manifest validation remain the rejecting gates before any future trust decision. Test-only user/imported override-pack fixtures demonstrate future sharing semantics without installing, activating, importing, exporting, publishing, signing, archiving, or exposing packs through public API/IPC/preload/UI. Unsafe metadata, local paths, credentials, signed URLs, raw provider payloads, workflow/prompt payloads, resource bytes/content, command lines, stacks, and environment values remain rejected or safely reported by parsing/validation tests. Actual public import/export workflows, archive formats, signature verification, remote publishing, marketplace/package registry behavior, active-pack registries, override editing, and user-facing sharing remain deferred.

## Final Phase 5 baseline

Phase 5 stabilizes pack-compatible system defaults. `system.foundation` is the canonical versioned, system-trusted system default pack. Its entries are full `AssetDefinition` records with source-pack metadata, category metadata, stable definition refs, stable fingerprints, semantic configuration schemas, AI context, ports, and composition guidance. System defaults are represented as pack entries, not loose hardcoded built-ins, and read-side system-default classification requires trusted system source metadata or a valid installer-managed marker rather than source labels alone.

Foundation primitives remain semantic definitions only. They do not implement renderer components, CSS, routes, API or IPC handlers, workflow engines, runtime tasks, provider calls, resource readers, storage reads/writes, file uploads, data validation, form submission, preview rendering, visual composition/canvas authoring, or AI-generated system composition. Preview entries are placeholders only, and workflow/system/check shells are non-running declarations.

Pack validation, quality gates, install diagnostics, resolver diagnostics, and serialization parsing stay sanitized. Unsafe local/cache/storage/runtime paths, tokens, credentials, signed URLs, raw provider payloads, stack traces, command lines, environment values, bytes/blob/base64/data URLs, prompt text, workflow JSON, and raw resource contents must be rejected or omitted.

Install/seeding for `system.foundation` is explicit, internal, idempotent, and non-destructive. Host startup must not install or seed packs automatically. Validate-only mode writes nothing, install mode validates the manifest, entries, full definitions, and quality gates before save, matching installed system definitions are skipped by default, user/custom same-ID/version conflicts fail install without overwrite, and same-pack refresh requires explicit opt-in when scoped and tested.

The Phase 5 resolver is pure and non-destructive. It accepts explicit candidate definitions, manifests, source-layer ordering, and override rules supplied by the caller; it does not read repositories, install or activate packs, persist active-pack state, edit override rules, or expose public transport/UI behavior. Exact references bypass overrides by default. Semantic/default references may apply explicit enabled override rules only when the request allows overrides. Override rules select effective replacements during resolution and never mutate system records.

Manifest serialization and fingerprint helpers are pure, deterministic, and in-memory. They prove future import/export readiness by round-tripping safe manifests and fixtures, but fingerprints are not validation results or safe import approvals. The validation/readiness path must reject unsafe manifests before any fingerprint is trusted. These helpers do not read or write files, create archives, verify signatures, publish packages, install user packs, activate packs, or add public import/export API, IPC, preload, or UI behavior.

Asset Library discoverability is read-only. It may show sanitized pack/source/category labels, source-layer badges, foundation category labels, and safe informational override/resolution metadata already present in read models. `workspace-pack` displays as a workspace pack source, not an override, unless explicit override metadata is present. It must not add pack install/import/export/activate/disable controls, public override editing, public resolver execution, general asset editing, visual composition/canvas/wizard authoring, provider/network/runtime calls, scans, or byte/content reads.

Phase 5 non-goals remain explicit: no public pack import/export/install/activation behavior, no marketplace or package registry, no active-pack registry, no arbitrary asset editor, no public override editing, no workflow execution, no runtime task execution, no visual composition/canvas authoring, no provider/network/storage side effects, and no automatic AI-generated asset library.

## Phase 6 handoff

The recommended next phase is **Phase 6 - Asset Authoring, Override Management, and Composition Planning**.

Phase 5 created the pack-compatible foundation: asset pack contracts, system foundation pack definitions, validation/quality gates, explicit internal install, read-only discoverability, pure resolver semantics, and serialization readiness. Phase 6 can now build controlled user authoring and override workflows on top of that foundation without mutating system defaults.

Phase 6 should focus on user-created asset definition drafts, copy/customize flows from `system.foundation` into user-owned assets, non-destructive override management UI, active override preview and conflict diagnostics, pack-aware authoring metadata, basic composition planning using existing primitives, authored asset validation before save, controlled workspace-level pack/override state if ready, read-only resolver preview in Asset Library, and authoring flows that remain non-executing until later phases.

Phase 6 non-goals: no full marketplace, no remote publishing, no arbitrary unvalidated asset editing, no workflow execution, no runtime task execution, no drag-and-drop canvas unless explicitly scoped, no AI-generated assets without human review, and no provider/network/storage side effects from authoring preview.


## Local persistence checkpoint (Prompt 9)

Prompt 9 introduces an adapter-owned local `asset-kernel/` JSON store for `AssetDefinition`, `AssetInstance`, `AssetComposition`, and `AssetBinding` records. The store writes `manifest.json` with `schemaVersion: 1` and one JSON file per asset family (`definitions.json`, `instances.json`, `compositions.json`, and `bindings.json`). It is a durable record adapter behind application repository ports, not a validation service, artifact store, storage abstraction, migration framework, version-history service, host API, IPC surface, or UI feature. Application use cases remain responsible for validation-before-save; read/list adapter operations return persisted records without revalidating by default.

Definition records are stored by `definitionId@version`; exact `asset-definition-version` references resolve the matching version, while `asset-definition` references resolve a deterministic latest version without auto-incrementing or mutating supplied versions. Prompt 10 resource-backed mapping is contract/application-helper-only, and Phase 2B Prompt 5 resource-backed views are computed read-side application projections only: storage-backed durable registration, transport exposure, automatic composition, and generated context remain deferred to later phases. Phase 2B Prompt 4 now provides a production seed catalog, and shared local composition remains available through `composeLocalAssetKernel`. Phase 2B now wires `composeInternalAssetRegistry` into desktop/server host registration as host-level internal composition of the local repositories/use cases plus the application `AssetRegistryReadFacade`; it uses `storageRootDirectory` so records live under `<storageRootDirectory>/asset-kernel/`, never runtime roots. It is transport/UI-neutral, exposed only through host-internal getters, accepts only an optional injected resource-backed view provider seam, does not scan resource stores or read resource bytes, and does not seed built-ins automatically. No API/IPC/preload surface, renderer/thin-client UI, persisted resource-backed scans, public resource-backed views, runtime behavior, workflow/graph execution, prompt assembly, embeddings, or AI-generated context are introduced. Built-ins are application seed definitions, not contracts and not UI routes; seeding idempotency is based on seed ID, seed version, and fingerprint; the model-publishing built-in references the shared `model-publishing` runtime capability while documenting that runtime execution is unavailable/not implemented until that runtime path exists.

## Relationship to ADRs and existing architecture

- ADR-0005 established **Asset** as the directional composition umbrella for reusable managed units in user-built systems.
- ADR-0016 refines ADR-0005 into the accepted Phase 2A Asset Kernel baseline.
- ADR-0004 and `docs/architecture/persistence-and-storage.md` remain authoritative for persistence/storage separation.
- ADR-0011, ADR-0013, and `docs/architecture/runtime-model.md` remain authoritative for runtime task/readiness ownership and host-owned execution.
- ADR-0015 remains authoritative for security and policy boundaries.

The Asset Kernel does not replace these decisions. It defines how assets reference their capabilities, resources, lifecycle, and composition needs without duplicating lower-level storage, runtime, host, transport, or security models.

## Canonical terminology

| Concept | Kernel status | Canonical meaning |
| --- | --- | --- |
| `Asset` | Kernel concept | The reusable/composable semantic unit known to AI System Builder. Assets may represent structure, behavior, interface, data, instructions, resources, compositions, or logic containers. |
| `AssetDefinition` | Kernel concept | A reusable versioned blueprint/template for a composable building block. Definitions own type/family, version, lifecycle, AI-readable context, configuration surface, ports, composition rules, requirements, and provenance. |
| `AssetInstance` | Kernel concept | A configured use of an asset definition in a specific feature, system, workflow, page, or composition. Instances own the definition reference, selected configuration, instance lifecycle/state, bindings, parent composition reference, applicable resource references, and use-specific provenance. |
| `AssetBinding` | Kernel concept | A typed connection between asset instances, ports, resources, runtime capabilities, storage objects, or external repository objects. |
| `AssetComposition` | Kernel concept | A validated assembly of asset instances and bindings into a larger unit such as a feature, workflow, page, subsystem, system, or system-of-subsystems. It is not merely a folder or UI route. |
| `AssetReference` | Kernel concept | A stable transport-neutral reference to an asset definition, asset definition version, asset instance, composition, reusable asset requirement, or referenceable resource/artifact object. Deterministic behavior should reference specific definition versions. |
| `AssetConfiguration` | Kernel concept | The definition-owned configuration surface plus instance-selected configuration values, constraints, UI hints, validation rules, defaults, and examples. |
| `AssetAiContext` | Kernel concept | Structured AI-readable asset metadata used for retrieval, validation support, and prompt assembly. It complements machine contracts and is not only prose documentation. |
| `AssetPort` | Kernel concept | A formal connection point such as an input, output, event, control/action, data, or error port. Ports belong in shared asset contracts, not renderer-specific models. |
| `AssetCompositionRule` | Kernel concept | A machine-checkable rule for allowed parent/child types, required or optional dependencies, incompatible assets, ordering, cardinality, and binding compatibility. |
| `AssetValidationIssue` | Kernel concept | A structured application-layer validation result describing missing/invalid configuration, AI-context completeness gaps, incompatible bindings, lifecycle problems, missing declared requirements, or unsafe/disallowed permission declarations. |
| `AssetLifecycleStatus` | Kernel concept | The asset lifecycle baseline: `draft`, `validated`, `published`, `deprecated`, `archived`, and `failed-validation`. |
| `AssetProvenance` | Kernel concept | Metadata about creation/update timestamps, creator/source, source assets, derived-from links, AI-generated or human-authored markers, safe generation context, and optional review/approval status. |
| `AssetRequirement` | Kernel concept | Declarative requirements such as runtime capability IDs, host type, permissions, network/filesystem/secret needs, user approval, thin-client safety, and automation safety. |
| `Resource-backed Asset` | Kernel concept | An asset whose semantic value is backed by a resource or artifact, such as an image, dataset, model, document, or Hugging Face repo file. |
| `Artifact` | Outside kernel, referenceable | A stored, managed resource with metadata, storage identity, provenance, and possibly external repository identity. Artifacts can back assets but do not replace the asset model. |
| `Resource` | Outside kernel, referenceable | An addressable content/data object such as bytes, generated output, dataset file, image file, document file, model file, or provider object. |
| `Generated Output` | Outside kernel until registered/finalized | A resource/artifact produced by a runtime task. It may later become or back an asset after finalization/registration. |
| `Preview` | Outside kernel, referenceable | A derived readable representation of a resource-backed asset or artifact. It is not the asset itself. |
| `External Repository Object` | Outside kernel, referenceable | An object in an external system, such as a Hugging Face repository or file, that may be mirrored, referenced, localized, or wrapped as a resource-backed asset. |

## Asset ontology

### AssetDefinition

An `AssetDefinition` is a reusable blueprint/template for a composable building block.

Examples include:

- UI component definition,
- workflow step definition,
- tool definition,
- prompt template definition,
- model asset definition,
- dataset asset definition,
- system or subsystem definition.

An asset definition owns:

- type/family,
- version,
- lifecycle,
- AI-readable context,
- configuration surface,
- ports,
- composition rules,
- requirements,
- provenance.

Definitions are versioned. Systems that require deterministic behavior should reference a specific asset definition version rather than an implicit latest version.

### AssetInstance

An `AssetInstance` is a configured use of an asset definition in a specific feature, system, workflow, page, or composition.

Examples include:

- an image gallery component configured for a generated-image collection,
- a workflow step configured to chunk textbook content,
- a tool instance bound to a specific runtime capability,
- a model asset instance bound to a model inventory record.

An asset instance owns:

- definition reference,
- selected configuration,
- instance lifecycle/state,
- bindings,
- parent composition reference,
- resource references where applicable,
- provenance for this configured use.

Definitions and instances may have separate lifecycle and provenance because the reusable blueprint and a configured use can be authored, reviewed, validated, deprecated, or archived independently.

### AssetBinding

An `AssetBinding` is a typed connection between asset instances, ports, resources, runtime capabilities, storage objects, or external repository objects.

Examples include:

- workflow step output bound to another step input,
- page component bound to a data source,
- generated-image resource bound to a preview component,
- tool bound to a runtime capability,
- model asset instance bound to a model inventory record.

Bindings are where AI-proposed composition becomes machine-checkable. AI can propose bindings, but validation must verify compatibility before execution or publication.

### AssetComposition

An `AssetComposition` assembles asset instances and bindings into a larger unit.

Examples include:

- feature,
- workflow,
- page,
- subsystem,
- system,
- system-of-subsystems.

A composition is not simply a folder, route, renderer tree, or file hierarchy. It is a validated assembly of configured instances and typed bindings.

## Asset families and initial type guidance

High-level asset families:

1. **Structural assets**: interface, page, schema, layout, system shape, and other structure-bearing units.
2. **Behavioral assets**: tools, workflows, workflow steps, runtime-bound operations, adapters, tests, and policies.
3. **Resource-backed assets**: assets whose semantic value is backed by resources/artifacts such as models, datasets, images, documents, or provider repo files.
4. **Context assets**: prompts, instructions, AI-readable summaries, policies, examples, and composition guidance.
5. **Composition assets**: features, pages, workflows, logic containers, subsystems, systems, and systems composed of subsystems assembled from instances and bindings.

Example asset types include `ui-component`, `page`, `tool`, `workflow`, `workflow-step`, `schema`, `prompt-template`, `data-source`, `runtime-binding`, `adapter-binding`, `model`, `dataset`, `image`, `document`, `feature`, `subsystem`, `system`, `policy`, and `test`.

Logic containers are a descriptive umbrella for behavioral and composition assets such as tools, workflows, workflow steps, policies, feature logic, and system/subsystem behavior; they are not a separate required asset type in the initial Phase 2A kernel.

The initial Phase 2A contract family remains small and extensible. Prompt 3 records this vocabulary in `modules/contracts/asset` without requiring every type to be fully supported in Phase 2A.

## Assets, artifacts, resources, generated outputs, previews, and external objects

The Asset Kernel uses the following distinction:

- `Asset`: the reusable/composable semantic unit known to AI System Builder.
- `AssetDefinition`: the reusable asset blueprint.
- `AssetInstance`: a configured use of an asset definition.
- `Resource`: an addressable content/data object, such as bytes, generated output, dataset file, image file, document file, model file, or provider object.
- `Artifact`: a stored, managed resource with metadata, storage identity, provenance, and possibly external repository identity.
- `Resource-backed Asset`: an asset whose semantic value is backed by a resource/artifact, such as image, dataset, model, document, or Hugging Face repo file.
- `Generated Output`: a resource/artifact produced by a runtime task, which may later become or back an asset.
- `Preview`: a derived readable representation of a resource-backed asset or artifact.
- `External Repository Object`: an object in an external system, such as a Hugging Face repository or file, that may be mirrored, referenced, localized, or wrapped as a resource-backed asset.

Rules:

- Artifacts/resources do not replace the asset model.
- The asset model does not duplicate low-level storage concerns such as bytes, local filesystem paths, object keys, or provider-native transfer mechanics. External repository `objectPath` values are provider object metadata only; they are not canonical Asset Kernel ids.
- Resource-backed asset primary backing links use safe `asset-resource-backing` references to internal backing ids, not provider-native paths or URLs.
- Generated outputs become reusable only after finalization/registration as artifacts or resource-backed assets.
- Hugging Face objects remain external repository objects unless registered/imported as resource-backed assets.
- Existing artifact/model/dataset/image families should not be renamed in Phase 2A.

## AI-readable context

Assets intended for AI-assisted composition require structured `AssetAiContext`. Prompt 5 replaces the earlier minimal summary placeholder with detailed shared contracts under `modules/contracts/asset` while keeping `AssetDefinition.aiContext` optional so draft/internal assets can exist before future completeness validation.

Prompt 5 fields include:

- purpose,
- capabilities and limitations,
- input and output summaries,
- configuration guidance,
- composition guidance,
- examples and anti-patterns,
- safety notes,
- user-facing and developer-facing summaries,
- quality/completeness metadata,
- safe metadata.

Guidance:

- AI context is asset metadata owned by the asset definition, not only external docs.
- AI context should be structured enough to support future retrieval, validation support, and prompt assembly.
- AI context complements machine contracts and must not replace configuration schemas, formal ports, binding compatibility, composition rules, or validation services.
- AI-context input/output and composition guidance is semantic guidance only; Prompt 6 ports, binding constraints, dependencies, and composition rules are the separate machine-readable structure.
- AI-context completeness and composition compatibility validation is initially implemented by Prompt 7 application services. Prompt 8 application use cases validate create/register/update requests before saving through repository ports, allow `valid` and `valid-with-warnings`, reject `invalid` or `unknown` results without throwing for normal validation failures, and keep read/list paths from revalidating by default. Persistence remains Prompt 9; resource-backed mapping remains Prompt 10.
- AI context must not store or require secrets, tokens, local/temp/provider-native paths, raw prompts with sensitive content, raw private transcripts, raw environment values, command lines, stack traces, adapter payloads, file/blob bytes, or embeddings/vector arrays. Use redacted summaries and safe references instead.

## Configuration surface

Prompt 4 defines the detailed `AssetConfiguration` contract family under `modules/contracts/asset` for:

- configuration schemas,
- fields and field value-kind vocabulary,
- JSON-compatible default and selected configuration values,
- constraints and option lists,
- generic UI hints,
- validation rule descriptors,
- examples,
- schema and version references.

Guidance:

- Asset definitions own the configurable surface through `configurationSchema`, `defaultConfiguration`, and `configurationExamples`.
- Asset instances own selected configuration values through `selectedConfiguration`.
- Configuration values must remain JSON-compatible for future persistence and transport; functions, host/runtime objects, filesystem handles, bytes, paths, secrets, raw environment values, raw adapter details, and executable code are not part of configuration values.
- Arbitrary unvalidated JSON should be avoided for composable assets; Prompt 7 validates configuration structure and selected/default values without becoming a full schema engine.
- Configuration contracts are schema-engine-neutral and future JSON-schema-compatible, with no runtime schema parser, validation service, conditional schema engine, migration framework, or form renderer in Prompt 4.
- Detailed AI context is handled by Prompt 5 and complements configuration schemas without duplicating the entire configuration schema; Prompt 6 port/composition contracts may reference configuration as a carried contract or dependency but do not duplicate configuration schemas, execute conditional validation, or implement a form/schema engine. Registry ports remain deferred to Prompt 8, persistence remains deferred to Prompt 9, and resource-backed mapping remains deferred to Prompt 10.
- Transport and UI exposure remain deferred until after the Asset Kernel is proven.

## Ports, contracts, and composition rules

Composable assets should describe formal connection points.

Prompt 6 contract concepts now include:

- input, output, event, and control ports,
- lightweight port contracts for assets, resources, artifacts, configuration, runtime capabilities, events, control, JSON/text, and binary references,
- port and composition cardinality descriptors,
- binding constraints such as same contract kind, asset type/family, resource kind, runtime capability, single-source/single-target, ordering, and custom future-rule descriptors,
- composition rules for allowed parents/children, required/optional/incompatible children, required dependencies, cardinality, ordering, binding-required, runtime requirements, and custom descriptors,
- composition dependencies for assets, asset types/families, resources, artifacts, runtime capabilities, external repository objects, configuration, and custom descriptors,
- composition validation summary status shells for future validation results.

Guidance:

- AI can propose bindings, but validation must verify compatibility.
- Ports/bindings are how systems prevent arbitrary invalid wiring.
- UI components, workflow steps, tools, and resource-backed assets may expose different port families.
- Ports and bindings belong in shared asset contracts, not renderer-specific models.
- Prompt 6 keeps these contracts descriptor-only. It adds no compatibility checker, composition validator, runtime readiness lookup, registry port, persistence model, resource-backed mapping, workflow execution, graph execution, UI page routing, API/IPC transport, or automatic composition behavior.

## Lifecycle, versioning, review, and provenance

Minimal lifecycle baseline:

- `draft`,
- `validated`,
- `published`,
- `deprecated`,
- `archived`,
- `failed-validation`.

Review/approval is separate from lifecycle, not a replacement for lifecycle:

- `unreviewed`,
- `reviewed`,
- `approved`,
- `rejected`.

Recommended provenance fields:

- created/updated timestamps,
- creator/source,
- source assets,
- derived-from links,
- AI-generated vs human-authored markers,
- source prompt or generation context where safe and appropriate,
- review/approval status if needed.

Guidance:

- Definitions and instances may have separate lifecycle/provenance.
- Versioning is mandatory for definitions.
- Systems should reference specific asset definition versions where deterministic behavior matters.
- Generated outputs may become resource-backed assets after finalization.
- Public asset metadata and validation details use JSON-compatible `AssetMetadata` values so they are safe for future persistence and transport. They must not expose secrets, local temp paths, raw bytes, buffers, streams, filesystem handles, runtime objects, tokens, command lines, raw environment values, stack traces, or other sensitive implementation details.

## Runtime, host, and permission requirements

Assets express requirements declaratively without replacing Phase 1 runtime readiness.

`AssetRequirement` is now a first-class shared contract for inline declarative requirements owned by an `AssetDefinition`. `AssetDefinition.requirementRefs` remains available only for future references to externally managed reusable requirement definitions. Requirement concepts include:

- required runtime capability IDs,
- required host type,
- required permissions,
- external network access,
- filesystem access,
- secret/token access,
- user approval requirement,
- thin-client safety,
- automation safety.

Guidance:

- Asset runtime requirements should reference shared `RuntimeCapabilityId` values without duplicating runtime readiness snapshots, runtime task statuses, or provider lifecycle concepts.
- Asset requirements do not replace runtime readiness contracts.
- Runtime readiness answers whether a required capability is currently available.
- Asset validation can structurally check declared requirements before execution or composition.
- Host composition remains responsible for wiring concrete runtime/readiness providers.
- Permission requirements should be declarative; enforcement can come later through application/host policy seams.

## Validation direction

Initial Prompt 7 application-layer validation responsibilities:

- required configuration,
- configuration type/constraint validity,
- AI context completeness for AI-composable definitions,
- port/binding compatibility,
- required dependencies,
- allowed parent/child composition,
- lifecycle state,
- missing runtime requirements structurally,
- unsafe or disallowed permission requirements.

Guidance:

- Validation is application-layer and transport/UI-neutral.
- Validation returns structured `AssetValidationIssue` results.
- Validation does not execute workflows, query runtime readiness, start runtimes, access filesystem/network, call LLMs, or persist anything.
- Validation complements, not replaces, runtime readiness guards.
- General asset validation summaries and composition validation summaries share the same status vocabulary: `not-validated`, `valid`, `valid-with-warnings`, `invalid`, and `unknown`.
- Prompt 8 provides registry/application ports and use cases only. Definitions, instances, compositions, and first-class bindings have repository port seams before Prompt 9; validation structurally checks `AssetComposition.bindingRefs` as `asset-binding` references, and composition validation context may resolve those refs through `AssetBindingRepositoryPort`; Prompt 9 adds minimal local record persistence, and Prompt 10 adds resource-backed mapping contracts/helpers without durable resource-backed registration.

## Persistence direction

Minimal Phase 2A persistence direction:

- asset definitions,
- asset instances,
- asset compositions,
- asset bindings,
- version history,
- lifecycle/provenance metadata,
- local persistence adapter,
- relationship to artifact/resource storage.

Guidance:

- Persistence should not be added in Prompt 2.
- Persistence should come only after contracts, validation, and registry/application ports stabilize.
- Prompt 9 persistence adapters should implement the existing definition, instance, composition, and binding repository ports without changing registry use-case behavior. Composition-owned inline bindings remain valid asset composition content; reusable binding references use first-class `asset-binding` references, are structurally valid without a repository, and are fully validated when resolved through the binding repository port. Local text filters are deterministic case-insensitive substring checks over selected saved record values, not search indexes or AI-generated context.
- The local asset persistence manifest checks the current schema version and store kind before reads and host composition initialization; migrations remain intentionally unimplemented in Phase 2A. Local asset persistence accepts JSON-compatible records only and rejects functions, symbols, undefined values, non-finite numbers, Dates, buffers/streams, class instances, and circular records at the durable adapter boundary.
- `modules/hosts/shared/composition/composeLocalAssetKernel.ts` can compose the local Asset Kernel internally from a host-owned storage root while preserving the adapter-owned `<storageRoot>/asset-kernel/` subdirectory and returning path-safe diagnostics.
- `modules/hosts/shared/composition/composeInternalAssetRegistry.ts` composes that local kernel with the application `AssetRegistryReadFacade` for host-owned internal use. The helper accepts an optional `AssetResourceBackedViewProvider` seam, but it does not import/report seed catalog content, execute built-in seeding, scan artifacts/images/datasets/models/storage, or expose local paths in diagnostics. Desktop/server host registration composes the helper from `storageRootDirectory` and exposes it only through host-internal getters. Public API/IPC/preload/renderer/thin-client surfaces wrap only the read facade plus the four Phase 4 controlled mutation use cases through narrow transport/client seams.
- Deferred registry concerns remain explicit: no automatic definition version incrementing, no version-history service, no delete use cases beyond optional repository-port methods, no use-case conflict detection except what a persistence adapter naturally provides, read/list use cases do not revalidate by default, validation-only use cases do not save, and registry use cases must not call runtime readiness/guards or access filesystem/network directly.
- Asset metadata persistence should preserve the JSON-compatible metadata/detail contract and should not duplicate binary/resource storage.
- Resource-backed assets should reference artifact/resource storage rather than embedding raw file paths or bytes in asset metadata.
- No persistent task history, marketplace, plugin package registry, or workflow execution store should be introduced in Phase 2A.

## Phase 2A and 2B implementation sequence

Phase 2A established the kernel foundation:

1. Prompt 1 — Asset Kernel audit and plan.
2. Prompt 2 — ADR and canonical terminology baseline.
3. Prompt 3 — Core Asset Kernel contracts: first shared `modules/contracts/asset` family only.
4. Prompt 4 — Detailed asset configuration contracts.
5. Prompt 5 — Detailed asset AI-context contracts.
6. Prompt 6 — Detailed asset ports, binding compatibility, and composition-rule contracts.
7. Prompt 7 — Asset validation services for definitions, instances, bindings, and compositions.
8. Prompt 8 — Asset registry and application ports.
9. Prompt 9 — Local persistence adapter.
10. Prompt 10 — Resource-backed asset mapping and final Phase 2A regression.

Phase 2B internal integration then layered local composition, seeding, built-ins, internal resource-backed views, the read-only Asset Registry facade, shared host-private composition, and this regression stabilization pass. It deliberately stops before public transport or UI exposure.

Pre-Prompt 7 cleanup was limited to JSON-safe metadata/details, first-class declarative `AssetRequirement`, safe semantic references such as `schemaRef`, and shared validation summary statuses; later prompts keep those safety constraints while adding persistence, computed read views, and private host composition.

Transport/UI work is intentionally deferred until after the kernel is proven through shared contracts, configuration contracts, AI context contracts, ports/composition contracts, validation, registry ports, persistence, resource-backed mapping, and private host composition. The shared local composition helper and internal registry composition helper are not public registry facades and must not be used to add API/IPC/UI exposure before the dedicated transport prompts.

## Phase 2B stabilized internal integration state

Phase 2B makes the Asset Kernel internally usable without adding a public Asset Library surface. The stable internal stack is:

1. `composeLocalAssetKernel` composes local JSON record persistence for definitions, instances, compositions, and bindings under the adapter-owned `<storageRoot>/asset-kernel/` directory, returning path-safe diagnostics only.
2. The built-in definition seeding service remains application-layer, validates before save, is idempotent by seed ID + seed version + fingerprint, and skips user/custom or conflicting built-ins without overwrite. It is not automatic host startup behavior and is not a UI navigation or route system.
3. The application-owned built-in catalog uses stable `builtin.*` IDs and explicit versions. Read-facade built-in detection is exact and version-aware: definitions are built-in only when a valid Asset Kernel seed marker is present or the persisted `definitionId@version` exactly matches the catalog. Runtime-backed built-ins reference shared runtime capability IDs; resource-backed built-ins have descriptor/reference semantics and no runtime requirements by default.
4. Resource-backed views are computed internal read models from injected or existing descriptors. They are not persisted mappings, do not scan storage, do not create asset instances, and keep generated outputs/external repository objects/previews outside asset registration until explicit finalization/import/registration.
5. `AssetRegistryReadFacade` is read-only, transport-neutral, UI-neutral, and validation-on-request. It forwards repository-supported filters (`text`, single type/family/status where supported) before applying any remaining deterministic facade-side filtering with diagnostics, and it reads repository records, binding summaries, exact built-in metadata, validation summaries, and optional injected resource-backed views without save/update/delete/seed behavior.
6. `composeInternalAssetRegistry` privately wires local persistence/use cases to the read facade for desktop/server host-owned consumers. It does not seed automatically, report seed catalog counts, scan resources, expose local paths, or add API/IPC/preload/renderer/thin-client/server routes. Application Asset Kernel mapping/view/facade services share one application-owned sanitizer for safe metadata and view output.

Phase 2C wraps the internal read facade through read-only transport contracts, desktop preload, and host-specific Asset Library UI clients. Asset Library UI work consumes those API/preload wrappers and shared UI helpers rather than local persistence adapters, application services, or host composition helpers directly.

## Architecture boundaries and non-goals

Asset Kernel work must preserve clean architecture boundaries:

- shared asset contracts belong in `modules/contracts`,
- application validation/use cases belong in `modules/application`,
- adapters belong in `modules/adapters`,
- host wiring belongs in `modules/hosts`,
- UI belongs in apps/modules UI areas.

Non-goals preserved after Phase 4:

- no automatic definition version incrementing, conflict-detection policy, version-history service, or additional delete use cases before a later prompt explicitly scopes them,
- no migrations beyond current manifest schema/kind checks,
- no arbitrary asset create/update/delete/patch/editor API, IPC, preload method, renderer action, or thin-client action,
- no mutation surface beyond the four approved Phase 4 workflows,
- no durable resource-backed mapping repository beyond explicit `AssetInstance` records created by controlled workflows,
- no automatic startup seeding,
- no automatic asset instance creation from artifacts, generated outputs, previews, or external repository objects,
- no resource scans,
- no broad refactor,
- no asset marketplace/plugin system,
- no scheduler/queue/workflow execution engine changes,
- no runtime readiness changes,
- no storage rewrite,
- no artifact/model/dataset/image renames,
- no transport/UI-specific asset models,
- no file-only, UI-only, workflow-only, image-generation-only, or Hugging-Face-only asset model.
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The initial `/api/assets` surface is GET-only for asset definition list/detail/version reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Later Phase 2C prompts add matching read-only desktop IPC/preload and desktop/thin-client Asset Library clients/pages over the same definitions-only read surface.

## Phase 2C Prompt 3: read-only Asset Registry desktop IPC/preload foundation

Desktop now exposes the same definitions-only Asset Registry read foundation through Electron IPC and the preload bridge. The IPC handlers depend only on the application `AssetRegistryDefinitionReadPort`/read facade and expose definition list, definition read, and definition-version read operations.

This desktop surface is read-only. It must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, storage adapters, runtime adapters, provider clients, or resource scan seams. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, execute workflows, or add renderer/thin-client UI.

## Phase 2C cleanup checkpoint

The public Phase 2C Asset Registry surface is currently definitions-only: server API, desktop IPC, and desktop preload expose definition list, definition read, and definition-version read. These wrappers normalize public inputs before calling the read facade and preserve the narrow `AssetRegistryDefinitionReadPort` dependency; they do not access local persistence adapters, host composition helpers, mutation use cases, built-in seeding services, resource scanners, runtime adapters, providers, or byte readers.

Phase 2C now also includes a shared UI-facing Asset Library read-model/client-shape layer under `modules/ui/shared/asset-library` plus read-only desktop renderer and thin-client API clients. These UI clients wrap the existing preload/API definition reads and map transport payloads into display-oriented cards/details, shared query/detail option shapes, safe client result envelopes, and sanitized error models. They do not call application services, host composition, local persistence, runtime adapters, server route handlers, or IPC handlers directly.

The desktop renderer now has a definitions-only, read-only Asset Library page registered as the top-level `Assets` navigation item. The page uses the desktop preload-backed Asset Library client, renders safe list/detail fields, keeps advanced sections collapsed by default, and does not seed, mutate, import, finalize, register, scan, publish, or execute assets.

The thin-client now has a separate definitions-only, read-only Asset Library page registered at `/assets` with an `Assets` navigation item. It uses the thin-client GET-only server API Asset Library client wrappers, renders the same shared sanitized card/detail read models, keeps advanced AI context, configuration, ports, requirements, provenance, validation, and safe metadata sections collapsed by default when present, and does not seed, mutate, import, finalize, register, scan, publish, execute, read bytes, call runtimes/providers, or bypass the server API client. Desktop and thin-client Asset Library UIs remain separate host-specific surfaces over read-only transports; asset instances, compositions, registry summaries, and resource-backed public views remain deferred unless later prompts add matching read-only transport/client support.

Asset Library detail reads must not request validation automatically on normal definition selection. Validation details remain read-only and may be loaded only through an explicit user action that calls the existing definition read/version-read transport with `includeValidation: true`; the action must not mutate, seed, scan, execute, or probe/start/install runtimes. Shared UI Asset Library mappers are defensive display mappers only: invalid or missing canonical asset type, family, or lifecycle status values must render as unknown/not specified display state instead of being recast to valid Asset Kernel semantics.

Phase 2C Prompt 7 adds shared read-only Asset Library advanced detail panels for AI-readable context, configuration summaries, ports, requirements, source/provenance, available-only validation summaries, and safe metadata. These technical sections stay collapsed by default, validation is never loaded by normal selection, and safe metadata rendering must omit sensitive/path/blob/base64/raw payload/command/stack/env/secret values rather than hiding them in the UI. Shared Asset Library UI helpers/components may be reused by desktop and thin-client surfaces, but they must not import application services, host composition, persistence adapters, transport handlers, runtime/storage adapters, desktop preload internals, or thin-client API client code.

Phase 2C Prompt 8 finalizes the read-only Asset Library baseline. The server API, desktop IPC/preload, desktop page, and thin-client page expose definition list/read/version-read only; they do not expose create/update/delete/register/import/finalize/seed/publish/execute/run/scan/sync/repair/install/start/train operations. Normal list/detail reads do not request validation. Validation diagnostics are explicit/available-only through the same read operation with `includeValidation: true`, and validation failures must remain generic and sanitized. Built-in catalog entries are visible only when persisted/seeded internally; the UI must not seed or expose catalog-only built-ins as registered assets. Resource-backed views remain computed read models and may be empty when no provider is wired; public Phase 2C UI does not scan resources, read bytes, call providers, or represent generated outputs/external repository objects as registered assets.

## Workspace contract vocabulary for future Asset Kernel scope

Phase 6 adds passive workspace contracts in `modules/contracts/workspace`, workspace repository ports/local persistence, and an application-level create workspace use case so later prompts can describe workspace-scoped asset/resource views with shared vocabulary. Workspace creation can create a workspace system-pack activation record by id/version, allowing `system.foundation@1.0.0` to be represented for a workspace without copying pack manifests, asset entries, or definitions and without calling the Phase 5 system pack installer. These foundations do not add Asset Library filtering, resolver activation behavior, host wiring, page gating, system-pack install/copy behavior, collaboration permissions beyond passive placeholders, invites, sync, or remote auth.

## Phase 6 Prompt 6: workspace system pack activation availability

Phase 6 Prompt 6 adds application-layer workspace system pack activation read/list/status use cases under `modules/application/use-cases/workspace`. These use cases read workspace activation records through workspace application ports, validate them against the known Phase 6 system-pack registry, and return a deterministic compact active-system-pack view for callers that need to know which system-owned packs are available to a workspace.

Only `system.foundation@1.0.0` is currently a known workspace system pack activation. Activation remains reference-only by pack id/version/provenance/status; the use cases do not load manifests, copy asset entries or definitions into workspace storage, call the Phase 5 system pack installer, apply overrides, or expose pack contents. Asset Library effective-view filtering remains a later Prompt 7 responsibility, and artifact/data/model/image persistence scoping remains later Prompt 8-9 work. Public pack import/export/install/override management and collaboration remain deferred.

### Phase 6 workspace effective Asset Registry reads

Asset Library read traffic is workspace-scoped in Phase 6. List, detail, and resource-backed read requests must carry an explicit workspace id; missing workspace context must fail safely and must not fall back to the global Asset Registry. The workspace-aware read facade builds the effective definition view from active workspace system-pack activation records. `system.foundation@1.0.0` definitions are visible only when that exact system pack is active for the workspace and the definition carries strict system-default provenance (`sourceKind: system`, `sourceLayer: system-default`, `trustStatus: system-trusted`, and matching pack id/version). Detail reads perform deterministic effective-view membership checks from the requested definition detail/source metadata and active system-pack records, not from arbitrary page-size-limited list results, so direct reads cannot bypass list filtering and valid effective-view assets do not disappear because of pagination.

Workspace UI gates now use host/server workspace create/list/select operations backed by persisted workspace records, active selection persistence, and the `CreateWorkspaceUseCase`; renderer localStorage must not be the authoritative workspace store or derive workspace ids from display names. The create checkbox for `Include System Foundation assets` creates only a reference activation for `system.foundation@1.0.0`, and Asset Library requests use that backend-resolvable workspace id.

Resource-backed descriptors are intentionally deferred in the workspace Asset Library until artifact, data, model, and image persistence scoping is implemented in later Phase 6 prompts. System packs remain system-owned and activated by reference only; this read path does not install, copy, import/export packs, edit overrides, author user assets, or implement user-library/cross-workspace reuse.


## Phase 6 artifact-backed resource views

Artifact-backed resource view providers now require explicit workspace context and must browse artifact descriptors only through workspace-scoped artifact read seams. Missing workspace context returns safe empty/diagnostic provider results instead of global descriptors. Non-artifact resource-backed view scoping, including image/generated-output/dataset/model/runtime-output resources, remains deferred.

Phase 6 Prompt 9 update: User/workspace-owned image asset records, generated-output descriptors/finalization, dataset preparation outputs, model inventory records, and runtime task outputs created from workspace actions require an explicit workspace id. Missing workspace context must fail safely and must not fall back to global records. Workspace-owned records from one workspace must not be listed or read as another workspace. Generated-output finalization validates source workspace ownership before writing finalized image assets or Asset Kernel instances, and finalized provenance/metadata carries workspace context. Legacy global image/model/dataset/generated-output records are not silently assigned to a hidden/default workspace and are not auto-migrated; a future explicit import/migration flow may be needed. Global runtime readiness, installed-runtime/model diagnostics, and provider configuration diagnostics may remain global, but they must not be presented as workspace-owned resource records. User-library and cross-workspace reuse remain later work.

## Phase 6 workspace effective view and Phase 7 handoff

Workspace Asset Library reads require explicit workspace context. A workspace can see `system.foundation@1.0.0` definitions only when it has an active trusted system-pack activation reference; a bare `sourcePackId` is not sufficient authority, and detail reads must not bypass the workspace effective view. System Foundation remains system-owned, and workspace activation records do not copy system pack manifests or asset definitions.

Resource-backed descriptors require workspace context; where workspace resource providers are not yet safely scoped, views remain deferred instead of exposing global records. Asset authoring, override editing, pack import/export/install UI, marketplace behavior, visual composition, workflow execution expansion, and user-library/cross-workspace reuse remain out of Phase 6.

Phase 7 should add User Library and Cross-Workspace Asset Reuse: promote workspace assets to a user library, link or copy user-library assets into workspaces, import from another workspace as an independent copy, preserve provenance, and resolve linked/copied assets without implicit propagation.
