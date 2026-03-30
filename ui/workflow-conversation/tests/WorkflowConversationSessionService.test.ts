import { describe, expect, it } from "bun:test";
import { WorkflowDraftOutputDestinationTypes } from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  WorkflowConversationSessionService,
  type WorkflowConversationSessionStorage,
} from "../WorkflowConversationSessionService";

type MutablePayload = {
  schemaVersion: "workflow-conversation.v1";
  sessions: any[];
};

class InMemoryConversationStorage implements WorkflowConversationSessionStorage {
  private payload: MutablePayload | undefined;

  load() {
    return this.payload as any;
  }

  save(payload: any): void {
    this.payload = {
      schemaVersion: payload.schemaVersion,
      sessions: [...payload.sessions],
    };
  }
}

function createWorkflow(): any {
  return {
    id: "wf-chat",
    metadata: { name: "Chat Workflow" },
    nodes: [
      {
        id: "node-chat",
        definition: { id: "langchain.llm_chat" },
        properties: [{ id: "prompt", value: "Draft a launch summary." }],
        getProperty(propertyId: string) {
          return this.properties.find((property: any) => property.id === propertyId);
        },
      },
    ],
    getNode(nodeId: string) {
      return this.nodes.find((node: any) => node.id === nodeId);
    },
  };
}

describe("WorkflowConversationSessionService", () => {
  it("creates and persists seeded conversational sessions from workflow execution", () => {
    const storage = new InMemoryConversationStorage();
    const workflow = createWorkflow();
    const service = new WorkflowConversationSessionService({
      workflowService: {
        loadWorkflow: async () => workflow,
        executeWorkflow: async () => ({ effectiveWorkflow: workflow, result: { executionId: "exec", status: "completed", outputAssets: [] } }),
      } as any,
      storage,
      now: () => new Date("2026-03-30T10:00:00.000Z"),
      createId: (prefix) => `${prefix}-id`,
    });

    const session = service.createFromExecution({
      workflow,
      request: {
        parameters: {
          workflowConversationOutput: {
            destinationType: WorkflowDraftOutputDestinationTypes.promptResponseChat,
            title: "Workflow Chat",
            responseField: "assistant-response",
            conversationScope: "continue-session",
          },
        },
      },
      result: {
        effectiveWorkflow: workflow,
        result: { executionId: "exec-1", status: "completed", outputAssets: [] },
      } as any,
      nodeOutputs: {
        "node-chat": {
          "assistant-response": "Initial workflow response.",
        },
      },
    });

    expect(session?.metadata.workflowId).toBe("wf-chat");
    expect(session?.messages).toHaveLength(2);

    const rehydrated = new WorkflowConversationSessionService({
      workflowService: {
        loadWorkflow: async () => workflow,
        executeWorkflow: async () => ({ effectiveWorkflow: workflow, result: { executionId: "exec", status: "completed", outputAssets: [] } }),
      } as any,
      storage,
    });

    expect(rehydrated.getById(session?.id ?? "")?.messages).toHaveLength(2);
  });

  it("continues a session by appending user and assistant messages from a follow-up execution", async () => {
    const storage = new InMemoryConversationStorage();
    const workflow = createWorkflow();
    const service = new WorkflowConversationSessionService({
      workflowService: {
        loadWorkflow: async () => workflow,
        executeWorkflow: async (_request: any, onEvent?: (event: any) => void) => {
          onEvent?.({
            payload: {
              nodeOutputs: {
                "node-chat": {
                  "assistant-response": "Follow-up answer from workflow execution.",
                },
              },
            },
          });

          return {
            effectiveWorkflow: workflow,
            result: { executionId: "exec-2", status: "completed", outputAssets: [] },
          };
        },
      } as any,
      storage,
      createId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 5)}`,
    });

    const session = service.createFromExecution({
      workflow,
      result: {
        effectiveWorkflow: workflow,
        result: { executionId: "exec-1", status: "completed", outputAssets: [] },
      } as any,
      nodeOutputs: {
        "node-chat": {
          response: "Initial response",
        },
      },
    });

    if (!session) {
      throw new Error("Expected seeded session.");
    }

    const continued = await service.continueSession({
      sessionId: session.id,
      message: "Can you add implementation steps?",
    });

    expect(continued.session.messages.some((message) => message.role === "user" && message.content.includes("implementation steps"))).toBeTrue();
    expect(continued.session.messages.some((message) => message.role === "assistant" && message.content.includes("Follow-up answer"))).toBeTrue();
  });
});
