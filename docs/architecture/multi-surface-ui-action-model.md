# Multi-Surface UI Action Model

This document defines the shared action descriptor and renderer seams introduced for Feature 15 / Epic 15.1 / Story 15.1.5.

## Scope

The action model standardizes page-level, row-level, and bulk operations so desktop and thin-client surfaces can reuse one semantic contract while choosing different visual wrappers.

## Source locations

- Action descriptors, context, state resolution, and execution: `src/ui/shared/actions/SurfaceActionModel.ts`
- Shared action renderers (button strip, menu, list): `src/ui/shared/actions/SurfaceActionComponents.tsx`
- Shared exports: `src/ui/shared/actions/index.ts`
- Representative page integration: `src/ui/pages/NodeInventoryPage.tsx`
- Action state tests: `src/ui/shared/tests/SurfaceActionModel.test.ts`
- Action renderer tests: `src/ui/shared/tests/SurfaceActionComponents.test.tsx`

## Action descriptor model

Each action descriptor is declarative and host-neutral:

- `id`, `label`, `scope` (`page`, `row`, `bulk`)
- `tone` (`primary`, `secondary`, `danger`)
- optional `requiredPermissions` and permission restriction behavior (`hidden` or `disabled`)
- optional `requiredSurfaceCapabilities` and capability restriction behavior (`hidden` or `disabled`)
- optional resource-aware `availability(context)` for hidden/disabled states from current data state
- optional `confirmation` for secondary-danger actions
- optional `telemetry` metadata for future audit/telemetry sinks
- `onInvoke(context)` callback for operation execution

## Resolution and execution flow

1. Build a shared action context from actor permissions, target surface, capabilities, and optional resource/selection metadata.
2. Resolve descriptors through `resolveSurfaceActionDescriptors`.
3. Render resolved actions through a wrapper component:
- `SurfaceActionButtonStrip` for desktop-style action bars
- `SurfaceActionMenu` for row/context menus
- `SurfaceActionList` for compact/thin-client stacks
4. Invoke through `invokeSurfaceAction` so confirmation, hidden/disabled guards, and telemetry hooks are applied consistently.

## Developer usage notes

- Keep business rules in descriptor availability and callback seams, not inline in component trees.
- Use permission and capability checks in descriptors for consistent hidden/disabled behavior across surfaces.
- Use `confirmation` on dangerous operations; do not re-implement ad hoc confirm prompts per page.
- Use telemetry metadata (`eventName`, optional `auditCategory`) so future instrumentation can be attached without refactoring page actions.
- Prefer one descriptor set per operation domain and reuse that set across desktop/thin wrappers where possible.

## Story 15.1.7 update

- Shared action wrappers now expose baseline accessibility semantics:
- action strips/lists expose toolbar semantics
- action menus expose `aria-haspopup`, `role="menu"`, and `role="menuitem"` semantics
- action menus now include Escape-close handling and arrow/home/end keyboard traversal for menu items
- This keyboard and semantics baseline should be reused rather than reimplemented per page.

## Story 15.2.3 update

- Queue visibility/action surfaces now consume shared action descriptors in `src/ui/shared/operations/OperationalQueueMonitoringPanels.tsx`.
- Queue row and queue-detail actions use permission-aware descriptor gates for `runtime.run.inspect`, `runtime.run.cancel`, `runtime.queue.manage`, and `runtime.queue.refresh`.
- Queue action flow tests now validate descriptor guard behavior and invocation outcomes in `src/ui/shared/tests/OperationalQueueVisibilityActions.test.tsx`.
