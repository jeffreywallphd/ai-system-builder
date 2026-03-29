import { describe, expect, it } from "bun:test";
import { resolveWizardPageRoute, type WizardPageRouteContract } from "../WizardPageRouting";

const testContract: WizardPageRouteContract<"overview" | "details" | "review"> = Object.freeze({
  wizardId: "test-wizard",
  defaultPageId: "overview",
  queryParam: "page",
  pages: Object.freeze([
    Object.freeze({ id: "overview", title: "Overview", routeSegment: "overview" }),
    Object.freeze({ id: "details", title: "Details", routeSegment: "details" }),
    Object.freeze({ id: "review", title: "Review", routeSegment: "review" }),
  ]),
});

describe("WizardPageRouting", () => {
  it("resolves route page ids when provided", () => {
    const resolution = resolveWizardPageRoute({
      contract: testContract,
      routePageId: "details",
    });

    expect(resolution.resolvedPageId).toBe("details");
    expect(resolution.requestedPageId).toBe("details");
    expect(resolution.source).toBe("route-param");
  });

  it("falls back to the default page for invalid route ids", () => {
    const resolution = resolveWizardPageRoute({
      contract: testContract,
      routePageId: "missing",
    });

    expect(resolution.resolvedPageId).toBe("overview");
    expect(resolution.invalidPageId).toBe("missing");
    expect(resolution.source).toBe("route-param");
  });

  it("resolves query page ids when route page ids are absent", () => {
    const resolution = resolveWizardPageRoute({
      contract: testContract,
      search: "?page=review",
    });

    expect(resolution.resolvedPageId).toBe("review");
    expect(resolution.requestedPageId).toBe("review");
    expect(resolution.source).toBe("query-param");
  });

  it("returns default page resolution when no page id is supplied", () => {
    const resolution = resolveWizardPageRoute({
      contract: testContract,
      search: "",
    });

    expect(resolution.resolvedPageId).toBe("overview");
    expect(resolution.requestedPageId).toBeUndefined();
    expect(resolution.invalidPageId).toBeUndefined();
    expect(resolution.source).toBe("none");
  });
});
