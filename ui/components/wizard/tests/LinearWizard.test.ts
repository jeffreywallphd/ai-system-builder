import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("LinearWizard", () => {
  it("renders a reusable linear wizard shell with integrated progress and navigation", () => {
    const source = readSource("ui/components/wizard/LinearWizard.tsx");

    expect(source).toContain("linear-wizard");
    expect(source).toContain("Step ");
    expect(source).toContain("Back");
    expect(source).toContain("Next");
  });
});
