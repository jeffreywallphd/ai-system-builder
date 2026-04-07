import { describe, expect, it } from "bun:test";
import { ToolAutomationTypeClassifier } from "../ToolAutomationTypeClassifier";

describe("ToolAutomationTypeClassifier", () => {
  it("classifies tools based on text signals", () => {
    const classifier = new ToolAutomationTypeClassifier();

    expect(
      classifier.classify({
        title: "Generate product hero image",
        description: "Create photorealistic image variations",
      }).id
    ).toBe("image-generation");

    expect(
      classifier.classify({
        title: "Answer customer support messages",
        description: "Draft friendly replies for chat inboxes",
      }).id
    ).toBe("customer-messaging");
  });
});
