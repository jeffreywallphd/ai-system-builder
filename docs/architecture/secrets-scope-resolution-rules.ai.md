# AI Companion: Secrets Scope Ownership and Resolution Rules

## Purpose

Quick baseline for Story 8.1.5 (Feature 8 / Epic 8.1): explicit, deterministic scope-owner validation and secret-name resolution behavior.

## Canonical files

- `src/application/security/use-cases/SecretScopeResolver.ts`
- `src/application/security/tests/SecretScopeResolver.test.ts`
- `docs/architecture/secrets-scope-resolution-rules.md`

## Core behavior

- Scope owners are normalized/validated using canonical domain rules before lookup.
- Resolution requires explicit caller policy:
  - `exact-scope` (single owner only)
  - `explicit-fallback-chain` (ordered owner candidates only)
- Duplicate-name behavior is policy-driven:
  - `fail` -> deterministic `ambiguous`
  - `first-match` -> deterministic first owner match by caller order
- No implicit fallback/inheritance chains are applied.

## Safety posture

- Actor/scope compatibility is checked before lookup using policy evaluation.
- Cross-workspace/cross-user scope mismatches are denied as access-denied.
- Record-aware read-metadata policy is re-evaluated on selected records.

## Test posture

Coverage verifies:

- valid scope matches
- invalid cross-workspace access denial
- duplicate-name ambiguity across scopes
- explicit first-match fallback behavior when policy allows it
