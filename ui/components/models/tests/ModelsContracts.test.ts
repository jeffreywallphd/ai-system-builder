import { describe, expect, it } from "bun:test";
import { importModule } from "../../../tests/testUtils";

describe("ui/components/models contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/components/models/ModelBrowser.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/components/models/ModelInstaller.tsx"))).toEqual([]);
  });
});
