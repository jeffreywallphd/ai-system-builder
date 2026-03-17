import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeEventRow from "../RuntimeEventRow";

describe("RuntimeEventRow", () => {
  it("renders source severity timestamp and message", () => {
    const html = renderToStaticMarkup(
      createElement("ul", undefined, [
        createElement(RuntimeEventRow, {
          key: "row",
          event: {
            id: "e1",
            timestamp: "2026-01-01T12:00:00.000Z",
            source: "python-runtime",
            severity: "error",
            message: "boom",
          },
        }),
      ])
    );

    expect(html).toContain("python-runtime");
    expect(html).toContain("error");
    expect(html).toContain("boom");
  });
});
