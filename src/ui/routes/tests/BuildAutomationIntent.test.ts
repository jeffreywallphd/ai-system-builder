import { describe, expect, it } from "bun:test";
import { appendAutomationIntentToPath, readAutomationIntentFromSearch } from "../BuildAutomationIntent";

describe("BuildAutomationIntent", () => {
  it("appends automation intent to launch paths while preserving existing query params", () => {
    const path = appendAutomationIntentToPath(
      "/studio-shell/workflow?entryMode=intent&buildIntent=automate-task",
      "Summarize support tickets every morning.",
    );

    const [routePath, search] = path.split("?");
    const params = new URLSearchParams(search ?? "");

    expect(routePath).toBe("/studio-shell/workflow");
    expect(params.get("entryMode")).toBe("intent");
    expect(params.get("buildIntent")).toBe("automate-task");
    expect(params.get("automationIntent")).toBe("Summarize support tickets every morning.");
  });

  it("reads automation intent from query search when present", () => {
    expect(readAutomationIntentFromSearch("?automationIntent=Queue%20invoice%20approvals")).toBe("Queue invoice approvals");
    expect(readAutomationIntentFromSearch("?buildIntent=automate-task")).toBeUndefined();
  });
});
