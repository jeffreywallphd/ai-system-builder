# System Overview

## Purpose of this repository

`ai-system-builder` is a fresh rebuild intended to replace earlier architectural sprawl with a simpler and more disciplined structure.

The goal is to support AI system building workflows with:

- clear separation of business logic from infrastructure,
- host flexibility (desktop first, server and hybrid later),
- explicit contracts at boundaries,
- and documentation strong enough to guide ongoing implementation.

## Repository shape

The repository is organized into apps, modules, and supporting folders:

```text
ai-system-builder/
├─ apps/
│  ├─ desktop/
│  ├─ server/
│  └─ web-thin-client/
├─ modules/
│  ├─ domain/
│  ├─ application/
│  ├─ contracts/
│  ├─ adapters/
│  │  ├─ persistence/
│  │  ├─ runtime/
│  │  ├─ transport/
│  │  ├─ storage/
│  │  ├─ observability/
│  │  └─ auth/
│  ├─ hosts/
│  │  ├─ desktop/
│  │  └─ server/
│  ├─ ui/
│  │  ├─ shared/
│  │  ├─ desktop/
│  │  └─ web/
│  └─ testing/
├─ docs/
├─ dev-tools/
├─ config/
├─ migrations/
└─ ...
```

## High-level layers and boundaries

### Core logic

- `modules/domain/`
  - Business/domain rules and invariants.
  - No dependency on transport, hosts, storage engines, framework details, or UI.

- `modules/application/`
  - Use-case orchestration, policies, ports, and DTO-level behavior.
  - Coordinates domain logic and boundary contracts.

- `modules/contracts/`
  - Explicit boundary contracts (API, IPC, runtime integration contracts, etc.).
  - Shared language for cross-module communication.

### Infrastructure and edges

- `modules/adapters/`
  - Concrete implementations of boundary concerns.
  - Includes persistence, runtime, transport, storage, observability, and auth adapters.
  - Infrastructure details belong here, not in domain/application.

- `modules/hosts/`
  - Host lifecycle and composition concerns.
  - Desktop host and server host composition stay distinct from transport mechanics.

- `modules/ui/`
  - Shared-first UI strategy:
    - reusable UI in `ui/shared/`,
    - thin platform-specific layers in `ui/desktop/` and `ui/web/`.

### App entry points

- `apps/desktop/`, `apps/server/`, `apps/web-thin-client/`
  - Entry points and packaging/deployment surfaces.
  - Not the home for core business logic.

## TypeScript-first posture

The native implementation path is Node.js with TypeScript.

- TypeScript is the dominant runtime for core architecture.
- Other runtimes (starting with Python) are adapter-driven extensions, not co-equal architecture centers.
- Runtime diversity is supported through contracts, not ad hoc coupling.

## Host model in practice

The architecture supports multiple host modes over time:

1. desktop-only,
2. server-only,
3. desktop-server hybrid.

Current implementation priority is **desktop-first**. Server and hybrid compatibility should be preserved by boundaries, but not forced through premature complexity.

## Transport role

Transport technologies are adapters, not application definitions.

- Express is the default server API transport adapter.
- Electron IPC is the desktop transport boundary.
- Business rules must stay in domain/application layers, not in route handlers or IPC handlers.

## Persistence and storage posture

- Persistence: structured durable records (default adapter target: Postgres).
- Storage: files/blobs/artifacts/workspaces and other non-relational content.

They are separate architectural concerns even if they share physical disk territory in some host deployments.

## Packaging restraint

This repository intentionally avoids premature package explosion.

- A folder is not automatically a package.
- Package boundaries are introduced only when justified by independent build/dependency/isolation needs.
- Architecture boundaries are primary; package boundaries follow proven need.

## Not yet finalized

The following are intentionally open and should not be over-specified yet:

- exact runtime execution protocols for external runtimes,
- final internal API/IPC schema conventions across all surfaces,
- concrete enforcement tooling (for example, lint rules) for every dependency rule.

Until formalized, contributors should follow the boundaries in this architecture set and document significant decisions in ADRs.
