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
- asset validation services, registry/application ports, persistence adapters, or resource-backed mapping.

Prompt 6 has added descriptor-only shared contracts for ports, port contracts, binding constraints, dependencies, composition rules, composition cardinality, and composition validation summary shells. The pre-Prompt 7 cleanup keeps that direction while adding JSON-compatible shared metadata/details, first-class declarative `AssetRequirement`, safe semantic references such as `schemaRef: AssetReference`, and shared validation summary statuses; do not treat those contracts as implemented validation or runtime composition behavior.

## Canonical Asset Terminology

- `Asset`: reusable/composable semantic unit known to AI System Builder; may represent structure, behavior, interface, data, instructions, resources, compositions, or logic containers.
- `AssetDefinition`: reusable, versioned blueprint/template for a composable building block.
- `AssetInstance`: configured use of an asset definition in a specific composition or system context.
- `AssetBinding`: typed connection between instances, ports, resources, runtime capabilities, storage objects, or external repository objects.
- `AssetComposition`: validated assembly of configured instances and bindings into a feature, workflow, page, subsystem, system, or system-of-subsystems.
- `AssetReference`: stable transport-neutral reference to a definition, definition version, instance, composition, reusable asset requirement, or referenceable resource/artifact object.
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
7. Prompt 7 — Asset validation service; Prompt 3 only adds issue/summary shapes.
8. Prompt 8 — Asset registry and application ports.
9. Prompt 9 — Local persistence adapter.
10. Prompt 10 — Resource-backed asset mapping and final Phase 2A regression.

Pre-Prompt 7 cleanup is limited to JSON-safe metadata/details, first-class `AssetRequirement`, safe semantic references, and shared validation summary statuses only.

Prompt 6 status: `modules/contracts/asset` now holds the core contract family plus detailed configuration contracts, detailed structured AI-context contracts, and descriptor-only machine-readable port/composition contracts. Asset definitions can own optional reusable `ports`, inline declarative `requirements`, future externalized `requirementRefs`, `compositionRules`, and `dependencies`; asset bindings can reference source/target assets and source/target ports with optional binding constraints; asset compositions can reference instances, binding refs or inline bindings, composition rules, dependencies, and a lightweight validation summary shell. AI-context composition guidance remains semantic guidance, configuration contracts remain separate from port/composition contracts, and validation services remain Prompt 7. Registry/application ports remain Prompt 8, persistence remains Prompt 9, and resource-backed mapping remains Prompt 10.

Transport/UI work is deferred until after the kernel is proven through shared contracts, configuration, AI context, ports/composition, validation, registry ports, persistence, and resource-backed mapping. Prompt 6 does not add workflow execution, graph execution, UI page routing, API/IPC exposure, runtime behavior, or automatic composition.

## Explicit Non-Goals

- No TypeScript implementation when a prompt is documentation-only.
- No API/IPC/UI asset models before shared contracts stabilize.
- No persistence adapter before contracts, validation, and registry/application ports stabilize.
- No marketplace/plugin package registry, persistent task history, workflow execution store, scheduler/queue changes, runtime readiness changes, storage rewrite, or broad refactor in Phase 2A unless a later prompt explicitly changes scope.
