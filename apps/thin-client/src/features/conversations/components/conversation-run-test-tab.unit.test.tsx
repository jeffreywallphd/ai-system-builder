import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  describe,
  it,
  expect,
  afterEach,
  testDouble,
} from "../../../../../../modules/testing/node-test";
import { ConversationRunTestTab } from "./ConversationRunTestTab";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("thin ConversationRunTestTab", () => {
  let c: HTMLDivElement | undefined;
  let r: any;
  afterEach(async () => {
    if (r) await act(async () => r.unmount());
    c?.remove();
    delete (globalThis as any).fetch;
  });
  it("renders run and test UI", async () => {
    (globalThis as any).fetch = testDouble.fn().mockResolvedValue({
      status: 200,
      json: testDouble
        .fn()
        .mockResolvedValue({ ok: true, value: { summaries: [] } }),
    });
    c = document.createElement("div");
    document.body.appendChild(c);
    r = createRoot(c);
    await act(async () => {
      r.render(<ConversationRunTestTab workspaceId="ws1" />);
    });
    expect(c.textContent).toContain("Run & Test");
    expect(c.textContent).toContain("Test an assistant");
    expect(c.textContent).toContain("Choose an eligible execution plan");
    expect(c.querySelector('[role="log"]') !== null).toBe(true);
  });
});
