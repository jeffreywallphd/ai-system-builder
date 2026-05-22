# ADR-0023: Controlled Conversational System Execution

- Status: Accepted
- Date: 2026-05-22

## Context

Phase 12 established execution-plan preparation as a non-executing preview layer. The next step is the first runnable composed-system vertical slice. The project direction now selects conversational execution (chat-style interaction) as that first proof, while preserving general runnable-system architecture and avoiding a chat-only domain model.

## Decision

1. Phase 13 uses a user-configured conversational system as the first runnable-system proof.
2. Phase 13 preserves the general composed-system execution architecture and keeps chatbot execution as one slice, not the universal model.
3. Phase 12 remains non-executing; `ready-for-review` is not invocation.
4. Phase 13 requires explicit approval before runtime invocation.
5. Phase 13 models conversation sessions, turns, execution runs, attempts, events, and results as separate concepts.
6. Default mapping is one assistant-generating turn to one controlled execution run lifecycle (with one or more attempts).
7. First adapter direction is text-generation oriented; ComfyUI/image-generation is deferred to a later slice.
8. Tools, retrieval, memory, multimodal behavior, and arbitrary workflow execution are deferred.
9. Future transport exposure is split into separate prompts for: API/server-host, IPC/preload/desktop-host, and desktop/thin-client wrapper parity.

## Decision summary

Phase 13 introduces controlled execution orchestration for the first runnable composed-system vertical slice: a user-configured conversational AI system. Reviewed Phase 12 execution plans may lead to explicitly approved conversation sessions whose turns invoke supported text-generation capabilities through a narrow runtime adapter boundary. Conversation, run, attempt, result, progress, cancellation, retry, and provenance concepts are modeled separately so the chatbot slice proves general runnable-system architecture rather than defining all future systems as chat applications.

## Consequences

- Enables the first end-to-end runnable experience while preserving prior composition/readiness/planning boundaries.
- Creates explicit approval/lifecycle boundaries for safe invocation.
- Establishes status vocabulary and lifecycle auditing foundations for later runtime slices.
- Requires careful message-content privacy/persistence boundary decisions in later prompts.

## Explicit non-goals (Prompt 1)

No implementation of contracts, ports, persistence adapters, use cases, read models, API routes, IPC/preload, desktop/thin-client wrappers, runtime invocation, provider calls, local model loading, UI chat surface, streaming, cancellation/retry runtime behavior, tools/retrieval/memory/multimodal, workflow execution, ComfyUI/image-generation execution, or mutation of Phase 9/10/11/12 records.

## Relationship to Phase 12

Phase 13 depends on reviewed Phase 12 execution plans and related readiness/composition references, but does not mutate execution-plan records to represent execution progress. Progress belongs to Phase 13 execution session/turn/run records.

## Later runnable-system slice implications

The Phase 13 orchestration model must later support additional system types such as image generation, data transformation, document QA, retrieval-augmented systems, tool-using assistants, API-connected systems, multimodal interaction, and potential scheduled/distributed execution.
