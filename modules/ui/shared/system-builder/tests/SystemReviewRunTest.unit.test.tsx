import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "../../../../testing/node-test";
import { SystemReviewRunTest } from "../SystemReviewRunTest";

describe("SystemReviewRunTest", () => {
  it("renders the shared accessible approved-release review entry point and truthful empty state", () => {
    const pending = new Promise<never>(() => undefined);
    const html = renderToStaticMarkup(
      <SystemReviewRunTest
        workspaceId="workspace-a"
        buildClient={{ listReleases: () => pending }}
        client={{
          describe: () => pending,
          browse: () => pending,
          detail: () => pending,
          preview: () => pending,
          listAudit: () => pending,
        }}
      />,
    );
    expect(html).toContain("Secured data-review release");
    expect(html).toContain("Approved release");
    expect(html).toContain("Load verified review");
    expect(html).toContain(
      "Only immutable releases with the complete review policy can run.",
    );
    expect(html).toContain('aria-labelledby="system-review-runtime-title"');
    expect(html).not.toContain('aria-label="Artifact preview"');
  });
});
