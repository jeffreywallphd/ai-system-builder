# AI Companion: Multi-Surface UI Action Model

## Core fact
Story 15.1.5 introduces one shared action semantic model for page, row, and bulk operations, with permission/capability-aware hidden/disabled states and reusable desktop/thin render wrappers.

## Primary files
- `src/ui/shared/actions/SurfaceActionModel.ts`
- `src/ui/shared/actions/SurfaceActionComponents.tsx`
- `src/ui/shared/actions/index.ts`
- `src/ui/pages/NodeInventoryPage.tsx` (example integration)

## What this provides
- declarative action descriptors (`id`, `scope`, `tone`, availability, confirmation, telemetry)
- context-aware action state resolution (permission, resource state, surface capability)
- consistent execution flow with confirmation + telemetry hook seams
- shared wrappers for:
  - button strips (desktop/admin bars)
  - row menus (table/list row operations)
  - list stacks (thin-client/mobile action grouping)

## Usage flow
1. Build a `SurfaceActionContext` with actor permissions, surface, capabilities, and optional resource/selection metadata.
2. Define operation descriptors as data + callbacks.
3. Resolve/render descriptors through shared wrappers.
4. Invoke through `invokeSurfaceAction` to preserve consistent guardrails.

## Guardrails
- Keep business rules and permission/state checks in descriptor seams, not inside JSX trees.
- Use descriptor `availability` for resource-state gating.
- Use `confirmation` for secondary-danger operations.
- Add telemetry metadata now (`eventName`, `auditCategory`) so audit/telemetry sinks can attach later without page refactors.

## Tests
- `src/ui/shared/tests/SurfaceActionModel.test.ts`
- `src/ui/shared/tests/SurfaceActionComponents.test.tsx`

## Story 15.1.7 update
- Action wrappers now include baseline accessibility behavior:
  - strips/lists expose toolbar semantics
  - menus expose `aria-haspopup` + `role="menu"` + `role="menuitem"`
  - menus support Escape close and directional keyboard traversal (`ArrowUp`, `ArrowDown`, `Home`, `End`)
- New admin/operational pages should consume this shared menu behavior instead of custom menu keyboard wiring.

## Story 15.2.3 update
- Queue visibility surfaces in `src/ui/shared/operations/OperationalQueueMonitoringPanels.tsx` now use shared action descriptors for queue row/detail operations.
- Queue action descriptors are permission-aware for inspect/cancel/dequeue/refresh and reuse shared wrappers across desktop/thin surfaces.
- Queue action-flow coverage now lives in `src/ui/shared/tests/OperationalQueueVisibilityActions.test.tsx`.
