import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/models contract adherence", () => {
  it("defines default component exports", () => {
    const browser = readSource("ui/components/models/ModelBrowser.tsx");
    const card = readSource("ui/components/models/ModelCard.tsx");
    const search = readSource("ui/components/models/ModelSearchBar.tsx");
    const compatibility = readSource("ui/components/models/ModelCompatibilityPanel.tsx");

    expect(browser).toContain("export default function ModelBrowser");
    expect(card).toContain("export default function ModelCard");
    expect(search).toContain("export default function ModelSearchBar");
    expect(compatibility).toContain("export default function ModelCompatibilityPanel");
  });

  it("loads model-browser styles from app.css", () => {
    const appStyles = readSource("ui/styles/app.css");

    expect(appStyles).toContain('@import "./components/model-browser.css";');
  });
});
