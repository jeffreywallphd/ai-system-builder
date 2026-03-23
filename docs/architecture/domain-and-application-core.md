# Domain and Application Core

This document goes deeper into the inner layers of the system: the domain model and the application orchestration built around it.

## Why these layers matter most

If the infrastructure changed tomorrow—different storage, different runtime transport, different host shell—the product should still mean the same things:
- a workflow is still a workflow
- a node is still a node
- model compatibility rules still apply
- context packages and recipes still mean the same thing
- tool publication is still attached to workflows

Those stable meanings live in the **domain** and **application** layers.

## Domain core

### Workflows as the central aggregate
The workflow aggregate (`domain/workflows/Workflow.ts`) is the most important domain object in the codebase. It owns:
- identity
- metadata
- lifecycle state
- runtime profile
- execution policy
- nodes
- connections

The aggregate exposes operations like `addNode`, `updateNode`, `removeNode`, `addConnection`, and `withMetadata`, each returning a new workflow instance. That gives the architecture a relatively immutable domain style that is useful for correctness, undo/redo-friendly thinking, and controlled mutation.

### Graph semantics stay in the core
The workflow can be converted to a graph (`toGraph()`), but graph-specific behavior is separated into graph/domain services rather than being buried in the UI. That keeps graph reasoning reusable and testable.

### Validation as business policy
`domain/services/WorkflowValidator.ts` combines graph checks, node validation, connection validation, and runtime-policy checks. This is the correct place for those rules because workflow validity is a business concern, not a view concern.

### Compatibility services
The domain also contains compatibility logic such as:
- `NodeCompatibilityService`
- `ModelCompatibilityService`
- service compatibility helpers

This reinforces that "can these parts work together?" is core product policy.

## Application core

### Use cases organize behavior around intent
The application layer translates intents into orchestrated actions. The naming is explicit and readable:
- create workflow
- save workflow
- load workflow
- validate workflow
- execute workflow
- create node
- connect nodes
- install model
- list tool capabilities
- execute MCP tool
- preview workflow/tool/agent context

This gives the system an operation-centered API rather than a generic service blob.

### Ports define required capabilities
The application layer declares interfaces for capabilities it needs from the outside world, for example:
- repositories
- executors
- runtime clients
- tool catalogs
- context repositories
- model installers/downloaders

That is the main clean-architecture mechanism that decouples use cases from storage and runtime details.

### Workflow execution orchestration
`ExecuteWorkflowUseCase` shows the inner architecture well. It:
- receives the workflow and optional overrides
- computes the effective workflow
- resolves execution metadata, especially workflow context
- validates according to runtime and dependency rules
- delegates execution to an external executor port

This is a strong separation because the use case owns the policy of execution preparation, while infrastructure owns the mechanics of actual execution.

### Context as an application concern
The context system is mostly modeled in the application layer rather than the pure domain layer. That is sensible because context assembly is highly orchestration-heavy:
- loading packages and recipes
- merging explicit and derived selections
- assembling dynamic context sources
- trimming/budgeting
- generating execution envelopes and inspection outputs

`application/context/WorkflowContextService.ts` is therefore a central application-layer service.

### Projection services are application translators
Projection services translate the rich internal workflow model into alternate surfaces such as forms and tools. They are not domain rules and not infrastructure details; application is the right layer for them.

## How the inner layers support feature slices

The same inner-layer approach is reused across multiple slices:
- workflows and nodes
- context engineering
- tools and published tools
- MCP use cases
- model management
- managed services
- tuning dataset studio
- model training

This consistency is one of the healthier signs in the codebase: even as features expand, the inner architecture still tends to express them as domain models plus application orchestration.

## Why this is a good fit for the product

AI Loom Studio is not just a thin GUI over a runtime. It is an authoring and governance environment for workflows, tools, context, and local AI operations. That kind of product benefits from a strong inner core because the rules of the authoring model need to remain stable even when runtimes and integrations change.

## TODO

- Some concepts currently live more in the application layer than the domain layer because they are orchestration-heavy. That is reasonable, but over time the team may want to clarify which context-engineering rules are true domain policy versus application assembly policy.
- The workflow aggregate is clearly central, but some adjacent concepts—especially tool publication metadata and certain authoring concerns—could eventually deserve stronger domain-level abstractions if they continue to grow.
