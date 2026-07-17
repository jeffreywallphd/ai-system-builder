import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "../../../../testing/node-test";
import { FoundationAssetPreview } from "../FoundationAssetPreview";

describe("FoundationAssetPreview", () => {
  it("renders accessible form, table, conversation, and fail-closed policy representatives", () => {
    const form = renderToStaticMarkup(<FoundationAssetPreview definitionId="builtin.feature.record-form" />);
    expect(form).toContain("Accessible form preview");
    expect(form).toContain("<form");
    expect(form).toContain("<label");
    expect(form).toContain('type="submit"');

    const data = renderToStaticMarkup(<FoundationAssetPreview definitionId="builtin.feature.data-preview" />);
    expect(data).toContain("Bounded data preview");
    expect(data).toContain("<table");
    expect(data).toContain('scope="col"');

    const conversation = renderToStaticMarkup(<FoundationAssetPreview definitionId="conversation.basic-assistant-system" />);
    expect(conversation).toContain("Conversation preview");
    expect(conversation).toContain('aria-label="Example conversation"');
    expect(conversation).toContain("Send preview");

    const policy = renderToStaticMarkup(<FoundationAssetPreview definitionId="builtin.security.authorization-policy" />);
    expect(policy).toContain("Fail-closed policy preview");
    expect(policy).toContain("Denied by default");
    expect(policy).toContain('role="status"');
  });

  it("returns a truthful unsupported state outside the closed registry", () => {
    const html = renderToStaticMarkup(<FoundationAssetPreview definitionId="workspace.unknown" />);
    expect(html).toContain("Preview unavailable");
    expect(html).toContain('role="status"');
  });
});

