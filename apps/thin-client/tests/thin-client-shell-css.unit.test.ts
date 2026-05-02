import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "../../../modules/testing/node-test";

const shellCssPath = resolve("apps/thin-client/src/styles/components/shell.css");

function readShellCss(): string {
  return readFileSync(shellCssPath, "utf8");
}

function getRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

function getMediaRule(css: string, selector: string): string {
  const mediaStart = css.indexOf("@media (max-width: 48rem)");
  const mobileCss = mediaStart >= 0 ? css.slice(mediaStart) : "";
  return getRule(mobileCss, selector);
}

describe("thin-client shell styling", () => {
  it("keeps the brand logo beside the product title", () => {
    const css = readShellCss();
    const brandRule = getRule(css, ".ui-shell__brand");

    expect(brandRule).toContain("display: flex");
    expect(brandRule).toContain("align-items: center");
    expect(css).toContain(".ui-shell__logo-frame");
    expect(css).toContain(".ui-shell__title");
  });

  it("constrains the logo image for mobile header layout", () => {
    const css = readShellCss();
    const mobileLogoFrameRule = getMediaRule(css, ".ui-shell__logo-frame");
    const logoImageRule = getRule(css, ".ui-shell__logo-image");

    expect(css).toContain("@media (max-width: 48rem)");
    expect(mobileLogoFrameRule).toContain("width: 2.25rem");
    expect(mobileLogoFrameRule).toContain("height: 2.25rem");
    expect(logoImageRule).toContain("object-fit: contain");
  });
});
