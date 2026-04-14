# Host Model

## What a host means in this repository

A **host** is the runtime environment composition layer that starts and operates the system in a specific deployment mode.

In `ai-system-builder`, hosts are responsible for:

- lifecycle/startup/shutdown behavior,
- wiring application use cases to adapters,
- environment-specific composition choices.

Hosts are implemented under `modules/hosts/` and surfaced through `apps/*` entry points.

## Host types

## Desktop host (initial implementation priority)

- Built on Electron with Electron Forge as the desktop build/tooling path.
- Owns desktop lifecycle composition and desktop-specific wiring.
- Uses Electron IPC as a transport boundary (via transport adapters), not as business logic location.

## Server host

- Owns server process lifecycle and composition.
- Uses transport adapters (default: Express) for API exposure.
- Keeps route/controller logic thin and delegates use-case behavior inward.

## Why hosts are separate from transport adapters

Transport answers **"how requests/messages move"**.
Host answers **"what process/environment composes and runs the system"**.

Keeping these separate avoids common coupling failures:

- treating Express app setup as the architecture center,
- treating Electron IPC handlers as the business layer,
- mixing lifecycle concerns with request translation concerns.

## Supported operating modes

The architecture is designed to support:

1. desktop-only,
2. server-only,
3. desktop-server hybrid (later).

### Staging rule

Desktop-first delivery is the first implementation target.

Server and hybrid compatibility should be preserved through boundaries and contracts, but early code should not absorb speculative hybrid complexity.

## Hybrid mode status

Hybrid synchronization/coordination architecture is **not yet fully designed**.

Contributors should:

- avoid claiming parity behavior that is not implemented,
- avoid embedding assumptions that force one future hybrid topology,
- keep host composition modular so hybrid can be added intentionally later.

## Thin web client role

`apps/web-thin-client/` is a thin surface for web interaction.

- It is not assumed to be full feature parity with desktop.
- It should reuse shared UI and contracts where practical.
- It should not drive architecture toward duplicate full-stack UI logic.

## Practical boundaries

- Host modules may depend on application/contracts/adapters.
- Transport adapters may be selected by hosts.
- Business rules remain in domain/application.
- UI remains separate from host lifecycle internals.

If host code starts accumulating business logic, move that logic inward before it becomes entrenched.
