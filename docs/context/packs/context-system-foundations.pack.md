# Context System Foundations Pack

## Purpose

Provide baseline context for evolving `docs/context` contracts, routing guidance, and governance without re-deriving repository conventions each task.

## When To Use

- Updating context contracts or seed files in `docs/context/packs` or `docs/context/routing`.
- Changing context governance policy or shared metadata standards.
- Implementing guardrails that enforce context engineering structure.

## When Not To Use

- Feature-specific runtime implementation tasks outside context-engineering assets.
- Incident diagnostics unrelated to docs/context contracts.
- UI-only refinements with no context contract impact.

## Invariants

- Keep machine-readable contracts and human/AI companion docs aligned.
- Keep standards lightweight and deterministic.
- Preserve stable IDs for published catalog and routing entries.

## Authoritative Docs

- `docs/context/README.md`
- `docs/context/context-asset-metadata.md`
- `docs/context/packs/README.md`
- `docs/context/routing/prompt-routing-contract.md`
- `docs/context/governance/context-governance-policy.md`
- `docs/context/governance/context-asset-lifecycle.md`

## Authoritative Code Paths

- `dev/tests/ContextEngineeringStructureGuardrails.test.ts`
- `dev/tests/ContextPackContractGuardrails.test.ts`
- `dev/tests/TaskToContextRoutingContractGuardrails.test.ts`
- `dev/scripts/validate-docs-foundation.cjs`

## Anti-Patterns

- Adding high-ceremony metadata fields with no retrieval or audit value.
- Duplicating full canonical docs in packs instead of linking.
- Introducing non-deterministic routing semantics.

## Related Packs

- None yet. Add related pack IDs when additional context packs are introduced.
