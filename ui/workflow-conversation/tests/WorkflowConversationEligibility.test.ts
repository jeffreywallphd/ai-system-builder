import { describe, expect, it } from "bun:test";
import { WorkflowDraftOutputDestinationTypes } from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { evaluateWorkflowConversationEligibility } from "../WorkflowConversationEligibility";

function createWorkflow(): any {
  return {
    id: "wf-chat",
    metadata: { name: "Chat Workflow" },
    nodes: [
      {
        id: "node-chat",
        definition: { id: "langchain.llm_chat" },
        properties: [
          { id: "prompt", value: "Summarize the latest notes." },
        ],
      },
    ],
  };
}

describe("WorkflowConversationEligibility", () => {
  it("recognizes conversational prompt-response workflow runs", () => {
    const eligibility = evaluateWorkflowConversationEligibility({
      workflow: createWorkflow(),
      request: {
        parameters: {
          workflowConversationOutput: {
            destinationType: WorkflowDraftOutputDestinationTypes.promptResponseChat,
            responseField: "assistant-response",
          },
        },
      },
      result: {
        effectiveWorkflow: createWorkflow(),
        result: {
          executionId: "exec-1",
          status: "completed",
          outputAssets: [],
        },
      } as any,
      nodeOutputs: {
        "node-chat": {
          "assistant-response": "Here is the concise summary.",
        },
      },
    });

    expect(eligibility.eligible).toBeTrue();
    expect(eligibility.seed?.promptText).toBe("Summarize the latest notes.");
    expect(eligibility.seed?.responseText).toContain("concise summary");
  });

  it("rejects executions without prompt-like input", () => {
    const workflow = createWorkflow();
    workflow.nodes[0].properties = [{ id: "temperature", value: 0.2 }];

    const eligibility = evaluateWorkflowConversationEligibility({
      workflow,
      result: {
        effectiveWorkflow: workflow,
        result: {
          executionId: "exec-2",
          status: "completed",
          outputAssets: [],
        },
      } as any,
      nodeOutputs: {
        "node-chat": {
          response: "assistant output",
        },
      },
    });

    expect(eligibility.eligible).toBeFalse();
    expect(eligibility.reason).toContain("prompt-like");
  });
});
