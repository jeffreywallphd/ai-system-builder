import { describe, expect, it } from "bun:test";
import { ComfyNodeImplementationRegistry } from "../comfyui/ComfyNodeImplementationRegistry";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";
import { PythonNodeImplementationRegistry } from "../python/PythonNodeImplementationRegistry";

describe("Node provider interactions", () => {
  it("keeps overlapping node types provider-specific", () => {
    const langchain = new LangChainNodeImplementationRegistry();
    const python = new PythonNodeImplementationRegistry();

    const type = "langchain.prompt-template";
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
});
