# Secrets Scope Ownership and Resolution Rules

This note documents Story 8.1.5 (Feature 8 / Epic 8.1): deterministic, policy-driven secret scope validation and name resolution.

## Canonical artifacts

- `src/application/security/use-cases/SecretScopeResolver.ts`
- `src/application/security/tests/SecretScopeResolver.test.ts`

## Purpose and posture

- Formalize server, workspace, and user scope-owner references before any lookup.
- Resolve by secret key name only through explicit scope policy supplied by the caller.
- Prevent cross-scope confusion and accidental leakage by denying mismatched scope-owner requests.
- Avoid implicit fallback chains; inheritance/fallback is only allowed when the caller supplies explicit ordered scope owners.

## Scope-owner validation

`SecretScopeResolver` validates all requested owners through canonical domain scope rules:

- server scope: no `workspaceId` and no `userIdentityId`
- workspace scope: required `workspaceId`, no `userIdentityId`
- user scope: required `userIdentityId`, optional `workspaceId`

Invalid owner combinations are rejected as `secret-invalid-request`.

## Resolution policy model

Resolution requires an explicit policy:

- `mode: "exact-scope"`: exactly one owner; no fallback behavior.
- `mode: "explicit-fallback-chain"`: ordered owner list supplied by caller; candidates are evaluated in declared order only.
- `duplicateMatchPolicy: "fail" | "first-match"`:
  - `fail` returns deterministic `ambiguous` outcome when multiple requested scopes contain the same key.
  - `first-match` returns the first matched owner in caller-declared order.

No default or hidden fallback chain is applied by the resolver.

## Access and leakage safeguards

- Before querying persistence, resolver validates actor/scope compatibility for each requested owner via policy port evaluation.
- Cross-workspace or cross-user scope-mismatch requests are denied with `secret-access-denied` before lookup resolution succeeds.
- Resolved records are evaluated again with record-aware read-metadata policy to enforce lifecycle and policy constraints consistently.

## Deterministic outcomes

Successful calls return one of:

- `resolved`
- `not-found`
- `ambiguous`

`ambiguous` includes the matched secret ids so higher-level callers can require a stricter scope reference instead of selecting implicitly.

## Test coverage

`SecretScopeResolver.test.ts` covers:

- valid workspace scope-owner match
- invalid cross-workspace resolution request denial
- duplicate key name across user/workspace scopes producing `ambiguous` under strict duplicate policy
- explicit first-match behavior when duplicate policy allows deterministic ordered selection
