# AI Companion: Run Query And History Discovery

## What changed
- Story 4.2.3 extends authoritative run read use cases (`GetAuthoritativeRunUseCase`, `ListAuthoritativeRunsUseCase`) so image-run history can be queried from authoritative persisted metadata rather than UI-local memory.
- Query/list supports owner/system/status/time filters, recent activity windows, and completion-state filtering in the application layer.
- Optional read-authorization hooks are available directly in the query use cases for non-HTTP callers and future thin-client compositions.

## Key behavior
- Workspace scope is mandatory for list operations.
- List filters cover owner/system/status/time plus search/workflow/source.
- Completion-state filters map lifecycle states into terminal/non-terminal and success/failure/cancel categories.
- Get/list projections now include history hints:
  - normalized status
  - progress snapshot summary
  - failure/result availability
  - owner/system metadata extracted from authoritative snapshots

## Security and policy
- Read visibility remains governed by `run.read`.
- When the query authorization port is configured, use cases enforce workspace/run visibility directly.
- Denied visibility returns empty/no-detail results without leaking run existence.

## Why this matters
- Studio history panes and monitoring views can rely on durable authoritative records.
- Reopen/continuity workflows can hydrate from server-truth run history.
- The query surface is ready for future multi-surface clients without architectural rework.
