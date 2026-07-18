// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import { ConversationRunTestTab } from "./ConversationRunTestTab";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("ConversationRunTestTab", () => {
  let c: HTMLDivElement | undefined;
  let r: any;
  afterEach(async () => {
    if (r) await act(async () => r.unmount());
    c?.remove();
    delete (window as any).desktopApi;
  });
  it("shows run and test wording and message label", async () => {
    (window as any).desktopApi = {
      listExecutionPlanSummaries: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { summaries: [] } }),
      listConversationSessions: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { sessions: [] } }),
    };
    c = document.createElement("div");
    document.body.appendChild(c);
    r = createRoot(c);
    await act(async () => {
      r.render(<ConversationRunTestTab workspaceId="ws1" />);
    });
    expect(c.textContent).toContain("Run & Test");
    expect(c.textContent).toContain("Test an assistant");
    expect(c.textContent).toContain("Choose an eligible execution plan");
    expect(c.querySelector('[role="log"]')).not.toBeNull();
  });
});
