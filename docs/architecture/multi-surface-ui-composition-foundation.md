# Multi-Surface UI Composition Foundation

This document defines the canonical UI architecture for desktop authoring/admin, thin-client operational/admin access, and mobile-responsive monitoring surfaces.

## Story scope

- Feature 15: Multi-Surface UI Foundations for Admin and Operational Flows
- Epic 15.1: Establish Shared Multi-Surface UI Architecture and Design Foundations
- Story 15.1.1: Define the canonical multi-surface UI architecture and screen composition plan

## Goals

- Keep presentation logic shared across desktop and thin-client surfaces.
- Keep host/runtime concerns isolated so UI modules do not drift into host-specific duplication.
- Make folder responsibilities explicit so contributors can place new work consistently.
- Keep admin and operational surfaces composition-aligned across desktop, web, tablet, and mobile-responsive layouts.

## Canonical layering model

All UI features follow the same boundary stack:

1. `Host/runtime seam` (`src/ui/desktop/*`, `src/ui/web/*`): environment-specific endpoint resolution, route-link helpers, and bridge/runtime capability detection.
2. `Shared presentation seam` (`src/ui/shared/*`, `src/ui/services/*`, `src/ui/state/*`, `src/ui/presenters/*`, `src/ui/components/*`): cross-surface transport clients, page-facing services, stores, presenters, and reusable components.
3. `Surface shell seam` (`src/ui/pages/*`, `src/ui/layout/*`, `src/ui/routes/*`, `src/ui/App.tsx`): route/page composition, shell chrome, and responsive layout behavior.

Direction of dependency is one-way:

- `pages/layout/routes` -> `state/services/presenters/components/shared` -> `application/domain/shared contracts`
- `desktop/web` modules may be used by shared or composition roots, but shared modules must not depend on both hosts for the same concern in a single code path.
- Page components must not call host bridges directly.

## Canonical folder responsibilities

### `src/ui/shared`

- Owns cross-surface clients and adapters that both desktop and thin-client surfaces use.
- Contains domain-grouped folders (for example `identity`, `workspaces`, `authorization`, `runtime`, `assets`, `storage`).
- Includes request/response shaping, shared auth/session headers, and neutral error mapping.
- Must remain host-neutral. No desktop IPC channel strings and no host-global browser URL assumptions.

### `src/ui/desktop`

- Owns desktop-only UI runtime seams (for example desktop API base URL resolution, desktop bridge capability checks).
- Converts desktop preload/bridge behavior into neutral values that shared services can consume.
- Must not contain page business rules, cross-surface view models, or reusable UI component composition.

### `src/ui/web`

- Owns thin-client/web-specific URL and route helper seams.
- Converts thin-client URL/origin/runtime behavior into neutral values that shared services can consume.
- Must not duplicate shared transport clients, store logic, or page-level orchestration already present in shared layers.

### `src/ui/state`

- Owns page-facing state transitions, request lifecycle state, and user intent orchestration.
- Coordinates services and presenters for view-ready state.
- Must not contain host resolution logic or direct `window`/desktop bridge calls.

### `src/ui/presenters`

- Owns shaping/projection of backend/application/domain data into display-ready view models.
- Must stay pure and deterministic.
- Must not fetch data, mutate persistence, or read host runtime globals.

### `src/ui/components`

- Owns reusable UI components and feature subcomponents.
- Components consume already-prepared state and callbacks.
- Must not instantiate transport clients or duplicate presenter/store logic.

### `src/ui/pages`

- Owns route-bound screen shells and feature-level composition of stores/components.
- Responsible for layout-level shell decisions (desktop-full, thin-client compact, responsive admin/ops panel arrangements).
- Must not host domain logic, policy evaluation, transport adapters, or long-lived data orchestration state.

## What stays out of page components

The following logic is prohibited inside `src/ui/pages/*`:

- Domain/business-rule validation and interpretation.
- API/IPC client construction and host endpoint resolution.
- Cross-page reusable state machines.
- Data projection logic that belongs in presenters.
- Policy or authorization decision recomputation already provided by backend/application contracts.

Allowed in page components:

- Route parameter parsing and navigation intent handling.
- Delegating user actions to stores/services.
- Selecting between desktop/thin-client shell variants with shared state.
- Rendering responsive layout composition.

## Desktop and thin-client layering expectations

- Desktop is the full-authoring and full-admin shell where host capabilities (desktop bridge, local runtime orchestration) are available.
- Thin-client web is the operational/admin surface for constrained environments and mobile-responsive access.
- Tablet/mobile-responsive behavior is a layout and composition concern of shared pages/components, not a separate business-logic stack.
- Desktop and thin-client pages must consume the same shared service/store/presenter seams for feature logic.
- Surface-specific files (`src/ui/desktop/*`, `src/ui/web/*`) may specialize host capability and route/link concerns only.

