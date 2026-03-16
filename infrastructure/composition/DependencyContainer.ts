/**
 * A lightweight dependency container for AI Loom Studio.
 *
 * Design goals:
 * - simple enough for manual composition
 * - explicit lifecycle control
 * - no framework lock-in
 * - supports singleton and transient registrations
 * - supports lazy resolution to avoid circular construction pressure
 *
 * This is intentionally small and infrastructure-focused.
 * It is not a full IoC framework.
 */

export type DependencyToken<T = unknown> = string | symbol;

export type DependencyFactory<T> = (container: DependencyContainer) => T;

export type DependencyLifetime = "singleton" | "transient";

interface IDependencyRegistration<T = unknown> {
  readonly token: DependencyToken<T>;
  readonly lifetime: DependencyLifetime;
  readonly factory: DependencyFactory<T>;
}

function tokenToString(token: DependencyToken): string {
  return typeof token === "symbol" ? token.toString() : token;
}

export class DependencyContainer {
  private readonly registrations = new Map<DependencyToken, IDependencyRegistration>();
  private readonly singletonInstances = new Map<DependencyToken, unknown>();
  private readonly resolutionStack: DependencyToken[] = [];

  public registerSingleton<T>(
    token: DependencyToken<T>,
    factory: DependencyFactory<T>
  ): void {
    this.register({
      token,
      lifetime: "singleton",
      factory,
    });
  }

  public registerTransient<T>(
    token: DependencyToken<T>,
    factory: DependencyFactory<T>
  ): void {
    this.register({
      token,
      lifetime: "transient",
      factory,
    });
  }

  public registerInstance<T>(token: DependencyToken<T>, instance: T): void {
    this.registrations.set(token, {
      token,
      lifetime: "singleton",
      factory: () => instance,
    });

    this.singletonInstances.set(token, instance);
  }

  public isRegistered(token: DependencyToken): boolean {
    return this.registrations.has(token);
  }

  public resolve<T>(token: DependencyToken<T>): T {
    const registration = this.registrations.get(token);

    if (!registration) {
      throw new Error(
        `Dependency '${tokenToString(token)}' is not registered.`
      );
    }

    if (registration.lifetime === "singleton") {
      if (this.singletonInstances.has(token)) {
        return this.singletonInstances.get(token) as T;
      }

      const instance = this.createInstance(registration);
      this.singletonInstances.set(token, instance);
      return instance;
    }

    return this.createInstance(registration);
  }

  public tryResolve<T>(token: DependencyToken<T>): T | undefined {
    if (!this.isRegistered(token)) {
      return undefined;
    }

    return this.resolve(token);
  }

  public createScope(): DependencyContainer {
    const scoped = new DependencyContainer();

    for (const [token, registration] of this.registrations.entries()) {
      scoped.registrations.set(token, registration);
    }

    return scoped;
  }

  public clearSingletons(): void {
    this.singletonInstances.clear();
  }

  public getRegisteredTokens(): ReadonlyArray<DependencyToken> {
    return Object.freeze([...this.registrations.keys()]);
  }

  private register<T>(registration: IDependencyRegistration<T>): void {
    if (this.registrations.has(registration.token)) {
      throw new Error(
        `Dependency '${tokenToString(registration.token)}' is already registered.`
      );
    }

    this.registrations.set(registration.token, registration);
  }

  private createInstance<T>(registration: IDependencyRegistration<T>): T {
    const token = registration.token;

    if (this.resolutionStack.includes(token)) {
      const cycle = [...this.resolutionStack, token]
        .map(tokenToString)
        .join(" -> ");

      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    this.resolutionStack.push(token);

    try {
      return registration.factory(this);
    } finally {
      this.resolutionStack.pop();
    }
  }
}
