import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  describe,
  expect,
  it,
  testDouble,
} from "../../../../testing/node-test";
import { ConversationRunTest } from "../ConversationRunTest";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: dom.window,
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: dom.window.document,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

describe("ConversationRunTest", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it("uses execution-plan identity, bounds the accessible transcript, and states host limits", async () => {
    const createSession = testDouble.fn(
      async (input: {
        workspaceId: string;
        sourceExecutionPlanId: string;
      }) => ({
        ok: true as const,
        value: { conversationSessionId: "session-1" },
      }),
    );
    const turns = Array.from({ length: 101 }, (_, index) => ({
      userMessage: {
        id: `user-${index}`,
        role: "user",
        text: `Question ${index}`,
      },
      assistantResponse: {
        id: `assistant-${index}`,
        role: "assistant",
        text: `Answer ${index}`,
      },
    }));
    const plansClient = {
      listExecutionPlanSummaries: async () => ({
        ok: true as const,
        value: {
          summaries: [
            {
              executionPlanId: "execution-plan-1",
              name: "Controlled assistant",
              executionPlanStatus: "ready-for-review",
            },
          ],
        },
      }),
    };
    const client = {
      createConversationSessionFromPlan: createSession,
      approveConversationSession: async () => ({
        ok: true as const,
        value: {},
      }),
      listConversationSessions: async () => ({
        ok: true as const,
        value: {
          sessions: [
            {
              conversationSessionId: "session-1",
              sessionLabel: "Controlled test",
            },
          ],
        },
      }),
      readConversationSession: async () => ({
        ok: true as const,
        value: {
          conversationSessionId: "session-1",
          sessionStatus: "active",
          approvalStatus: "approved",
          runtimeStatus: "ready",
          actions: {
            mayApprove: false,
            maySubmitMessage: true,
            mayCancel: false,
            mayRetry: false,
          },
        },
      }),
      readConversationTranscript: async () => ({
        ok: true as const,
        value: { ok: true, turns },
      }),
      submitConversationTurn: async () => ({
        ok: true as const,
        value: { status: "succeeded" },
      }),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ConversationRunTest
          workspaceId="workspace-1"
          plansClient={plansClient}
          client={client}
          createOperationId={() => "operation-test"}
        />,
      );
    });
    await settle();
    await settle();

    const planSelect = container.querySelector(
      'select[aria-label="Execution plan"]',
    ) as HTMLSelectElement;
    expect(planSelect.value).toBe("execution-plan-1");
    const log = container.querySelector('[role="log"]');
    expect(log?.children.length).toBe(200);
    expect(container.textContent).toContain(
      "2 older transcript entries are hidden",
    );
    expect(container.textContent).toContain(
      "Tools, retrieval, memory, file or image input, and streaming are not enabled.",
    );
    expect(container.textContent).not.toContain("protected instruction");

    const start = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Start test conversation",
    );
    await act(async () => start?.click());
    expect(createSession.mock.calls[0]?.[0]).toEqual({
      workspaceId: "workspace-1",
      sourceExecutionPlanId: "execution-plan-1",
    });
  });
});

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}
