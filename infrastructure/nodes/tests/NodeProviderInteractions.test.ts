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
    expect(langchainImpl?.descriptor.nodeDefinition?.title).toBe("Build Prompt");
    expect(pythonImpl?.descriptor.nodeDefinition?.title).toBe("Build Prompt");
  });

  it("exposes known comfy node descriptors", () => {
    const comfy = new ComfyNodeImplementationRegistry();
    const sampler = comfy.findByNodeType("KSampler");

    expect(sampler?.descriptor.runtimeId).toBe("comfyui");
    expect(sampler?.descriptor.nodeDefinition?.description).toContain("delegated ComfyUI workflow");
    expect(sampler?.descriptor.nodeDefinition?.category).toBe("sampling/core");
  });

  it("registers canonical langchain node metadata across providers", () => {
    const langchain = new LangChainNodeImplementationRegistry();
    const python = new PythonNodeImplementationRegistry();

    const langchainVectorStore = langchain.findByNodeType("langchain.vector_store_upsert");
    const pythonVectorStore = python.findByNodeType("langchain.vector_store_upsert");
    const langchainAgent = langchain.findByNodeType("langchain.agent");

    expect(langchain.findByNodeType("langchain.output_parser")?.descriptor.title).toContain("Format AI Output");
    expect(langchain.findByNodeType("langchain.document_loader")?.descriptor.title).toContain("Load Document");
    expect(langchainAgent?.descriptor.title).toContain("AI Agent");
    expect(langchainVectorStore?.descriptor.title).toContain("Save to Knowledge Base");
    expect(langchainVectorStore?.descriptor.nodeDefinition?.category).toBe("LangChain / Knowledge");
    expect(langchainVectorStore?.descriptor.nodeDefinition?.description).toContain("knowledge base");
    expect(langchainAgent?.descriptor.nodeDefinition?.technicalDescription).toContain("Uses an LLM with tools");
    expect(langchainAgent?.descriptor.nodeDefinition?.projection?.group).toBe("Tier 2 LLM");
    expect(pythonVectorStore?.descriptor.providerId).toBe("python");
    expect(pythonVectorStore?.descriptor.nodeDefinition?.title).toBe(
      langchainVectorStore?.descriptor.nodeDefinition?.title
    );
    expect(pythonVectorStore?.descriptor.nodeDefinition?.properties.map((property) => property.id)).toEqual(
      langchainVectorStore?.descriptor.nodeDefinition?.properties.map((property) => property.id)
    );
  });
});
