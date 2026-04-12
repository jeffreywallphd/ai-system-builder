# Authoritative Server Composition Contracts

This folder is the bounded contract surface for control-plane composition refactor work.

## Purpose

- Define typed assembly contracts for bounded authoritative server composition modules.
- Keep startup orchestration behavior in `AuthoritativeServerCompositionRoot.ts` stable while implementation logic is moved incrementally behind these contracts.
- Make ownership and dependency direction explicit before behavior moves.

## Structure

- `contracts/AuthoritativeServerCompositionModuleContracts.ts`
  - Canonical typed input/output contracts for each composition module.
  - Shared lifecycle/disposal hooks for composition modules.
- `contracts/AuthoritativeServerCompositionModuleMap.ts`
  - Ordered target module map with stage ownership, dependencies, produced artifacts, and disposal responsibilities.
- `contracts/AuthoritativeServerBootstrapPipelineStateModel.ts`
  - Canonical staged bootstrap pipeline and typed startup-state/readiness model for incremental startup refactoring.
- `ServerIdentitySessionTrustedDeviceCompositionModule.ts`
  - Bounded identity/session/trusted-device assembly module used by `IdentityServerHost.ts`.
- `ServerWorkspaceAuthorizationCompositionModule.ts`
  - Bounded workspace lifecycle + authorization/sharing assembly module used by `IdentityServerHost.ts`.
- `ServerDeploymentPolicyCompositionModule.ts`
  - Bounded deployment-policy administration assembly module used by `IdentityServerHost.ts`.
- `ServerSecretCompositionModule.ts`
  - Bounded secret-service assembly module used by `IdentityServerHost.ts`.
- `ServerCertificateCompositionModule.ts`
  - Bounded certificate/CA operations composition module used by `IdentityServerHost.ts`.
- `ServerNodeTrustCompositionModule.ts`
  - Bounded node enrollment/trust and execution-node management composition module used by `IdentityServerHost.ts`.
- `ServerTlsMaterialCompositionModule.ts`
  - Bounded TLS material resolution and transport-trust composition module used by `IdentityServerHost.ts`.
- `ServerStorageAssetCompositionModule.ts`
  - Bounded managed storage + protected asset composition module used by `IdentityServerHost.ts`.
- `ServerImageMediaCompositionModule.ts`
  - Bounded image/media preview composition module used by `IdentityServerHost.ts`.
- `ServerGeneratedResultCompositionModule.ts`
  - Bounded generated-result preview/media and collected-result persistence composition module used by `IdentityServerHost.ts`.
- `contracts/index.ts`
  - Barrel export for composition contract consumers and tests.

## Placement Rules

- Add new composition module logic under `src/hosts/server/composition/` and keep contract definitions in `contracts/`.
- Keep business/domain logic out of this folder; compose existing application/domain services through typed ports.
- Update contract tests in `src/hosts/server/tests/AuthoritativeServerCompositionAssemblyContracts.test.ts` when module boundaries or dependencies change.

## Dependency Guardrails

- Composition modules may depend only on declared upstream module outputs and shared host startup/lifecycle contracts.
- Composition modules may assemble infrastructure and application services, but must not absorb business logic or policy evaluation logic.
- Composition modules must not absorb route logic, handler logic, or transport DTO mapping logic.
- Cross-module dependencies must be declared in `contracts/AuthoritativeServerCompositionModuleMap.ts`.
- Introducing new cross-module dependencies requires updating contracts and `AuthoritativeServerCompositionAssemblyContracts.test.ts` in the same change.

## Naming And Placement Guidance

- Module implementation names must follow `Server<Capability>CompositionModule`.
- Module contract names must follow `Server<Capability>CompositionModuleContract`.
- Keep typed artifacts explicit: `Server<Capability>CompositionModuleInput` and `Server<Capability>CompositionModuleOutput`.
- Place module-specific helper code next to the module implementation; avoid shared generic `helpers` or `utils` catch-all files.
- Keep top-level host orchestration in `AuthoritativeServerCompositionRoot.ts`; do not re-centralize module internals there.
