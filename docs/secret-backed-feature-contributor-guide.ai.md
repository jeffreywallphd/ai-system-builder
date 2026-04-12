# AI Companion: Secret-Backed Feature Contributor Guide

Primary reference: `docs/secret-backed-feature-contributor-guide.md`

## Purpose

Guide contributors on how to add secret-backed behavior while preserving hardened startup policy, scope boundaries, and diagnostics/audit safety.

## Core Expectations

- choose explicit owner scope (`server`, `workspace`, `user`)
- use scoped provider retrieval adapters; avoid direct env/persistence shortcuts
- keep plaintext out of query/list/diagnostic surfaces
- keep audit and log details redaction-safe
- respect production fail-fast vs development/test optional policy behavior

## Extension Paths

- new secret consumer: define classification/hierarchy/policy, route runtime retrieval through official ports, and add policy-aware tests
- new provider backend: implement `ISecretProviderMaterialResolutionPort`, emit full metadata model, and integrate routing in `DefaultSecretProviderResolutionService`

## Validation

- verify `/api/v1/security/secrets/health`
- verify trusted `/api/v1/security/secrets/diagnostics`
- update docs/tests when adding new required secrets, policy behavior, or backend kinds
