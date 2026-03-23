# AI Companion: Domain and Application Core

## Core fact
The inner architecture is centered on stable domain models plus explicit application use cases and ports.

## Main files
- Workflow aggregate: `domain/workflows/Workflow.ts`
- Workflow contract: `domain/workflows/interfaces/IWorkflow.ts`
- Workflow validator: `domain/services/WorkflowValidator.ts`
- Execution orchestration: `application/workflows/ExecuteWorkflowUseCase.ts`
- Context orchestration: `application/context/WorkflowContextService.ts`
- Tool run orchestration: `application/tools/RunToolUseCase.ts`
- Port contracts: `application/ports/interfaces/*`

## Key framing
Say the product has a "stable inner core" and "runtime/host adapters around it."

## Caveat
Not every concept is modeled in a perfectly pure way; context and projections are strongly application-layer concerns, and some UI-layer convenience logic still exists.

## TODO
- If asked what the most central business object is, answer: the workflow aggregate.
