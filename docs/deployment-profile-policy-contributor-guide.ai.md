# AI Companion: Deployment Profile Policy Contributor Guide

## Purpose

Implementation workflow for adding policy families, preset behavior, and feature-facing policy evaluation APIs while preserving deployment-policy architecture boundaries.

## Human doc

- `docs/deployment-profile-policy-contributor-guide.md`

## Canonical workflow

- Keep taxonomy/preset definitions in `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`.
- Keep effective-value resolution and override validation in `src/application/deployment/*` contracts/services.
- Keep feature-facing decisions in `src/application/policy-administration/*` evaluation interfaces/services.
- Keep payload contracts and schema validation in `src/shared/contracts|dto|schemas/deployment/*`.
- Keep docs/tests aligned for `.md` and `.ai.md` surfaces.

## Guardrails

- Use `IDeployment*PolicyEvaluationPort` interfaces for feature policy decisions.
- Keep preset/profile behavior data-driven from canonical definitions.
- Do not put profile-specific branching into UI, transport handlers, or backend adapters.
