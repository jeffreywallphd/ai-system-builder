import { assertInvariantExecution } from "./assertions";
import type {
  InvariantExecutionRequest,
  InvariantExecutionResult,
  InvariantFamilyAdapter,
  InvariantFeatureFamily,
  InvariantFixtureBag,
} from "./contracts";

export class InvariantAdapterRegistry {
  private readonly adapters = new Map<InvariantFeatureFamily, InvariantFamilyAdapter<unknown, unknown>>();

  public register(adapter: InvariantFamilyAdapter<unknown, unknown>): this {
    if (this.adapters.has(adapter.family)) {
      throw new Error(`Adapter for family '${adapter.family}' is already registered.`);
    }
    this.adapters.set(adapter.family, adapter);
    return this;
  }

  public resolve<TInput, TResult>(family: InvariantFeatureFamily): InvariantFamilyAdapter<TInput, TResult> {
    const adapter = this.adapters.get(family);
    if (!adapter) {
      throw new Error(`No invariant adapter is registered for family '${family}'.`);
    }
    return adapter as InvariantFamilyAdapter<TInput, TResult>;
  }
}

function createFrozenFixtureBag(fixtures?: InvariantFixtureBag): InvariantFixtureBag {
  return Object.freeze({
    ...(fixtures ?? {}),
  });
}

export async function executeInvariantScenario<TInput, TResult>(
  registry: InvariantAdapterRegistry,
  request: InvariantExecutionRequest<TInput>,
): Promise<InvariantExecutionResult<TInput, TResult>> {
  const now = request.now ?? (() => new Date());
  const evaluatedAt = now().toISOString();
  const adapter = registry.resolve<TInput, TResult>(request.scenario.family);
  const observed = await adapter.evaluate({
    scenario: request.scenario,
    fixtures: createFrozenFixtureBag(request.fixtures),
    evaluatedAt,
  });

  return Object.freeze({
    scenario: request.scenario,
    observed,
    evaluatedAt,
  });
}

export async function executeAndAssertInvariantScenario<TInput, TResult>(
  registry: InvariantAdapterRegistry,
  request: InvariantExecutionRequest<TInput>,
): Promise<InvariantExecutionResult<TInput, TResult>> {
  const execution = await executeInvariantScenario<TInput, TResult>(registry, request);
  assertInvariantExecution(execution);
  return execution;
}
