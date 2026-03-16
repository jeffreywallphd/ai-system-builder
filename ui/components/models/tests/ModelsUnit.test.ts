import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../../tests/testUtils";

describe("ui/components/models unit coverage", () => {
  it("ModelBrowser.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/models/ModelBrowser.tsx"));
  it("ModelInstaller.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/models/ModelInstaller.tsx"));
});
