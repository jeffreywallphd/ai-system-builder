# Runtime Readiness Binding (Phase 11 Baseline)

## Purpose and phase placement

Phase 11 introduces **Runtime Readiness Binding**: a workspace-scoped, non-executing readiness layer that evaluates whether a validated Phase 10 composition plan can be safely mapped to available runtime capabilities.

**Architecture thesis:** Phase 11 introduces workspace-scoped runtime readiness bindings that map validated Phase 10 composition plans to available runtime capabilities without executing workflows. Runtime readiness binding identifies required capabilities, evaluates available providers/resources/models/services, records safe binding candidates, and reports blockers before any execution-oriented phase begins.

Phase 11 is:

- a readiness layer;
- workspace-scoped;
- non-executing;
- capability-oriented;
- provider-aware but not provider-invoking;
- dependent on validated Phase 10 composition plans;
- explicit about missing/unavailable/unsupported dependencies;
- a preparation step for later execution-oriented planning.

## Canonical vocabulary

- **Runtime readiness binding**: workspace-scoped planning metadata that maps required runtime capabilities from a validated composition plan to safe available capability/provider candidates.
- **Runtime readiness check**: deterministic, non-executing evaluation that discovers capabilities, matches requirements to candidates, and emits statuses/blockers/diagnostics.
- **Runtime capability**: a named runtime concern that may be required or provided (for example `model-provider`, `workspace-storage`, `comfyui-runtime`).
- **Runtime requirement**: a capability need derived from a composition plan node/relationship/plan summary.
- **Required runtime capability**: capability required by the plan for later execution planning.
- **Provided runtime capability**: capability advertised by runtime inventory/provider candidates.
- **Runtime provider**: host/runtime adapter source that can expose capabilities via safe inventory abstraction.
- **Runtime provider candidate**: a discovered provider/capability option with safe availability/configuration status metadata.
- **Runtime binding candidate**: potential match from one requirement to one provider candidate.
- **Runtime binding**: confirmed readiness-time association between a requirement and a provider candidate.
- **Runtime binding status**: status of a requirement-to-provider association (candidate/confirmed/blocked/stale, etc.).
- **Runtime readiness status**: overall readiness record status (`draft`, `checking`, `ready-for-setup`, etc.).
- **Runtime readiness blocker**: condition preventing safe capability binding for one or more required capabilities.
- **Runtime readiness diagnostic**: sanitized explanatory note/warning/error for readiness outcomes.
- **Runtime inventory**: safe aggregated view of known capability/provider availability from host/runtime adapter sources.
- **Runtime inventory source**: specific host/adapter seam contributing inventory metadata.
- **Capability discovery**: collecting safe provided capability summaries from inventory sources.
- **Capability matching**: mapping required capabilities to discovered provider candidates under constraints.
- **Capability gap**: required capability without a safe matching candidate.
- **Provider unavailable / unsupported / not installed / not configured**: explicit availability outcomes used for blockers/diagnostics.
- **Model unavailable / Storage unavailable / Service unavailable / Permission unavailable / Environment unavailable**: requirement-specific blocker categories.
- **Execution deferred**: explicit marker that Phase 11 does not execute workflows/runtimes/providers/models.
- **Execution handoff**: constrained handoff object for later phases.

User-facing UI labels should remain simpler (for example: **Ready for setup**, **Needs setup**, **Missing requirement**, **Provider unavailable**, **Model missing**, **Storage unavailable**, **Check setup**, **Nothing runs from this screen**).

## Conceptual model (non-contract baseline)

Phase 11 defines conceptual readiness records only.

### Runtime readiness binding record (conceptual)

- readiness binding ID;
- target workspace ID;
- composition plan ID;
- composition plan validation reference;
- runtime readiness status;
- required runtime capabilities;
- available provider candidates;
- selected binding candidates;
- confirmed bindings;
- blockers;
- diagnostics;
- provenance;
- created/updated timestamps.

### Runtime requirement (conceptual)

