import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR-006 policy-aware scheduling and controlled execution record", () => {
  const humanAdrPath =
    "docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md";
  const aiAdrPath =
    "docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md";

  it("keeps required ADR metadata and section contract in both variants", () => {
    for (const path of [humanAdrPath, aiAdrPath]) {
      const doc = read(path);

      const requiredMetadataTokens = [
        "title: ADR-006 Policy-Aware Scheduling and Controlled Execution",
        "doc_type: adr",
        "status: active",
        "authoritativeness: canonical",
        "adr_number: 006",
        "decision_status: accepted",
        "decision_date: 2026-04-11",
      ] as const;

      const requiredSectionHeadings = [
        "## Status",
        "## Decision Date",
        "## Decision Statement",
        "## Context and Problem Statement",
        "## Decision Drivers",
        "## Considered Options",
        "## Chosen Approach",
        "## Consequences",
        "## Related Documentation",
        "## Related Code Paths",
      ] as const;

      for (const token of requiredMetadataTokens) {
        expect(doc).toContain(token);
      }
      for (const heading of requiredSectionHeadings) {
        expect(doc).toContain(heading);
      }
    }
  });

  it("captures explicit decision guidance for execution units, retries, policy enforcement, scheduling, and safe operation", () => {
    const humanAdr = read(humanAdrPath).toLowerCase();
    const aiAdr = read(aiAdrPath).toLowerCase();

    for (const doc of [humanAdr, aiAdr]) {
      expect(doc).toContain("execution units");
      expect(doc).toContain("retries");
      expect(doc).toContain("policy enforcement");
      expect(doc).toContain("scheduling");
      expect(doc).toContain("safe operation");
      expect(doc).toContain("tradeoff");
      expect(doc).toContain("rejected");
      expect(doc).toContain("fail-closed");
    }
  });

  it("is indexed and cross-linked from scheduling/execution architecture references", () => {
    const recordsReadme = read("docs/adr/records/README.md");
    const recordsReadmeAi = read("docs/adr/records/README.ai.md");
    const schedulingPolicyDoc = read(
      "docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.md",
    );
    const schedulingPolicyDocAi = read(
      "docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.ai.md",
    );
    const dispatchOutcomeDoc = read(
      "docs/architecture/run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md",
    );
    const dispatchOutcomeDocAi = read(
      "docs/architecture/run-orchestration-scheduling-dispatch-outcome-requeue-and-release.ai.md",
    );
    const dispatchSeamsDoc = read(
      "docs/architecture/run-orchestration-execution-command-dispatch-seams.md",
    );
    const dispatchSeamsDocAi = read(
      "docs/architecture/run-orchestration-execution-command-dispatch-seams.ai.md",
    );

    expect(recordsReadme).toContain(
      "adr-006-policy-aware-scheduling-and-controlled-execution.md",
    );
    expect(recordsReadmeAi).toContain(
      "adr-006-policy-aware-scheduling-and-controlled-execution.ai.md",
    );

    for (const doc of [schedulingPolicyDoc, dispatchOutcomeDoc, dispatchSeamsDoc]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain(
        "adr-006-policy-aware-scheduling-and-controlled-execution.md",
      );
    }

    for (const doc of [schedulingPolicyDocAi, dispatchOutcomeDocAi, dispatchSeamsDocAi]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain(
        "adr-006-policy-aware-scheduling-and-controlled-execution.ai.md",
      );
    }
  });
});
