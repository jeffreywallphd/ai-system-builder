import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "../../../../testing/node-test";
import { SystemDataRunTest } from "../SystemDataRunTest";

describe("SystemDataRunTest", () => {
  it("renders the shared accessible approved-release entry point and truthful empty state", () => {
    const pending = new Promise<never>(() => undefined);
    const html = renderToStaticMarkup(<SystemDataRunTest
      workspaceId="workspace-a"
      buildClient={{ listReleases: () => pending }}
      client={{
        describe: () => pending,
        create: () => pending,
        read: () => pending,
        update: () => pending,
        list: () => pending,
        listAudit: () => pending,
      }}
    />);
    expect(html).toContain("Secured data-entry release");
    expect(html).toContain("Approved release");
    expect(html).toContain("Load verified form");
    expect(html).toContain("Only immutable releases with a complete supported data-entry manifest can run.");
    expect(html).toContain('aria-labelledby="system-data-runtime-title"');
  });
});
