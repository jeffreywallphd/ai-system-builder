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
- `contracts/index.ts`
  - Barrel export for composition contract consumers and tests.

## Placement Rules

- Add new composition module logic under `src/hosts/server/composition/` and keep contract definitions in `contracts/`.
- Keep business/domain logic out of this folder; compose existing application/domain services through typed ports.
- Update contract tests in `src/hosts/server/tests/AuthoritativeServerCompositionAssemblyContracts.test.ts` when module boundaries or dependencies change.
