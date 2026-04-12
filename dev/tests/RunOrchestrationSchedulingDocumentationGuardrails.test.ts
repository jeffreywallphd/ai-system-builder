import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("run orchestration scheduling documentation guardrails", () => {
  it("documents queue integration, reservation arbitration, and dispatch-settlement invariants", () => {
    const doc = readProjectFile(
      "docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md",
    );

    const requiredTokens = [
      "Story 17.2.8",
      "End-to-end scheduling, reservation, and dispatch settlement flow",
      "ProcessAuthoritativeRunQueueSchedulingUseCase",
      "MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase",
      "HandleRunDispatchResultUseCase",
      "deferRunClaimForNoPlacement",
      "No-placement outcomes are explicit and reason-bearing",
      "already-assigned",
      "Placement holds are always released",
      "Future capacity and reservation-policy extension map",
    ] as const;

    for (const token of requiredTokens) {
      expect(doc).toContain(token);
    }
  });

  it("keeps contributor and architecture index references aligned with the scheduling baseline", () => {
    const contributorGuide = readProjectFile("docs/run-orchestration-contributor-guide.md");
    const contributorGuideAi = readProjectFile("docs/run-orchestration-contributor-guide.ai.md");
    const architectureReadme = readProjectFile("docs/architecture/README.md");
    const architectureReadmeAi = readProjectFile("docs/architecture/README.ai.md");
    const integrationDocAi = readProjectFile(
      "docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.ai.md",
    );

    expect(contributorGuide).toContain("run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md");
    expect(contributorGuide).toContain("Queue integration and reservation/arbitration extension seams");
    expect(contributorGuideAi).toContain("run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md");
    expect(contributorGuideAi).toContain("Queue/reservation/arbitration integration map");
    expect(architectureReadme).toContain(
      "run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md",
    );
    expect(architectureReadmeAi).toContain("Feature 17 / Epic 17.2 Story 17.2.8");
    expect(integrationDocAi).toContain("Story 17.2.8");
    expect(integrationDocAi).toContain("HandleRunDispatchResultUseCase");
  });
});