## Surface composition plan

- Desktop authoring/admin: route to full shell pages, using shared stores/services/presenters and desktop host adapters.
- Thin-client operational/admin: route to focused pages and compact panels, reusing shared stores/services/presenters and web host adapters.
- Tablet/mobile-responsive monitoring/light admin: reuse thin-client page routes with responsive layout classes and explicit compact interaction states.
- New operational/admin screens must start in shared presentation seams unless they are strictly host/runtime-specific.

## Contributor placement rules

When adding new UI behavior:

1. Add shared transport/service/store/presenter logic first.
2. Add or reuse reusable components under `src/ui/components`.
3. Add shell/page composition under `src/ui/pages`.
4. Add host-specific concerns only in `src/ui/desktop` or `src/ui/web`.

If behavior is host/runtime-only, keep it in `desktop`/`web` and expose a host-neutral interface to shared layers.

## Architecture guardrails for future stories

- Shared presentation logic belongs in shared layers, never duplicated across desktop and web feature pages.
- Host/runtime logic belongs in `src/ui/desktop` or `src/ui/web`, never in `src/ui/shared` or `src/ui/pages`.
- Page shells orchestrate; they do not implement business semantics.
- Presenters shape output; they do not fetch or mutate.
- Stores coordinate UI workflows; they do not own host detection.


## Story 15.1.2 update

- Shared shell primitives and responsive region layout vocabulary now live in docs/architecture/multi-surface-ui-shell-primitives.md with implementation in src/ui/shared/components/shell/*, src/ui/desktop/shell/*, and src/ui/web/shell/*.
- New admin and operational pages should compose app frame, header, region layout, status, empty-state, and permission guard surfaces from those primitives instead of bespoke page shell markup.

## Story 15.1.3 update

- Canonical shared navigation metadata, route grouping, and surface capability gating now live in docs/architecture/multi-surface-ui-navigation-metadata.md.
- Route grouping and navigation projections for desktop admin, desktop operational, thin-client operational, and admin-lite surfaces are defined centrally in src/ui/routes/SurfaceRouteMetadataCatalog.ts and consumed by shell/context/menu/settings surfaces.
- Contributors should add route access/surface rules in metadata first and avoid scattering route gating logic across page components.

## Story 15.1.4 update

- Shared presentation-state handling is now centralized in `src/ui/shared/components/presentation-state/*`.
- Converged admin/operational pages should render loading/empty/not-found/disconnected/error/permission-denied states through shared `SurfaceStateBoundary` and `SurfaceStatePanel` seams.
- Error-to-state projection should use `toSurfacePresentationStateFromApiError` so client rendering aligns with shared API error semantics instead of page-local error-code branching.


## Story 15.1.5 update

- Shared action modeling now lives in `src/ui/shared/actions/*` with canonical docs in `docs/architecture/multi-surface-ui-action-model.md`.
- Converged admin/operational screens should define page/row/bulk operations as structured descriptors and render through shared action wrappers (`SurfaceActionButtonStrip`, `SurfaceActionMenu`, `SurfaceActionList`) instead of page-local ad hoc action markup and guard logic.
- Permission-aware hidden/disabled action states, surface-capability gating, and confirmation/telemetry seams should be expressed in action descriptors so desktop and thin-client surfaces can reuse the same operation semantics with different wrappers.


## Story 15.1.6 update

- Responsive design tokens and interaction conventions now live in `src/ui/shared/responsive/*` with canonical docs in `docs/architecture/multi-surface-ui-responsive-conventions.md`.
- Shared responsive wrappers for tables, forms, status cards, and action menu containers now live in `src/ui/shared/components/shell/SurfaceResponsiveConventions.tsx`.
- Shell region layout and action wrappers now accept shared responsive profiles so desktop and thin-client surfaces can adapt density, stacking, touch-target, and menu behavior through one foundational rule set instead of page-local breakpoint logic.

## Story 15.1.7 update

- Shared accessibility and focus-management primitives now live in `src/ui/shared/accessibility/*` with canonical docs in `docs/architecture/multi-surface-ui-accessibility-foundations.md`.
- App shell route transitions now use a shared route-focus + announcement seam and skip-link baseline through `src/ui/layout/AppLayout.tsx`.
- Shared shell/action primitives now include landmark, live-status, and keyboard-menu semantics so first admin/operational shells expose usable accessibility behavior without per-page ad hoc wiring.
