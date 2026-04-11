import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("architecture overloaded document split guardrails", () => {
  it("keeps split target references present in both human and AI variants", () => {
    const splitTargets = [
      "docs/architecture/domains/studio-and-system-composition/references/studio-ui-composition-and-state.md",
      "docs/architecture/domains/studio-and-system-composition/references/studio-ui-composition-and-state.ai.md",
      "docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md",
      "docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.ai.md",
      "docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.md",
      "docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.ai.md",
      "docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md",
      "docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.ai.md",
    ] as const;

    for (const path of splitTargets) {
      expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }
  });

  it("indexes split targets as canonical references in domain reference routers", () => {
    const studioReferences = read(
      "docs/architecture/domains/studio-and-system-composition/references/README.md",
    );
    const studioReferencesAi = read(
      "docs/architecture/domains/studio-and-system-composition/references/README.ai.md",
    );
    const workspaceReferences = read(
      "docs/architecture/domains/workspace-storage-and-assets/references/README.md",
    );
    const workspaceReferencesAi = read(
      "docs/architecture/domains/workspace-storage-and-assets/references/README.ai.md",
    );
    const executionReferences = read(
      "docs/architecture/domains/execution-control-plane-and-scheduling/references/README.md",
    );
    const executionReferencesAi = read(
      "docs/architecture/domains/execution-control-plane-and-scheduling/references/README.ai.md",
    );

    for (const doc of [studioReferences, studioReferencesAi]) {
      expect(doc).toContain("./studio-ui-composition-and-state.md");
      expect(doc).toContain("./workflow-and-system-composition-contracts.md");
    }

    for (const doc of [workspaceReferences, workspaceReferencesAi]) {
      expect(doc).toContain("./asset-models-and-selection.md");
    }

    for (const doc of [executionReferences, executionReferencesAi]) {
      expect(doc).toContain("./workflow-execution-runtime-handoff.md");
    }
  });

  it("keeps previously overloaded docs routed by explicit split sections", () => {
    const presentation = read("docs/architecture/presentation-and-state.md");
    const sharedAssets = read("docs/architecture/shared-asset-contracts.md");
    const workflowExecution = read("docs/architecture/workflow-execution-and-tools.md");

    expect(presentation).toContain("## Split Routing for Previously Mixed Content");
    expect(presentation).toContain(
      "domains/studio-and-system-composition/references/studio-ui-composition-and-state.md",
    );
    expect(presentation).toContain(
      "docs/architecture/multi-surface-ui-composition-foundation.md",
    );

    expect(sharedAssets).toContain("## Split Routing for Previously Mixed Content");
    expect(sharedAssets).toContain(
      "domains/workspace-storage-and-assets/references/asset-models-and-selection.md",
    );

    expect(workflowExecution).toContain("## Split Routing for Previously Mixed Content");
    expect(workflowExecution).toContain(
      "domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md",
    );

    for (const doc of [presentation, sharedAssets, workflowExecution]) {
      expect(doc).not.toContain("Direction 5 Epic");
      expect(doc).not.toContain("stories 6.");
    }
  });
});
