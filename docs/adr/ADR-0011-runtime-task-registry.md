# ADR-0011: Runtime Task Registry for Long-Running Work

## Status
Proposed

## Context

Long-running AI work must not depend on a single long-held HTTP/IPC request path. Dataset preparation lifecycle migration to async task start/read/cancel proved this requirement in practice, and model training needs the same transport-timeout-safe lifecycle.

The system also needs one shared lifecycle model for runtime-backed task types (dataset preparation, model training, model validation, model publishing, and future tasks) without creating feature-specific queue abstractions.

## Decision

Introduce a shared **Runtime Task Registry** abstraction for long-running runtime work.

- Registry scope is one registry per Python runtime process initially.
- Node/application layers interact through runtime task contracts and ports.
- Task handlers remain task-specific (for example, dataset preparation and training handlers), while lifecycle/state management is shared.
- Queueing is treated as one behavior within the registry, not the identity of the system.

## Naming

The canonical name is **Runtime Task Registry**.

- Do not call this a “dataset queue” or “model queue”.
- A queue may exist inside registry behavior (for scheduling/concurrency), but the contract is lifecycle registry + status/progress management.

## Core Lifecycle

Runtime task lifecycle supports:

1. start (task accepted by runtime boundary)
2. queued
3. running
4. progress update (structured state update while running)
5. succeeded
6. failed
7. cancelled
8. unknown

## Identity Model

- `requestId` is the primary correlation identifier.
- `taskType` identifies the task handler/category.
- A durable task id may be added later if persistence/distributed scheduling requires it.

## Concurrency Classes

Initial concurrency classes:

- `cpu-light`
- `cpu-heavy`
- `gpu-exclusive`
- `io`
- `unknown`

Initial defaults and guidance:

- model training defaults to `gpu-exclusive`
- dataset preparation defaults to `cpu-heavy` unless configured otherwise
- validation/publishing can vary by task and runtime capabilities

## Cancellation Semantics

- queued tasks are usually cancellable before execution starts
- running tasks may not always be forcibly cancellable
- cancellation responses and terminal status must be truthful (no fake-cancel states)

## Retention

- Completed task records are retained in memory initially.
- Durable retention can be introduced later.
- Completed records must remain available long enough for polling UIs to read final terminal outcome/result.

## Progress and Event Model

- Structured progress is stored in the registry record.
- Runtime/process logs may still be emitted.
- UI/status APIs should treat registry status/progress as canonical and avoid raw log parsing as the primary state source.

## Power Lifecycle

Power-suspension blockers should attach to runtime task lifecycle activity where applicable.

- Blockers complement async lifecycle management.
- Blockers are not a substitute for start/read/cancel task lifecycle.

## Non-Goals

- No distributed queue in this phase.
- No persistent task database in this phase.
- No renderer-owned task lifecycle orchestration.
- No fallback to long-held HTTP/IPC request completion semantics.

## Domain Modeling Decision

Runtime domain value objects are added for identity/status/concurrency class because existing domain structure uses small value-object modules and explicit export surfaces. They remain adapter-agnostic and minimal.
