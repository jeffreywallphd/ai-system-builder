# Controlled Conversational System Execution (Phase 13 Baseline)

## Purpose

Phase 13 introduces the first **runnable** composed-system execution slice while preserving the existing composition-first architecture.

**Architecture thesis:**

> Phase 13 introduces controlled execution orchestration for the first runnable composed-system vertical slice: a user-configured conversational AI system. A reviewed Phase 12 execution plan may be used to create an explicitly approved conversation execution session whose user-message turns invoke a supported text-generation runtime through a narrow runtime adapter boundary. Phase 13 records lifecycle, progress, safe diagnostics, assistant response results, cancellation, retry, and provenance without making chatbot behavior, one model runtime, or provider-specific payloads the general definition of runnable systems.

**Invariant:**

> The first conversational-system execution slice must exercise the general composed-system execution architecture. It must not make a chat page, prompt string, one local model, one API provider, or one runtime implementation the domain model for runnable systems.

## Product direction

- Users are still composing customized runnable systems from assets, workspace-effective customizations, composition plans, runtime readiness bindings, and execution-plan previews.
- The first executable proof is now conversational (chat-style test/run), not image-generation-first.
- Conversational execution is selected because it demonstrates customization, repeated interaction, session state, controlled invocation, response persistence needs, and an extensible path toward tools/retrieval/memory.
- Image generation remains a later runnable-system slice; it is not removed from the roadmap.
- ComfyUI is not the Phase 13 first adapter unless explicitly selected in a later image-generation phase.

## Phase 12 prerequisite and dependency boundary

Phase 13 depends on Phase 12 being reconciled as a stable, non-executing planning layer.

Phase 13 may rely on Phase 12 providing:

- workspace-scoped execution plan records;
- execution plan previews in Assets / Plans / Setup;
- source composition plan and runtime readiness binding references;
- planned steps/inputs/outputs/dependencies;
- safe adapter/setup references;
- safety gates, blockers, diagnostics, resource estimates, provenance;
- `ready-for-review` status that is explicitly non-executing.

If Phase 12 has unresolved material defects, Phase 13 work should not proceed beyond architecture/docs clarification until those defects are corrected.

## Core concepts and vocabulary

- **Controlled execution orchestration**: explicit, policy-checked execution lifecycle for runnable systems.
- **Runnable conversational system**: a composed system whose supported execution behavior is turn-based text generation.
- **Conversational system definition**: safe references/configuration that define conversational behavior for a composed system.
- **Execution session**: approved execution context tied to reviewed plan/readiness inputs.
- **Conversation session**: user-visible persistent chat context for a configured composed system.
- **Conversation turn**: one user message and corresponding assistant-response generation lifecycle.
- **User message**: user input submitted for a turn.
- **Assistant response**: generated assistant output associated with the turn result.
- **Execution run**: controlled operational invocation producing one turn result.
- **Execution attempt**: one attempt within a run (supports retry/failure/cancellation tracking).
- **Execution event**: safe lifecycle/progress/audit event during orchestration.
- **Execution result**: safe recorded output reference for a run/turn.
- **Execution approval**: explicit user/system authorization boundary required before invocation.
- **Approval gate**: policy checkpoint validating approval scope validity.
- **Start eligibility**: validation that plan/readiness/approval/support constraints permit invocation.
- **Runtime invocation port**: application-facing boundary used to request supported runtime execution.
- **Text-generation runtime adapter**: adapter implementing supported text-generation invocation behind the runtime port.
- **Supported runtime adapter**: adapter explicitly approved for this execution slice.
- **Turn invocation**: run creation + invocation flow for a submitted turn.
- **Response generation**: controlled production of assistant response result.
- **Progress event**: safe state/progress signal during invocation.
- **Cancellation request**: explicit request to stop an in-flight run/attempt.
- **Retry request**: explicit request to start a new attempt under safe policy.
- **Failure classification**: normalized safe failure type (no raw provider payloads).
- **Result reference**: stable safe pointer to assistant response/result record.
- **Conversation history reference**: stable safe pointer to session turn history.
- **Safe diagnostic**: bounded redacted diagnostic data.
- **Audit/provenance event**: immutable event describing lifecycle/provenance transitions.
- **Runtime unavailable**, **runtime not ready**, **execution unsupported**, **execution blocked**, **execution stale**, **execution deferred for unsupported systems**: safe execution-state outcomes.

