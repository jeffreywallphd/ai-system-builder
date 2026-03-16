import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/models interactions", () => {
  it("keeps placeholder modules consistent for ModelBrowser.tsx, ModelInstaller.tsx", () => {
    const sources = [readSource("ui/components/models/ModelBrowser.tsx"), readSource("ui/components/models/ModelInstaller.tsx")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});
