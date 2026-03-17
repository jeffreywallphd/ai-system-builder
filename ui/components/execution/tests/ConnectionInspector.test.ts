import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("execution ui references connection inspector", () => {
  it("keeps workflow connection inspector in place", () => {
    const source = readSource("ui/components/workflow/ConnectionInspector.tsx");
    expect(source).toContain("Connection Inspector");
  });
});
