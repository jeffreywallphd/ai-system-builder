import { describe, expect, it } from "bun:test";
import { CompositeNodeImplementationRegistry } from "../CompositeNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "../python/PythonNodeImplementationRegistry";

describe("CompositeNodeImplementationRegistry", () => {
  it("aggregates implementations across providers", () => {
    const composite = new CompositeNodeImplementationRegistry([
      new LangChainNodeImplementationRegistry(),
      new PythonNodeImplementationRegistry(),
    ]);

    expect(composite.listImplementations().length).toBeGreaterThan(5);
    expect(
      composite.findByNodeType("langchain.prompt_template", { providerId: "python" })
        ?.descriptor.providerId
    ).toBe("python");
  });

  it("uses registry order for duplicate node type precedence", () => {
    const composite = new CompositeNodeImplementationRegistry([
      new PythonNodeImplementationRegistry(),
      new LangChainNodeImplementationRegistry(),
    ]);

    const resolved = composite.findByNodeType("langchain.llm_chat");
    expect(resolved?.descriptor.providerId).toBe("python");
  });
});
