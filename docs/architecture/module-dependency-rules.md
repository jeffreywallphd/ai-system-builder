# Module Dependency Rules

This document defines practical dependency rules for `ai-system-builder`.

The objective is simple: keep core logic independent, keep boundaries explicit, and stop accidental coupling early.

## Dependency direction (default)

Preferred dependency flow is **outside-in at runtime, inside-out for source dependencies**:

- outer layers (apps/hosts/adapters/UI) may depend inward on contracts/application/domain,
- inner layers (domain/application) must not depend outward on infrastructure/host/UI specifics.

## Allowed and disallowed dependencies

## 1) Domain (`modules/domain`)

**Allowed**

- Internal domain modules.
- Shared, framework-neutral utilities that do not pull infrastructure concerns.

**Not allowed**

- `modules/adapters/**`
- `modules/hosts/**`
- `modules/ui/**`
- `apps/**`
- Transport or framework APIs (Express, Electron IPC, DB clients, etc.).

**Rule**: Domain is the most protected layer.

## 2) Application (`modules/application`)

**Allowed**

- `modules/domain/**`
- `modules/contracts/**` (for boundary shapes)
- Application-local ports/policies/DTOs.

**Not allowed**

- Concrete adapter implementations (`modules/adapters/**`)
- Host lifecycle logic (`modules/hosts/**`)
- UI modules (`modules/ui/**`)
- App entry point code (`apps/**`)

**Rule**: Application defines orchestration and required ports; it does not select infrastructure.

## 3) Contracts (`modules/contracts`)

**Allowed**

- Contract-local types and schema helpers that remain boundary-oriented.

**Not allowed**

- Domain business logic.
- Concrete adapter/framework dependencies.

**Rule**: Contracts are stable cross-boundary language, not implementation containers.

## 4) Adapters (`modules/adapters`)

**Allowed**

- `modules/contracts/**`
- `modules/application/**` ports/interfaces/use-case entry contracts.
- `modules/domain/**` types only when needed and not causing inward leakage.
- External libraries needed for concrete integration (DB drivers, Express wiring, runtime bridge clients, etc.).

**Not allowed**

- Reaching into app entry points for core logic.
- Owning business rules that belong in application/domain.

**Rule**: Adapters implement details at boundaries; they should depend inward, not the reverse.

## 5) Hosts (`modules/hosts`)

**Allowed**

- `modules/application/**`
- `modules/contracts/**`
- `modules/adapters/**`
- Host framework APIs (Electron host lifecycle, server process lifecycle, etc.).

**Not allowed**

- Embedding core business rules directly in host startup/lifecycle code.

**Rule**: Hosts compose and run the system for a target environment. They are not transport adapters and not business-logic layers.

## 6) UI (`modules/ui`)

**Allowed**

- `modules/contracts/**` and UI-facing application interfaces.
- `modules/ui/shared/**` reused by platform-specific UI layers.

**Not allowed**

- Direct dependency on persistence/storage/transport adapter internals.
- Business logic that should live in application/domain.

**Rule**: UI consumes exposed use-case interfaces/contracts; it should not bypass boundaries into infrastructure.

## 7) Apps (`apps/*`)

**Allowed**

- Host composition and wiring imports.
- Build/runtime bootstrap code.

**Not allowed**

- Becoming the main container for core logic.

**Rule**: Apps are entry points and packaging surfaces, not architecture centers.

## Anti-rules (common failure patterns)

Avoid these patterns even if they "work":

- Route or IPC handlers containing business decision trees.
- Domain importing an ORM model, DB client, or host API.
- UI calling DB or file APIs directly.
- App-level scripts becoming permanent orchestration layers.
- Creating new packages/folders to solve local complexity before simplifying boundaries.

## Enforcement status

Some automated rule enforcement may be added later (lint/import rules/build checks), but full tooling is **not yet finalized**.

Until then, treat this document as mandatory review criteria for code changes.

## Lightweight review checklist

Before merging, confirm:

- Does domain remain infrastructure-free?
- Does application depend only on inward layers and contracts?
- Are adapters implementing ports instead of defining use cases?
- Are hosts focused on composition/lifecycle only?
- Is UI staying out of infrastructure internals?
- Are apps only bootstrapping/composing?

If any answer is "no", refactor before adding more code on top.
