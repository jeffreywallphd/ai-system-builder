import { describe, expect, it } from "bun:test";
import { DependencyContainer } from "../DependencyContainer";

describe("DependencyContainer", () => {
  it("supports singleton and transient lifetimes", () => {
    const c = new DependencyContainer();
    c.registerSingleton("S", () => ({ n: Math.random() }));
    c.registerTransient("T", () => ({ n: Math.random() }));

    expect(c.resolve<{ n: number }>("S")).toBe(c.resolve("S"));
    expect(c.resolve<{ n: number }>("T")).not.toBe(c.resolve("T"));
  });

  it("detects circular dependencies", () => {
    const c = new DependencyContainer();
    c.registerSingleton("A", (x) => x.resolve("B"));
    c.registerSingleton("B", (x) => x.resolve("A"));

    expect(() => c.resolve("A")).toThrow("Circular dependency detected");
  });
});
