import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("WorkflowConversationPage", () => {
  it("renders seeded conversation history and continuation controls", () => {
    const source = readSource("ui/pages/WorkflowConversationPage.tsx");

    expect(source).toContain("workflow-conversation-page");
    expect(source).toContain("workflow-conversation-messages");
    expect(source).toContain("workflow-conversation-input");
    expect(source).toContain("Continue conversation");
    expect(source).toContain("service.continueSession");
  });
});
