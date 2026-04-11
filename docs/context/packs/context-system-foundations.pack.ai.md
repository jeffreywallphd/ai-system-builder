# AI Companion: Context System Foundations Pack

## Purpose

Baseline context for changing context-engineering contracts, routing maps, and governance assets.

## When To Use

- Editing `docs/context` contracts and seeds.
- Defining or updating metadata standards for context assets.
- Adding or updating context guardrail tests.

## When Not To Use

- Runtime feature implementation outside context engineering.
- Pure incident triage with no contract or docs-context changes.
- UI-only tasks unrelated to context assets.

## Invariants

- Keep `.md`, `.ai.md`, and `.contract.json` artifacts synchronized.
- Keep routing deterministic and auditable.
- Keep metadata minimal but explicit.

## Authoritative Docs

- `docs/context/README.ai.md`
- `docs/context/context-asset-metadata.ai.md`
- `docs/context/packs/README.ai.md`
- `docs/context/routing/prompt-routing-contract.ai.md`
- `docs/context/governance/context-governance-policy.ai.md`
- `docs/context/governance/context-asset-lifecycle.ai.md`

## Authoritative Code Paths

- `dev/tests/ContextEngineeringStructureGuardrails.test.ts`
- `dev/tests/ContextPackContractGuardrails.test.ts`
- `dev/tests/TaskToContextRoutingContractGuardrails.test.ts`
- `dev/scripts/validate-docs-foundation.cjs`

## Anti-Patterns

- Expanding metadata without clear retrieval/audit value.
- Copying long-form canonical docs into pack content.
- Routing behavior that depends on non-deterministic interpretation.

## Related Packs

- None yet.
