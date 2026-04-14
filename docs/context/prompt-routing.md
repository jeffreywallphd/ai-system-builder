# Prompt Routing

Use this guide to select **minimum-sufficient** context packs for prompts.

## Baseline (Always Include)

- `docs/context/packs/index.pack.md` is the authoritative baseline pack.
- Include it in all automated prompt assembly.

## Add Packs by Task Concern

| If the task materially involves... | Add this pack |
| --- | --- |
| repo layout, module placement, dependency direction at a repo level | `docs/context/packs/repository-overview.pack.md` |
| cross-layer architecture or boundary decisions | `docs/context/packs/architecture.pack.md` |
| runtime adapters, runtime contract shape, runtime execution flow | `docs/context/packs/runtime.pack.md` |
| Electron/desktop host lifecycle, IPC/preload boundaries, desktop composition | `docs/context/packs/desktop-host.pack.md` |
| server host lifecycle, Express transport boundaries, thin web client coupling | `docs/context/packs/server-host.pack.md` |
| documentation updates, canonical-vs-context discipline, doc governance | `docs/context/packs/docs-standards.pack.md` |
| structured logging behavior, diagnosability, log field/level discipline | `docs/context/packs/logging.pack.md` |
| test strategy, regression coverage, layered testing expectations | `docs/context/packs/testing.pack.md` |

## Selection Rules

- Start with `index.pack.md`, then add only packs materially relevant to the task.
- Do not include packs “just in case.”
- Select packs based on the task’s actual architectural and implementation concerns.
