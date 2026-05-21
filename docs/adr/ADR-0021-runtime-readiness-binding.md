# ADR-0021: Runtime Readiness Binding

- Status: Accepted
- Date: 2026-05-21
- Deciders: Core architecture maintainers
- Related: docs/architecture/runtime-readiness-binding.md, docs/architecture/asset-composition-planning.md, docs/architecture/effective-asset-projections.md, docs/adr/ADR-0020-asset-composition-planning.md, docs/adr/ADR-0019-effective-asset-projections.md

## Context

Phase 10 introduced validated workspace-scoped asset composition plans that remain planning-only and non-executing. The next architecture layer must determine whether required runtime capabilities are available before execution-oriented phases begin.

The repository needs a conservative readiness layer that:

- depends on validated composition plans;
- maps required capabilities to safe provider/capability inventory summaries;
- reports blockers and diagnostics clearly;
- avoids execution/provider invocation/installation concerns.

## Decision

Phase 11 introduces workspace-scoped runtime readiness bindings that map validated Phase 10 composition plans to safe runtime capability/provider inventory. These bindings identify available candidates, missing requirements, and blockers, but do not execute workflows, invoke providers, install dependencies, download models, or generate executable payloads.

## Accepted Phase 11 boundaries

Phase 11 accepts only readiness responsibilities:

- capability requirement extraction from validated plans;
- safe inventory discovery and capability matching;
- binding candidate and confirmed-binding metadata;
- readiness statuses, blockers, diagnostics, and provenance;
- handoff metadata to Phase 12.

## Runtime readiness ownership and workspace scope

Runtime readiness records are workspace-scoped planning metadata. Ownership is application/readiness-layer governed, while inventory sources come from host/runtime adapter seams. No direct UI/runtime host execution is owned by Phase 11.

## Depend on validated Phase 10 composition plans

Phase 11 consumes validated plan status/data as the sole normal source of readiness requirements. If plan state is missing/invalid/blocked/conflicted/stale/unsupported/archived/unvalidated, readiness returns blockers instead of bypassing planning.

## Keep runtime readiness non-executing

Readiness checks remain non-executing and must not:

- run workflows or runtime nodes;
- invoke provider/model execution APIs;
- generate execution payloads;
- mutate runtime/provider installation state.

## Use safe runtime inventory abstractions

Inventory is represented by safe capability/provider summaries only. No secrets, raw env values, raw filesystem paths, command lines, tokens, stack traces, provider payloads, bytes/blobs/base64, or signed URLs are exposed from readiness records.

## Defer provider invocation and execution

Provider invocation, model execution, workflow execution, installation, and model download are deferred to later phases and specific execution-oriented boundaries.

## Relationship to Phase 10

Phase 11 is downstream of Phase 10 composition planning. `valid` in Phase 10 means planning-valid only, not executable. Phase 11 preserves that constraint and only evaluates readiness-to-prepare.

## Phase 12 handoff implications

Phase 11 outputs a constrained readiness handoff object (`RuntimeReadyCompositionBinding` conceptual shape) for Phase 12 execution plan preparation/materialization planning. Phase 12 may remain non-executing unless explicitly expanded later.

## Consequences

Positive:

- clear separation between planning/readiness/execution concerns;
- explicit blocker surfaces before execution-oriented work;
- safer host/runtime inventory abstractions;
- predictable workspace-scoped readiness ownership.

Tradeoffs:

- readiness cannot guarantee successful execution;
- execution-specific failures remain for later phases;
- requires strict anti-drift rules to prevent accidental execution creep.

## Explicit non-goals

Phase 11 does not implement:

- workflow/runtime/model/ComfyUI execution;
- provider invocation;
- dependency installation/model download;
- credential creation/secret storage;
- shell command execution/environment mutation;
- workflow JSON/materialized executable payload generation;
- visual canvas authoring/arbitrary graph editing;
- pack import/export/marketplace behavior;
- collaboration permissions/live workspace synchronization;
- source mutation or `system.foundation` mutation/copying.
