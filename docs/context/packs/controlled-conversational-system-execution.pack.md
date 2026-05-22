# Context Pack: Controlled Conversational System Execution (Phase 13)

- Pack name: `controlled-conversational-system-execution`

## Purpose

Define and protect Phase 13 controlled execution orchestration for the first runnable composed-system slice: conversational system execution.

## Use When

- Conversational system execution architecture.
- Chatbot-style run/test surface design for composed systems.
- Conversation sessions, turns, messages/responses.
- Execution runs/attempts/events/results.
- Runtime approval/start/cancel/retry lifecycle.
- Text-generation runtime invocation boundaries.

## Canonical files to inspect
- `docs/architecture/asset-kernel.md`
- `docs/architecture/user-library-and-cross-workspace-reuse.md`
- `docs/architecture/asset-authoring-customization-and-overrides.md`
- `docs/architecture/effective-asset-projections.md`

- `docs/architecture/controlled-conversational-system-execution.md`
- `docs/adr/ADR-0023-controlled-conversational-system-execution.md`
- `docs/architecture/execution-plan-preparation.md`
- `docs/architecture/runtime-readiness-binding.md`
- `docs/architecture/asset-composition-planning.md`

## Core constraints

- Phase 13 Prompt 1 is architecture/docs/context only.
- Phase 12 remains non-executing.
- No invocation without explicit approval.
- Do not treat chatbot behavior as the universal runnable-system model.

## First runnable slice

- First runnable proof is conversational text-generation execution for composed systems.
- Image-generation/ComfyUI is deferred to later dedicated slices.

## Relationship to Phase 12

- Derive start eligibility from reviewed Phase 12 plan + runtime readiness validity + explicit approval.
- Do not mutate Phase 12 plan records for execution progress.

## Session/turn/run distinctions

- Conversation session = persistent user interaction context.
- Conversation turn = one user message + assistant response lifecycle.
- Execution run = controlled invocation for one turn.
- Execution attempt = one attempt within a run.

## Explicit approval boundary

Use explicit user action (`Test this system` / `Start chat`) before runtime invocation; approval stales/invalidates when source plan/readiness changes.

## Runtime adapter boundary

Use narrow invocation/cancellation/progress/result ports; first adapter is supported text-generation runtime, chosen later.

## Safe message/result/diagnostic constraints

- No raw provider payloads in general execution records.
- No raw runtime request/response exposure in diagnostics.
- Conversation message/assistant-response contract records are defined in Phase 13 Prompt 2; persistence adapter behavior remains deferred to later corrective prompts.

## Anti-drift rules

- Keep composed-system chain intact: assets -> composition -> readiness -> plan preview -> approved conversational execution session -> turn invocation.
- Unsupported plans must be blocked/deferred safely, not coerced.

## Transport prompt split rule

Beginning with Phase 13, do not combine in one prompt:
1. API/server-host exposure.
2. IPC/preload/desktop-host exposure.
3. Desktop/thin-client client/parity exposure.

## Deferred capabilities

Tools/function-calling, retrieval/RAG, memory, multimodal IO, image generation/ComfyUI execution, arbitrary workflow execution, background/distributed execution, and transport/UI implementation are deferred.

## Phase 13 prompt ownership

1. Prompt 1 — architecture baseline + ADR + docs/context pack.
2. Prompt 2 — contract vocabulary.
3. Prompt 3 — ports/persistence adapters.
4. Review A.
5. Prompt 4 onward — approval/session creation, orchestration, adapter, lifecycle, monitoring, transports, UI, hardening, closeout.


## Phase 13 corrective invariant (pre-Review A)
- Preserve asset-kernel, `system.foundation`, user-library importability, asset-authoring overrides, effective projections, composition planning, runtime readiness, and execution-plan preparation while implementing conversational execution work.
- Phase 13 conversational starter-system/run-surface changes must include asset/foundation/composition packs, not only execution packs.
- Runtime conversation/execution records are not reusable assets; reusable conversational assets must remain importable/customizable and lineage-linked to foundation primitives.
