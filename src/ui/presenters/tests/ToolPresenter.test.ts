import { describe, expect, it } from "bun:test";
import { ToolPresenter } from "../ToolPresenter";

describe("ToolPresenter", () => {
  it("presents tool title", () => {
    expect(new ToolPresenter().presentTitle({ title: "Demo" } as any)).toBe("Demo");
  });
});
