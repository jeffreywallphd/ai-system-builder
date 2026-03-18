import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/models unit coverage", () => {
  it("defines model browser and supporting panels", () => {
    const browser = readSource("ui/components/models/ModelBrowser.tsx");
    const card = readSource("ui/components/models/ModelCard.tsx");
    const search = readSource("ui/components/models/ModelSearchBar.tsx");
    const compatibility = readSource("ui/components/models/ModelCompatibilityPanel.tsx");

    expect(browser).toContain("export default function ModelBrowser");
    expect(browser).toContain("const [isInstalledExpanded, setInstalledExpanded] = useState<boolean>(false)");
    expect(browser).toContain("{isInstalledExpanded ? \"Hide\" : \"Show\"}");
    expect(card).toContain("export default function ModelCard");
    expect(card).toContain("Show More Details");
    expect(card).toContain("Install Selected");
    expect(card).toContain("File type");
    expect(search).toContain("export default function ModelSearchBar");
    expect(compatibility).toContain("export default function ModelCompatibilityPanel");
  });

  it("adds model browser style composition", () => {
    const styles = readSource("ui/styles/components/model-browser.css");

    expect(styles).toContain(".ui-model-browser__sections");
    expect(styles).toContain("flex-direction: column");
    expect(styles).toContain(".ui-model-browser__list--remote");
    expect(styles).toContain(".ui-model-card__filter");
    expect(styles).toContain(".ui-model-card__file-row");
    expect(styles).toContain("@media (max-width: 860px)");
  });
});
