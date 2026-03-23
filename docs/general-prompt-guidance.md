# General Prompt Guidance

Use this document as a compact instruction set for software implementation prompts. It is intentionally project agnostic and short enough to reuse alongside task-specific context.

## Core expectations
- Preserve the existing architecture before introducing new abstractions.
- Prefer small, targeted changes over broad refactors unless the task explicitly requires restructuring.
- Follow established naming, file organization, dependency direction, and code style already present in the codebase.
- Keep UI styling consistent with existing design tokens, spacing, typography, component patterns, and accessibility practices.
- Add or update tests for meaningful behavior changes; avoid leaving new logic unverified.
- Favor readable, maintainable solutions over clever or highly compressed implementations.
- Do not add speculative features, hidden scope, or placeholder code unless explicitly requested.
- Document important tradeoffs, assumptions, and limitations when they affect correctness or maintainability.

## Implementation guidance
- Inspect nearby code before editing so the solution matches local conventions.
- Reuse existing utilities, components, services, and patterns before creating new ones.
- Keep boundaries clean: business logic should stay out of presentation code, and infrastructure details should not leak into core logic unless the architecture already expects it.
- Choose names that are specific, stable, and consistent with the surrounding domain language.
- Make error states, loading states, edge cases, and empty states explicit where relevant.
- If a change affects public behavior, verify whether docs, tests, types, and examples should also be updated.

## Testing and validation
- Run the smallest relevant automated checks first, then broader checks when warranted.
- Prefer tests that validate user-visible or contract-level behavior instead of implementation details.
- If full verification is not possible, state exactly what was checked, what was not checked, and why.

## Final self-review
Before finishing, evaluate the implementation and briefly report:
1. Whether the change preserved architecture and conventions.
2. Any naming, styling, or structural decisions that were made to stay consistent.
3. What was tested and any remaining risks or gaps.
4. One concrete improvement that should happen next if work continues.

## Continuous improvement prompt
Include a short follow-up prompt such as:

> Based on the implemented change, identify the highest-value next improvement that would strengthen architecture, consistency, test coverage, or maintainability, and explain why it should be prioritized.