- requirement ID;
- source composition plan ID;
- source node ID or relationship ID (when applicable);
- capability kind;
- capability key;
- required/optional flag;
- safe label/summary;
- matching constraints;
- diagnostics/blockers.

### Runtime capability/provider candidate (conceptual)

- provider candidate ID;
- provider kind;
- capability kind;
- capability key;
- availability status;
- configuration status;
- safe display label;
- safe diagnostic summary;
- **no secrets**;
- **no raw local paths** (use safe handles/references).

### Runtime binding candidate (conceptual)

- binding candidate ID;
- requirement ID;
- provider candidate ID;
- match status;
- optional confidence/match quality;
- blockers;
- diagnostics.

### Runtime binding (conceptual)

- binding ID;
- requirement ID;
- provider candidate ID;
- binding status;
- safe configuration reference (if needed);
- provenance.

All Phase 11 records are readiness/planning metadata only and must not contain executable commands, workflow JSON, provider payloads, secrets, raw environment values, raw paths, bytes/blobs/base64, signed URLs, or runnable payloads.

## Runtime readiness statuses

Baseline status vocabulary:

- `draft`
- `checking`
- `ready-for-setup`
- `blocked`
- `missing-requirements`
- `provider-unavailable`
- `provider-unsupported`
- `configuration-required`
- `permission-required`
- `stale`
- `invalid`
- `archived`

Status rules:

- `ready-for-setup` does **not** mean executable.
- `ready-for-setup` does **not** mean runtime-ready-to-run.
- `blocked` means at least one required capability cannot be bound safely.
- `missing-requirements` means no matching candidates for required capabilities.
- `configuration-required` means capability may exist but required configuration is missing.
- `permission-required` means access permission is not established.
- `stale` means composition plan/runtime inventory changed and check is required.
- `archived` means historical/inactive readiness record.

Forbidden status language in Phase 11 architecture: `execution-ready`, `ready-to-run`, `running`, `completed`, `executed`.

## Capability kinds and provider availability model

Initial conservative capability kinds:

- `local-runtime`
- `remote-runtime`
- `model-provider`
- `model`
- `image-generation-runtime`
- `text-generation-runtime`
- `embedding-runtime`
- `storage-provider`
- `artifact-storage`
- `workspace-storage`
- `file-access`
- `network-access`
- `api-service`
- `credential-reference`
- `gpu-capability`
- `cpu-capability`
- `memory-capability`
- `python-runtime`
- `node-runtime`
- `comfyui-runtime`
- `database`
- `queue`
- `scheduler`

Future phases may refine kinds for concrete verticals (for example ComfyUI image-generation slices).

Provider/capability availability statuses:

- `available`
- `unavailable`
- `not-installed`
- `not-configured`
- `permission-required`
- `unsupported`
- `stale`
- `unknown`
- `error`

Availability rules:

- `available` means visible to readiness checks, not safe-to-execute proof.
- `not-configured` must not expose secrets/env raw values.
- `error` diagnostics must be sanitized.
- `unknown` is handled conservatively (block required capabilities, warn optional).

## Runtime inventory model

Runtime inventory is a safe abstraction over runtime/provider availability. It may include:

- installed local runtimes;
- registered remote providers;
- configured model providers;
- known model availability summaries;
- storage providers;
- service endpoint summaries;
- permission summaries;
- environment capability summaries.

Runtime inventory must not expose secrets/tokens/raw env variables/raw paths/provider payloads/command lines/stack traces/bytes/blobs/base64/signed URLs. Raw details, when later needed, must be represented by safe handles/references.

## Relationship to Phase 10 composition planning

Phase 11 depends on validated Phase 10 composition plans and may read:

- validated composition plan ID;
- workspace ID;
- plan status;
- selected projections;
- nodes/relationships;
- required/provided capabilities;
- plan blockers/diagnostics;
- planning summary/provenance summary;
- validated timestamp when available.

Phase 11 must not:

