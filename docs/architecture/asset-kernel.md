# Asset Kernel

## Purpose

The Asset Kernel is the canonical shared foundation for assets in `ai-system-builder`.

An asset is a versioned, configurable, AI-readable, machine-composable building block that can represent structure, behavior, interface, data, instructions, resources, compositions, or logic containers, and can be assembled into features, systems, subsystems, and systems composed of subsystems.

This document prevents parallel vocabularies for artifacts, resources, UI components, tools, workflows, pages, systems, generated outputs, previews, and AI context. It is an architecture baseline for Phase 2A. Prompt 3 adds the first core TypeScript contract family in `modules/contracts/asset` for identity, lifecycle, review, provenance, definitions, instances, references, minimal binding/composition shells, and validation issue shapes only; it does not implement services, adapters, persistence, API/IPC routes, UI, migrations, runtime behavior, or detailed deferred asset subsystems.

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
| `AssetReference` | Kernel concept | A stable reference to an asset definition, asset definition version, asset instance, or composition. Deterministic behavior should reference specific definition versions. |
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
- The asset model does not duplicate low-level storage concerns such as bytes, local filesystem paths, object keys, or provider-native transfer mechanics.
- Generated outputs become reusable only after finalization/registration as artifacts or resource-backed assets.
- Hugging Face objects remain external repository objects unless registered/imported as resource-backed assets.
- Existing artifact/model/dataset/image families should not be renamed in Phase 2A.

## AI-readable context

Assets intended for AI-assisted composition require structured `AssetAiContext`.

Recommended future fields:

- purpose,
- capabilities,
- limitations,
- input summary,
- output summary,
- configuration guidance,
- composition guidance,
- examples,
- anti-patterns,
- safety notes,
- user-facing summary,
- developer-facing summary.

Guidance:

- AI context is asset metadata, not only docs.
- AI context should be structured enough for retrieval, validation, and prompt assembly.
- AI context should not be the only source of machine validation.
- Machine contracts and AI-readable context must complement each other.
- Prompt 3 includes only a minimal `AssetAiContextSummary` placeholder for core shapes. Prompt 5 will implement detailed AI-context contracts separately from core contracts because this is central to AI-assisted asset composition.

## Configuration surface

Planned `AssetConfiguration` concepts:

- configuration schema,
- default configuration,
- current instance configuration,
- constraints,
- UI hints,
- validation rules,
- examples.

Guidance:

- Asset definitions own the configurable surface.
- Asset instances own selected configuration values.
- Arbitrary unvalidated JSON should be avoided for composable assets.
- Phase 2A should stay JSON-schema-compatible or schema-engine-neutral unless a canonical schema engine is explicitly adopted.
- Prompt 3 includes only a minimal `AssetConfigurationSummary` placeholder for core shapes. Prompt 4 will implement detailed configuration contracts separately from core contracts.

## Ports, contracts, and composition rules

Composable assets should describe formal connection points.

Planned concepts:

- input ports,
- output ports,
- event ports,
- control/action ports,
- data contracts,
- error contracts,
- allowed parent/child types,
- required dependencies,
- optional dependencies,
- incompatible assets,
- ordering/cardinality constraints.

Guidance:

- AI can propose bindings, but validation must verify compatibility.
- Ports/bindings are how systems prevent arbitrary invalid wiring.
- UI components, workflow steps, tools, and resource-backed assets may expose different port families.
- Ports and bindings belong in shared asset contracts, not renderer-specific models.
- Prompt 3 includes minimal reference, binding, and composition shells so core definitions/instances/compositions can refer to each other. Prompt 6 will implement detailed ports, binding compatibility, and composition-rule contracts separately after core/configuration/AI-context contracts.

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
- Public asset metadata must not expose secrets, local temp paths, tokens, command lines, raw environment values, stack traces, or other sensitive implementation details.

## Runtime, host, and permission requirements

Assets express requirements declaratively without replacing Phase 1 runtime readiness.

Planned `AssetRequirement` concepts:

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

- Asset runtime requirements should reference shared `RuntimeCapabilityId` values.
- Asset requirements do not replace runtime readiness contracts.
- Runtime readiness answers whether a required capability is currently available.
- Asset validation can structurally check declared requirements before execution or composition.
- Host composition remains responsible for wiring concrete runtime/readiness providers.
- Permission requirements should be declarative; enforcement can come later through application/host policy seams.

## Validation direction

First application-layer validation responsibilities for later prompts:

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

- Validation should be application-layer and transport/UI-neutral.
- Validation should return structured `AssetValidationIssue` results.
- Validation should not execute runtimes or probe heavy sidecars.
- Validation should complement, not replace, runtime readiness guards.
- Prompt 7 will implement validation services after contracts are stable.

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
- Asset metadata persistence should not duplicate binary/resource storage.
- Resource-backed assets should reference artifact/resource storage rather than embedding raw file paths or bytes in asset metadata.
- No persistent task history, marketplace, plugin package registry, or workflow execution store should be introduced in Phase 2A.

## Phase 2A implementation sequence

1. Prompt 1 — Asset Kernel audit and plan.
2. Prompt 2 — ADR and canonical terminology baseline.
3. Prompt 3 — Core Asset Kernel contracts: first shared `modules/contracts/asset` family only.
4. Prompt 4 — Detailed asset configuration contracts.
5. Prompt 5 — Detailed asset AI-context contracts.
6. Prompt 6 — Detailed asset ports, binding compatibility, and composition-rule contracts.
7. Prompt 7 — Asset validation service; Prompt 3 only adds issue/summary shapes.
8. Prompt 8 — Asset registry and application ports.
9. Prompt 9 — Local persistence adapter.
10. Prompt 10 — Resource-backed asset mapping and final Phase 2A regression.

Transport/UI work is intentionally deferred until after the kernel is proven through shared contracts, configuration contracts, AI context contracts, ports/composition contracts, validation, registry ports, persistence, and resource-backed mapping.

## Architecture boundaries and non-goals

Asset Kernel work must preserve clean architecture boundaries:

- shared asset contracts belong in `modules/contracts`,
- application validation/use cases belong in `modules/application`,
- adapters belong in `modules/adapters`,
- host wiring belongs in `modules/hosts`,
- UI belongs in apps/modules UI areas.

Non-goals preserved after Prompt 3:

- no detailed configuration contracts before Prompt 4,
- no detailed AI-context contracts before Prompt 5,
- no detailed ports, binding compatibility, or composition-rule contracts before Prompt 6,
- no validation service before Prompt 7,
- no asset registry or application ports before Prompt 8,
- no application service files,
- no persistence adapter before Prompt 9,
- no migrations,
- no renderer/thin-client UI,
- no API/IPC routes,
- no resource-backed mapping implementation before Prompt 10,
- no broad refactor,
- no asset marketplace/plugin system,
- no scheduler/queue/workflow execution engine changes,
- no runtime readiness changes,
- no storage rewrite,
- no artifact/model/dataset/image renames,
- no transport/UI-specific asset models,
- no file-only, UI-only, workflow-only, image-generation-only, or Hugging-Face-only asset model.
