# Multi-Surface UI Shell Primitives

This document defines the shared shell vocabulary introduced for Feature 15 / Epic 15.1 / Story 15.1.2.

## Scope

The shell primitives provide reusable, host-neutral layout and guard containers for desktop and thin-client operational/admin surfaces:

- app frame
- header bar
- navigation/content/detail regions
- status region
- empty state
- permission-aware guard container

## Source locations

- Shared primitives: `src/ui/shared/components/shell/SurfaceShellPrimitives.tsx`
- Shared export barrel: `src/ui/shared/components/shell/index.ts`
- Desktop shell wrapper: `src/ui/desktop/shell/DesktopSurfaceShell.tsx`
- Desktop admin assembly: `src/ui/desktop/shell/DesktopAdminSurfaceFrame.tsx`
- Thin-client shell wrapper: `src/ui/web/shell/ThinClientSurfaceShell.tsx`
- Thin-client operational assembly: `src/ui/web/shell/ThinClientOperationalSurfaceFrame.tsx`
- Shared shell styles: `src/ui/styles/components/shell.css`

## Composition rules

1. Use shared primitives from `src/ui/shared/components/shell` for all shell-level page structure.
2. Use desktop/web wrappers only for host-specific shell assembly defaults.
3. Keep domain/business logic in services/stores/presenters; shell containers should only compose state already prepared by those layers.
4. Use `PermissionGuardContainer` for unauthorized and unavailable states instead of ad hoc per-page guard markup.

## Responsive behavior

Responsive layout is explicit in `shell.css`:

- Desktop shells default to `navigation + content + detail` columns.
- Desktop shells collapse detail below content at medium widths.
- Thin-client shells default to `navigation + content` with detail below.
- All shell region layouts stack on narrow screens via `ui-shell-regions--collapse`.

## Usage example

```tsx
<DesktopAdminSurfaceFrame
  title="Trusted node inventory"
  subtitle="Inspect trust posture and node status."
  notices={[{ tone: "warning", content: <p role="alert">Offline nodes detected.</p> }]}
  navigation={<FiltersPanel />}
  content={<InventoryTable />}
  detail={<NodeDetailPane />}
/>
```

## Testing coverage

- `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- `src/ui/desktop/shell/tests/DesktopAdminSurfaceFrame.test.tsx`
- `src/ui/web/shell/tests/ThinClientOperationalSurfaceFrame.test.tsx`

## Story 15.1.4 update

- Shared presentation-state primitives now live in `src/ui/shared/components/presentation-state/*` and are re-exported from `src/ui/shared/components/shell/index.ts`.
- Canonical states now include `loading`, `empty`, `not-found`, `disconnected`, `error`, and `permission-denied`.
- Shared state boundaries (`SurfaceStateBoundary`) and panels (`SurfaceStatePanel`) are the preferred page-level rendering pattern for converged admin/operational list/detail surfaces.
- API error mapping now aligns with shared envelope semantics through `toSurfacePresentationStateFromApiError`, including `forbidden`/`authentication-failed` -> permission denied, `not-found` -> not-found, and transport/temporarily unavailable classes -> disconnected.

## Story 15.1.7 update

- Shell primitives now include landmark and status semantics by default:
- navigation regions render as `nav`
- detail regions render as `aside`
- status regions expose `role`/`aria-live` behavior tuned by tone
- Header action groups now expose toolbar semantics and shell frames support accessible labels for composed surface wrappers.
