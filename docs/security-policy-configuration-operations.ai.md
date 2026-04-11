---
title: "AI Companion: Security and Policy Configuration Operations"
doc_type: runbook
status: active
authoritativeness: reference
owned_by: team:operations-security
last_reviewed: 2026-04-11
related_code_paths:
  - src/ui/pages/SecurityPolicyConfigurationPage.tsx
  - src/ui/shared/admin/AdminSettingsFormPrimitives.tsx
  - src/ui/routes
---

# AI Companion: Security and Policy Configuration Operations

## Scope

Story 15.3.5 introduces the first production security/policy configuration surface for desktop administration.

## Entry surface

- Route: `/settings/security-policy`
- Route key: `security-policy`
- Access posture: owner/admin + `system.manage` + workspace context required

## Behavior summary

- Editable controls (supported and backend-backed):
  - Sharing policy configuration via `AuthorizationSharingManagementPanel` after validated scope/resource selection.
- Inspect-only controls:
  - Trust posture summary from authenticated session context.
  - Storage encryption/retention policy visibility through list/detail reads.

## Safety posture

- Read-only vs editable sections are explicitly labeled.
- Unsupported/unsafe controls are not exposed.
- High-risk operations remain in dedicated trust/storage administration pages, linked from this surface.

## Shared primitives

- `src/ui/shared/admin/AdminSettingsFormPrimitives.tsx`
  - `AdminSettingsSection`
  - `AdminSettingsField`
  - `AdminReadonlyProperty`
- `src/ui/styles/components/admin-settings.css`

## Canonical files

- `src/ui/pages/SecurityPolicyConfigurationPage.tsx`
- `src/ui/shared/admin/AdminSettingsFormPrimitives.tsx`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/pages/tests/SecurityPolicyConfigurationPage.test.tsx`

## Validation/testing notes

- `validateSharingPolicySelection(...)` enforces scope/resource requirements before policy controls load.
- Route metadata and access policy tests include the new route to preserve strict admin-lite exclusion and desktop admin availability.
