# AI Companion: Security-Critical Runtime Material Inventory

Primary reference: `docs/architecture/security-critical-runtime-material-inventory.md`

## Goal

Capture the current hardened secret/key model so startup policy, provider routing, lifecycle behavior, and diagnostics expectations stay implementation-accurate.

## What Changed In This Baseline

- The inventory now reflects hardened behavior rather than pre-hardening fallback analysis.
- Required material classes are explicit (provider credential, signing, encryption, certificate/trust, bootstrap governance).
- Startup expectations are documented per lifecycle policy (`production`/`development`/`test`).
- Provider architecture is documented as scope-routed (`server` durable backend, `workspace` managed runtime adapters, `user` local-secure optional plus managed fallback).
- Diagnostics interpretation is aligned to runtime APIs and startup validation states.
- Development allowances are limited to policy-governed optional fallback; obsolete random runtime fallback references were removed.
- Extension guidance now covers both new secret consumers and new provider backends.

## Canonical Runtime Sources

- `src/application/security/contracts/SecurityMaterialClassificationContract.ts`
- `src/application/security/contracts/SecurityMaterialKeyHierarchyContract.ts`
- `src/application/security/contracts/SecurityMaterialRotationContract.ts`
- `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
- `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/infrastructure/security/DefaultSecretProviderResolutionService.ts`
- `src/infrastructure/security/secrets/SecretServiceOperationalDiagnostics.ts`
- `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- `src/hosts/server/composition/ResolveCriticalServerSecurityMaterial.ts`