- accept unvalidated plans as ready (it returns blocked diagnostics instead);
- reinterpret raw Phase 9 projections directly when Phase 10 plan data exists;
- mutate composition plans (except future explicit refresh/check workflows);
- treat Phase 10 `valid` as executable;
- generate workflow JSON;
- execute nodes/workflows;
- invoke providers;
- install runtimes/download models/create credentials/write secrets.

If a composition plan is missing/invalid/blocked/conflicted/stale/unsupported/archived/not validated, Phase 11 emits readiness blockers rather than bypassing planning constraints.

## Relationship to Phase 9 effective projections

Phase 11 normally consumes Phase 10 plan outputs, not raw Phase 9 projection internals. Phase 11 may use projection summary references for freshness checks when surfaced through Phase 10 read models. Phase 11 does not reconstruct projection logic or inspect raw authoring/customization internals.

## Relationship to runtime adapters and hosts

Phase 11 may read safe inventory/capability summaries from runtime/provider adapters through application ports.

Phase 11 must not call execution methods, invoke models, start ComfyUI workflows, mutate provider state, install dependencies, download models, run shell commands, read raw env values directly in use cases, expose local paths, or expose credentials.

Host expectations:

- Desktop host may expose safe local inventory (Python/Node/ComfyUI/model cache summaries) via application ports.
- Server host may expose server-side inventory/provider summaries.
- Thin client must not inspect desktop-local resources directly; access is through server/desktop host APIs.
- No host executes workflows in Phase 11.

## What Phase 11 implements vs defers

Implements in Phase 11:

- readiness vocabulary and architecture baseline;
- capability requirement extraction from validated plans;
- safe inventory discovery/matching model;
- readiness status/blocker/diagnostic model;
- readiness handoff object for Phase 12.

Defers from Phase 11:

- workflow/runtime/model/ComfyUI execution;
- provider invocation;
- dependency installation/model download;
- credential creation/secret storage;
- shell command execution/environment mutation;
- visual canvas authoring/arbitrary graph editing;
- workflow JSON or materialized executable payload generation;
- pack import/export/marketplace behavior;
- collaboration permissions/live workspace sync;
- source asset mutation or `system.foundation` mutation/copy.

## Phase 12 handoff

Phase 11 hands off readiness metadata to Phase 12 (**Execution Plan Preparation** / **Executable Workflow Materialization Planning**) through a conceptual object such as:

```ts
RuntimeReadyCompositionBinding {
  readinessBindingId
  workspaceId
  compositionPlanId
  requiredCapabilities[]
  selectedBindings[]
  unresolvedRequirements[]
  readinessStatus
  blockers[]
  diagnostics[]
}
```

Phase 12 may prepare execution-oriented plans/payloads (materialization planning, adapter selection, safety gates, dry-run planning, reservation, execution preview), but actual execution remains explicitly defined by later phase boundaries.

## Phase 11 implementation sequence

1. Prompt 1 — Architecture baseline, ADR, docs, context pack.
2. Prompt 2 — Runtime capability/binding contract vocabulary.
3. Prompt 3 — Application ports and persistence adapters for readiness checks/bindings.
4. Review A — Contracts, ports, persistence, and no-execution boundary review.
5. Prompt 4 — Runtime capability inventory/read services.
6. Prompt 5 — Bind validated composition plans to required runtime capabilities.
7. Prompt 6 — Readiness validation: missing providers, unavailable models, storage/server/API/runtime blockers.
8. Review B — Binding semantics, blocker accuracy, and no-runtime-execution review.
9. Prompt 7 — Runtime readiness read model integration.
10. Prompt 8 — API/IPC/preload/client exposure.
11. Prompt 9 — Minimal UI inside Assets/Plans showing runtime readiness status.
12. Prompt 10 — Docs closeout and Phase 11 final hardening.
13. Review C — Final Phase 11 closeout review.

If Prompt 8 transport scope is too broad, split into:

- 8a API routes and server composition;
- 8b IPC/preload and desktop composition;
- 8c desktop/thin-client clients and parity tests.
