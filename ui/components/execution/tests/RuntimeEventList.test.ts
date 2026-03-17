import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeEventList from "../RuntimeEventList";

describe("RuntimeEventList", () => {
  it("renders empty state", () => {
    const html = renderToStaticMarkup(createElement(RuntimeEventList, { events: [] }));
    expect(html).toContain("Runtime events will appear here.");
  });

  it("renders rows when events exist", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeEventList, {
        events: [
          {
            id: "id-1",
            timestamp: "2026-01-01T12:00:00.000Z",
            source: "app",
            severity: "info",
            message: "hello",
          },
        ],
      })
    );

    expect(html).toContain("hello");
  });
});
