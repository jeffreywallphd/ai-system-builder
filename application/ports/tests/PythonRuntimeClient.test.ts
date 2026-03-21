import { describe, expect, it } from "bun:test";
import type { IPythonRuntimeClient } from "../interfaces/IPythonRuntimeClient";

describe("IPythonRuntimeClient contract", () => {
  it("supports health, execution, and document conversion", async () => {
    const client: IPythonRuntimeClient = {
      health: async () => ({ status: "ok", runtime: "python" }),
      executeNode: async (request) => ({
        executionId: request.executionId ?? "exec-1",
        nodeId: request.nodeId,
        status: "completed",
        outputs: { echo: request.inputs ?? {} },
      }),
      executeWorkflow: async (request) => ({
        executionId: request.executionId ?? "wf-exec-1",
        workflowId: request.workflowId,
        status: "completed",
        nodeResults: { n1: { result: "ok" } },
      }),
      convertDocumentToMarkdown: async (request) => ({
        success: true,
        filename: request.filename,
        contentType: request.contentType,
        extension: ".md",
        sourceFormat: "markdown",
        outputFormat: "markdown",
        markdownContent: "# Converted",
        converter: { id: "test-converter" },
        warnings: [],
        metadata: { strategy: "pass_through" },
      }),
    };

    expect((await client.health()).runtime).toBe("python");
    expect((await client.executeNode({ nodeId: "n1", nodeType: "langchain.prompt_template" })).status).toBe(
      "completed"
    );
    expect((await client.executeWorkflow({ workflowId: "wf-1", nodes: [], connections: [] })).status).toBe(
      "completed"
    );
    expect((await client.convertDocumentToMarkdown({
      filename: "notes.md",
      outputFormat: "markdown",
      content: new Uint8Array(),
    })).outputFormat).toBe("markdown");
  });
});
