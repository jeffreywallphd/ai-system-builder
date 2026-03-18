import { describe, expect, it } from "bun:test";
import { ComfyNodeImplementationRegistry } from "../comfyui/ComfyNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "../python/PythonNodeImplementationRegistry";

describe("Node provider interactions", () => {
  it("keeps overlapping node types provider-specific", () => {
    const langchain = new LangChainNodeImplementationRegistry();
    const python = new PythonNodeImplementationRegistry();

    const type = "langchain.prompt_template";
    const langchainImpl = langchain.findByNodeType(type);
    const pythonImpl = python.findByNodeType(type);

    expect(langchainImpl).toBeDefined();
    expect(pythonImpl).toBeDefined();
    expect(langchainImpl?.descriptor.providerId).toBe("langchain");
    expect(pythonImpl?.descriptor.providerId).toBe("python");
  });

  it("exposes known comfy node descriptors", () => {
    const comfy = new ComfyNodeImplementationRegistry();
    expect(comfy.findByNodeType("KSampler")?.descriptor.runtimeId).toBe("comfyui");
  });

  it("registers newly added langchain runtime nodes across providers", () => {
    const langchain = new LangChainNodeImplementationRegistry();
    const python = new PythonNodeImplementationRegistry();

    expect(langchain.findByNodeType("langchain.output_parser")?.descriptor.title).toContain("Format AI Output");
    expect(langchain.findByNodeType("langchain.document_loader")?.descriptor.title).toContain("Load Document");
    expect(langchain.findByNodeType("langchain.agent")?.descriptor.title).toContain("AI Agent");
    expect(langchain.findByNodeType("langchain.vector_store_upsert")?.descriptor.title).toContain(
      "Save Knowledge to Search Index"
    );
    expect(python.findByNodeType("langchain.output_parser")?.descriptor.providerId).toBe("python");
    expect(python.findByNodeType("langchain.document_loader")?.descriptor.providerId).toBe("python");
    expect(python.findByNodeType("langchain.agent")?.descriptor.providerId).toBe("python");
    expect(python.findByNodeType("langchain.vector_store_upsert")?.descriptor.providerId).toBe(
      "python"
    );
  });
});
