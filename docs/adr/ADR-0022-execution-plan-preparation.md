# ADR-0022: Execution Plan Preparation

- **Status:** Accepted
- **Date:** 2026-05-21

## Context

Phase 11 established runtime readiness bindings as workspace-scoped, non-executing readiness records that summarize setup choices, capability references, blockers, and diagnostics without invoking providers or running workflows.

The next architectural step needs a planning layer that converts readiness-backed composition context into inspectable execution intent for future orchestration, while preserving strict no-execution boundaries.

## Decision

Phase 12 introduces workspace-scoped execution plan preparation that converts ready Phase 11 runtime readiness bindings into safe, inspectable execution plan candidates. These plans describe intended steps, dependencies, inputs, outputs, adapter references, safety gates, blockers, diagnostics, and optional resource estimates, but do not execute workflows, invoke providers, install dependencies, download models, generate executable payloads, or run runtimes.

## Accepted Phase 12 boundaries

- Phase 12 owns non-executing planning metadata only.
- Phase 12 outputs execution plan candidates/previews for user/system inspection.
- Phase 12 preserves conservative blocker-first semantics when readiness or planning completeness is insufficient.

## Execution plan ownership and workspace scope

- Execution plans are workspace-scoped records.
- Execution plans reference a source composition plan and source runtime readiness binding.
- Execution plans remain planning records, including archived historical records.

## Depend on Phase 11 runtime readiness bindings

Phase 12 must consume readiness metadata through Phase 11 binding semantics (safe setup selections and safe capability/provider references). It must not bypass readiness by directly reading provider adapters, credentials, raw environment values, or raw local paths.

## Keep execution plan preparation non-executing

Execution plan preparation, preflight, and dry-run in Phase 12 are planning-only checks. They must not invoke providers, execute workflows, start runtimes, install dependencies, or download models.

## Use safe execution plan candidates/previews

Phase 12 plan records and previews must stay sanitized and non-runnable:

- no command lines,
- no workflow payloads for execution,
- no provider invocation payloads,
- no secrets/credentials,
- no raw paths/environment values,
- no bytes/blobs/base64/signed URLs.

## Defer provider/runtime invocation

Provider/model/runtime invocation and execution lifecycle ownership are deferred to Phase 13 orchestration work.

## Consequences

### Positive

- Clear architectural seam between readiness and execution orchestration.
- Safer review surface before any execution-capable phase.
- Deterministic blocker/diagnostic posture for incomplete readiness/input/output/safety states.

### Tradeoffs

- Additional state modeling and anti-drift constraints are required.
- Users may see plans marked `ready-for-review` that are not runnable, requiring clear UX language.

## Explicit non-goals

Phase 12 does not implement runtime/workflow/model/ComfyUI execution, provider invocation, dependency installation, model download, credential/secret creation/storage, shell command execution, environment mutation, executable payload generation, artifact generation, job lifecycle/progress/cancellation, runtime logs, marketplace behavior, collaboration, pack import/export, live cross-workspace synchronization, or source-record mutation.

## Relationship to Phase 11

Phase 12 is downstream from Phase 11 readiness bindings. If readiness is stale, blocked, invalid, missing, or otherwise insufficient, Phase 12 must emit execution-plan blockers/statuses instead of bypassing readiness.

## Phase 13 handoff implications

Phase 13 (Execution Orchestration and Controlled Runtime Invocation) may consume prepared execution plans to perform invocation, lifecycle management, progress, cancellation, recovery, and audit behaviors. Phase 12 supplies planning metadata and gate outcomes only.
