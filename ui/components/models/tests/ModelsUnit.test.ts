import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/models unit coverage", () => {
  it("defines model browser and supporting panels", () => {
    const browser = readSource("ui/components/models/ModelBrowser.tsx");
    const card = readSource("ui/components/models/ModelCard.tsx");
    const search = readSource("ui/components/models/ModelSearchBar.tsx");
    const details = readSource("ui/components/models/ModelDetailsPanel.tsx");
    const compatibility = readSource("ui/components/models/ModelCompatibilityPanel.tsx");

    expect(browser).toContain("export default function ModelBrowser");
    expect(card).toContain("export default function ModelCard");
    expect(search).toContain("export default function ModelSearchBar");
    expect(details).toContain("export default function ModelDetailsPanel");
    expect(compatibility).toContain("export default function ModelCompatibilityPanel");
  });

  it("adds model browser style composition", () => {
    const styles = readSource("ui/styles/components/model-browser.css");

    expect(styles).toContain(".ui-model-browser__sections");
    expect(styles).toContain(".ui-model-search__row");
    expect(styles).toContain("@media (max-width: 860px)");
  });
});