## System relationship (not a separate chatbot app)

Phase 13 does not introduce an unrelated chatbot feature. Runnable conversational execution remains downstream from composed-system architecture:

assets/customizations -> workspace-effective assets -> composition plan -> runtime readiness binding -> execution plan preview -> approved conversation execution session -> controlled turn invocation -> assistant response/result reference.

A conversational system may include safe configuration such as display label, instruction reference, supported text-generation capability label, generation settings, greeting, and expected IO role semantics. Final prompt/materialization boundaries are deferred to later Phase 13 prompts.

## Conceptual model (Phase 13 Prompt 1 only; no contract implementation)

### Conversational system execution session

Conceptually includes: execution session id, conversation session id, workspace id, source execution plan id, source composition plan id, source runtime readiness binding id, supported adapter reference, status, approval status/reference, display label, conversation history reference, turn summaries, blockers, diagnostics, provenance, timestamps.

### Conversation turn

Conceptually includes: turn id, conversation session id, execution run id, optional attempt ids, user-message reference/content boundary (deferred), assistant-response result reference, turn status, capability reference, progress/event summary, blockers, diagnostics, timestamps.

### Execution run

Conceptually includes: run id, workspace id, source execution plan id, conversation session id, turn id, run status, approval reference, runtime adapter reference, attempt summaries, progress/event summaries, result references, failure/cancellation/retry info, blockers, diagnostics, provenance, timestamps.

### Execution attempt

Conceptually includes: attempt id, run id, attempt number, attempt status, supported adapter reference, timing/progress summary, result reference, failure classification, cancellation state, provenance, timestamps.

### Execution result

Conceptually includes: result id, run id, turn id, result kind (initially assistant response), safe response display reference/content boundary, optional future artifact reference, completion status, diagnostics, timestamps.

All Phase 13 records avoid credentials, secrets, raw env values, raw paths, command lines, stack traces, raw provider responses, signed URLs, bytes/base64, unbounded logs, executable payloads, or generic workflow JSON.

## Conversation session vs run distinction

- Conversation session: persistent interactive context.
- Conversation turn: one user-message/assistant-response interaction.
- Execution run: controlled invocation for that turn.
- Execution attempt: one attempt to complete a run.

Default model: one conversation session has many turns; each assistant-generating turn creates one execution run with one-or-more attempts.

## Approval and eligibility boundary

Phase 12 remains preview-only and non-executing.

Initial approval flow:
1. User reviews Phase 12 preview.
2. User selects **Test this system** / **Start chat**.
3. System creates conversation execution session tied to reviewed plan.
4. User confirms or initiates under valid runtime/setup conditions.
5. Each sent message creates a controlled turn/run invocation.

Initial policy: approval is valid for the active conversation session only while source execution plan and runtime readiness binding remain unchanged and valid. Any stale/changed inputs invalidate approval and block new invocations pending re-review.

## Initial statuses

- Conversation session: `draft`, `awaiting-approval`, `approved`, `active`, `blocked`, `stale`, `invalid`, `closed`, `archived`.
- Conversation turn: `draft`, `submitted`, `generating`, `succeeded`, `failed`, `cancel-requested`, `cancelled`, `retryable`, `blocked`, `stale`, `invalid`.
- Execution run: `draft`, `awaiting-approval`, `approved`, `queued`, `running`, `succeeded`, `failed`, `cancel-requested`, `cancelled`, `retryable`, `blocked`, `stale`, `invalid`, `archived`.
- Attempt: `pending`, `started`, `progressing`, `succeeded`, `failed`, `cancel-requested`, `cancelled`, `timed-out`.

