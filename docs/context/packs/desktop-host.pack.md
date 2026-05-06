# Context Pack: Desktop Host

- Pack name: `desktop-host`

## Purpose

- Provide focused guidance for desktop host composition and Electron boundary discipline.

## Use When

- Working in `apps/desktop`.
- Working in `modules/hosts/desktop`.
- Implementing/changing Electron `main`, preload, IPC, window lifecycle, or desktop bootstrap wiring.

## Do Not Use When

- Server-only transport/host tasks.
- Runtime or domain/application changes with no desktop-host impact.

## Core Guidance

- Desktop is a host model, not the entire architecture.
- Electron and Electron Forge are the desktop host/build tooling path.
- Preload and IPC are transport/boundary mechanics, not business logic layers.
- IPC contracts must remain transport specializations: reuse transport request/response/error semantics and add only channel identity context.
- Keep IPC channel naming constrained and operation-derived (`ipc.<operation>.<kind>`), so operation and channel do not drift independently.
- Restrict IPC channel kind to `request`, `response`, or `event`; do not introduce ad hoc kind variants.
- Keep business policy and use-case orchestration in application/domain, not `main`/preload/IPC glue. Desktop runtime readiness IPC should depend on the application `RuntimeReadinessPort` and wrap shared runtime readiness contracts without duplicating readiness shapes.
- Desktop host code should compose adapters and lifecycle behavior, then delegate inward. Compose runtime capability guards from the same `RuntimeReadinessPort` used for desktop readiness IPC and inject them into runtime-backed start use cases; IPC should map guard failures to sanitized `unavailable` responses without changing read/cancel/finalize behavior.
- Desktop host code should compose adapters and lifecycle behavior, then delegate inward. Runtime readiness providers in desktop composition must read non-starting supervisor/installer signals only; Python-specific IPC remains a separate detailed control/diagnostic surface.
- Focused desktop composition helper modules are allowed for concrete adapter/use-case wiring and transport registration; keep them role-specific and composition-only so they do not become dumping grounds for business rules, runtime protocol details, or IPC payload mapping. Phase 1 currently extracted runtime readiness composition and a small runtime-task-registry helper only; broader desktop storage/model/image-generation decomposition remains future cleanup unless done explicitly.
- When adding desktop host features, typecheck the full desktop composition dependency closure under `apps/desktop/tsconfig.webpack.json`; `ts-loader` with `noEmitOnError` can surface reachable TypeScript diagnostics as a vague `emitted no output` failure at `composeDesktopHost.ts`.
- When desktop composition wraps a typed adapter/application port to add logging or host lifecycle behavior, spread the full existing port first and override only the adapted method(s); hand-built partial port objects can drift when port contracts add methods and surface as vague `ts-loader` no-output failures.
- Pass inward host metadata through `modules/contracts/host` host-context shapes,
  not Electron-specific objects.
- Keep host-context metadata small and serialization-friendly (JSON-serializable values only).
- Do not encode auth/session/request/window/framework semantics in host-context metadata.
- Electron-specific assumptions must not leak into shared application/domain contracts.

## Key Constraints

## Host-owned runtime execution guidance

- Desktop renderer should keep using preload/IPC even when a feature later executes remotely.
- Desktop host composition may later route features to local adapters or remote server API client adapters.
- Do not put configured-server calls directly in desktop renderer components for runtime-heavy feature execution.
- Desktop local runtime roots are desktop-owned.
- Desktop and server runtime roots should not be shared by default.
- See ADR-0013.


- Do not turn IPC handlers into a miscellaneous service layer.
- Keep desktop transport translation thin and contract-driven.
- Keep IPC request/response/error envelopes transport-compatible and free of Electron object leakage.
- Preserve compatibility with multi-host architecture by avoiding desktop-only coupling in core layers.

## Canonical Source Docs

- `docs/architecture/host-model.md` — host responsibilities and desktop-first staging.
- `docs/adr/ADR-0003-host-model-and-transport-separation.md` — separation of host lifecycle and transport concerns.
- `docs/architecture/module-dependency-rules.md` — dependency boundaries for hosts and adapters.
- `docs/standards/coding-standards.md` — anti-patterns around host/transport logic leakage.
- `docs/standards/logging-standards.md` — startup and boundary diagnostics expectations.

## Common Over-Inclusions to Avoid

- Loading server host/API transport guidance for desktop-only tasks.
- Treating Electron API details as architectural rules for all modules.
- Pulling persistence/storage deep detail unless desktop work changes those boundaries.

## Prompt Assembly Notes

- Typical set: `index` + `desktop-host`.
- Add `desktop-implementation` for renderer/main/preload structure work.
- Add `architecture` for cross-layer changes.
- Add `logging` for startup/IPC diagnostics and `testing` for regression-sensitive changes.

- Desktop remote server credentials should live behind desktop host credential-store seams (not renderer-local ad hoc storage).
- Future remote feature execution must use secure API client adapters behind desktop IPC boundaries.
