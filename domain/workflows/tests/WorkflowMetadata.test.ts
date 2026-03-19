import { describe, expect, it } from "bun:test";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "../WorkflowMetadata";

describe("Workflow metadata primitives", () => {
  it("normalizes and freezes workflow metadata", () => {
    const metadata = new WorkflowMetadata({
      name: "  Demo Workflow  ",
      description: "  description  ",
      author: "  author  ",
      tags: [" alpha ", "", " beta "],
      version: " 1.0.0 ",
      isPublishedAsTool: true,
      toolTitle: " Tool ",
      toolDescription: " desc ",
      toolCategory: " cat ",
      toolSlug: " tool-slug ",
      contextConfiguration: {
        packageReferences: [{ packageId: " pkg-1 ", alias: " Style Guide " }],
        selectedPackageIds: [" pkg-1 "],
        visibilityMode: "advanced",
        maxCharacters: 1200,
        trimPartialFragments: true,
      },
    });

    expect(metadata.name).toBe("Demo Workflow");
    expect(metadata.description).toBe("description");
    expect(metadata.author).toBe("author");
    expect(metadata.tags).toEqual(["alpha", "beta"]);
    expect(() => (metadata.tags as string[]).push("x")).toThrow();
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.isPublishedAsTool).toBeTrue();
    expect(metadata.toolTitle).toBe("Tool");
    expect(metadata.toolDescription).toBe("desc");
    expect(metadata.toolCategory).toBe("cat");
    expect(metadata.toolSlug).toBe("tool-slug");
    expect(metadata.contextConfiguration?.packageReferences).toEqual([
      {
        packageId: "pkg-1",
        alias: "Style Guide",
        version: undefined,
        includeFragmentIds: undefined,
        excludeFragmentIds: undefined,
        isEnabled: true,
      },
    ]);
    expect(metadata.contextConfiguration?.selectedPackageIds).toEqual(["pkg-1"]);
    expect(metadata.contextConfiguration?.maxCharacters).toBe(1200);
  });

  it("rejects empty names", () => {
    expect(() => new WorkflowMetadata({ name: "   " })).toThrow(
      "WorkflowMetadata.name cannot be empty."
    );
  });

  it("rejects selected package ids that are not configured", () => {
    expect(
      () =>
        new WorkflowMetadata({
          name: "Bad Workflow",
          contextConfiguration: {
            packageReferences: [{ packageId: "pkg-1" }],
            selectedPackageIds: ["pkg-2"],
          },
        })
    ).toThrow("selectedPackageIds");
  });


  it("deduplicates package references and aligns selected packages to enabled reference order", () => {
    const metadata = new WorkflowMetadata({
      name: "Context Workflow",
      contextConfiguration: {
        packageReferences: [
          { packageId: "pkg-b", alias: "B" },
          { packageId: "pkg-a", alias: "A", isEnabled: false },
          { packageId: "pkg-b", alias: "duplicate" },
          { packageId: "pkg-c", alias: "C" },
        ],
        selectedPackageIds: ["pkg-c", "pkg-a", "pkg-b"],
      },
    });

    expect(metadata.contextConfiguration?.packageReferences?.map((reference) => reference.packageId)).toEqual([
      "pkg-b",
      "pkg-a",
      "pkg-c",
    ]);
    expect(metadata.contextConfiguration?.selectedPackageIds).toEqual(["pkg-b", "pkg-c"]);
  });


  it("clones metadata via from", () => {
    const original = new WorkflowMetadata({ name: "A", tags: ["x"] });
    const cloned = WorkflowMetadata.from(original);

    expect(cloned).not.toBe(original);
    expect(cloned).toEqual(original);
  });

  it("copies audit dates and supports touch semantics", () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const updatedAt = new Date("2024-01-02T00:00:00.000Z");
    const audit = new WorkflowAuditInfo({ createdAt, updatedAt });

    expect(audit.createdAt).not.toBe(createdAt);
    expect(audit.updatedAt).not.toBe(updatedAt);
    expect(audit.createdAt?.toISOString()).toBe(createdAt.toISOString());

    const now = new Date("2024-01-03T00:00:00.000Z");
    const touched = audit.touch(now);
    expect(touched.createdAt?.toISOString()).toBe(createdAt.toISOString());
    expect(touched.updatedAt?.toISOString()).toBe(now.toISOString());

    const firstTouch = new WorkflowAuditInfo().touch(now);
    expect(firstTouch.createdAt?.toISOString()).toBe(now.toISOString());
  });

  it("supports runtime profile defaults and constraints", () => {
    expect(new WorkflowRuntimeProfile().supportsRuntime("vllm")).toBeTrue();

    const profile = new WorkflowRuntimeProfile({
      preferredRuntime: "vllm",
      allowedRuntimes: ["vllm", "ollama"],
    });

    expect(profile.supportsRuntime("vllm")).toBeTrue();
    expect(profile.supportsRuntime("transformers")).toBeFalse();

    expect(() =>
      new WorkflowRuntimeProfile({
        preferredRuntime: "vllm",
        allowedRuntimes: ["ollama"],
      })
    ).toThrow(
      "WorkflowRuntimeProfile.preferredRuntime must be included in allowedRuntimes when allowedRuntimes is provided."
    );
  });
});