`approved` permits later invocation but is not invocation. `queued` means accepted for invocation. `running` begins only when adapter execution starts. `succeeded` requires safe result reference. `cancel-requested` is not guaranteed cancellation completion. `retryable` requires safe policy. `stale` blocks invocation until revalidation.

## First supported runnable slice

Initially supported: conversational text-generation system with valid Phase 12 execution plan + valid runtime readiness binding + safe configuration references + user text input + assistant text response result + conversation association.

Not in initial slice: tools, retrieval, external actions, image/audio IO, arbitrary workflow graph execution.

Unsupported plans must resolve to safe unsupported/blocked/deferred outcomes.

## Runtime adapter boundary

Planned boundary concepts (implementation deferred):
- `TextGenerationInvocationPort`
- `ConversationTurnInvocationPort`
- `ExecutionCancellationPort`
- `ExecutionProgressSinkPort`
- `ExecutionResultSinkPort`

First concrete adapter selection is deferred to later prompts and should prefer existing safe runtime readiness infrastructure without requiring new secret-storage prerequisites.

## Message/content and diagnostics boundary

- Do not persist raw provider payloads in general execution records.
- Do not expose raw runtime request/response payloads in diagnostics.
- Message/assistant content persistence boundary is explicitly deferred to Prompt 2/3.
- User-authored instruction text should be referenced from authored assets/protected configuration, not duplicated in audit logs or generic run metadata.

## Relationship to Phase 10/11/12

- Primary dependency: Phase 12 execution plans.
- Eligibility verification: Phase 11 runtime readiness binding validity.
- Optional user-facing context: safe Phase 10 composition summary metadata.
- No mutation of Phase 9/10/11/12 records as execution side effect.
- Changed composition/readiness/plan inputs stale or invalidate approval per policy.

## UI direction (deferred)

In Assets / Plans / Setup: compact status/control area for preview state, readiness, conversational support, `Test this system`/`Start chat`, and blocked/review/setup messaging.

In conversational run workspace: system identity, conversation history, composer, assistant response area, generating/cancel/retry states, safe diagnostics, and explicit association to selected composed system.

Nothing runs until the user starts a conversation or sends a message.

## Transport prompt split rule (Phase 13+)

Do not combine in one implementation prompt:
1. API/server-host exposure.
2. IPC/preload/desktop-host exposure.
3. Desktop/thin-client client wrappers and parity.

These must be routed and reviewed as separate prompts.

## Phase 13 prompt sequence

1. Prompt 1 — baseline architecture/ADR/docs/context pack.
2. Prompt 2 — vocabulary/contracts for session/turn/run/attempt/event/result/approval/cancel/retry and safe message boundary.
3. Prompt 3 — application ports + persistence adapters.
4. Review A.
5. Prompt 4 — create/approve session and start eligibility.
6. Prompt 5 — invocation/orchestration ports/services/runtime guards.
7. Prompt 6 — first supported text-generation adapter.
8. Prompt 7 — lifecycle/progress/cancel/retry/result/failure classification.
9. Review B.
10. Prompt 8 — read models + monitoring summaries.
11. Prompt 9 — API/server-host exposure.
12. Prompt 10 — IPC/preload/desktop-host exposure.
13. Prompt 11 — desktop/thin-client wrappers + parity.
14. Prompt 12 — minimal chatbot test/run UI.
15. Prompt 13 — hardening (audit/diagnostics/failure recovery/privacy/invalidation).
16. Prompt 14 — docs closeout + full guardrails/tests + finalization.
17. Review C.

## Non-goals for Prompt 1

Prompt 1 is architecture/docs/context only. It does not implement contracts, ports, adapters, use cases, read models, runtime invocation, provider integration, persistence, API/IPC/preload/client/UI surfaces, message persistence, cancellation/retry runtime behavior, workflow/image/ComfyUI execution, tools/retrieval/memory/multimodal/background/distributed execution, or mutation of Phase 9/10/11/12 records.
