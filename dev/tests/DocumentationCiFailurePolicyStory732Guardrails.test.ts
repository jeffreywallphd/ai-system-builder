import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

type LintCheckResult = {
  readonly check: { readonly id: string; readonly description: string };
  readonly elapsedMs: number;
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly signal: string | null;
  readonly error: Error | null;
};

type LintCheckOutcome = {
  readonly result: LintCheckResult;
  readonly outcome: "pass" | "warn" | "fail";
};

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const {
  evaluateCheckOutcome,
  summarizeRunOutcome,
} = require("../scripts/lint-docs.cjs") as {
  evaluateCheckOutcome: (input: {
    result: LintCheckResult;
    strictImportant: boolean;
  }) => LintCheckOutcome;
  summarizeRunOutcome: (evaluations: readonly LintCheckOutcome[]) => {
    hasFailures: boolean;
    hasWarnings: boolean;
  };
};

function createFailedResult(issueCode: string, message: string): LintCheckResult {
  return {
    check: {
      id: "fixture-check",
      description: "Fixture check",
    },
    elapsedMs: 1,
    status: 1,
    stdout: `- [${issueCode}] ${message}\n`,
    stderr: "",
    signal: null,
    error: null,
  };
}

describe("story 7.3.2 docs lint CI policy behavior", () => {
  it("treats important findings as non-blocking by default and blocking in strict mode", () => {
    const importantResult = createFailedResult("READ-002", "Router readability boundary exceeded.");

    const defaultOutcome = evaluateCheckOutcome({
      result: importantResult,
      strictImportant: false,
    });
    const strictOutcome = evaluateCheckOutcome({
      result: importantResult,
      strictImportant: true,
    });

    expect(defaultOutcome.outcome).toBe("warn");
    expect(strictOutcome.outcome).toBe("fail");
  });

  it("keeps critical and unparsed failures blocking", () => {
    const criticalResult = createFailedResult("REGISTRY_ENTRY_INVALID", "Registry entry title is required.");
    const unparsedResult: LintCheckResult = {
      ...criticalResult,
      stdout: "",
      stderr: "Validation crashed unexpectedly.\n",
    };

    const criticalOutcome = evaluateCheckOutcome({
      result: criticalResult,
      strictImportant: false,
    });
    const unparsedOutcome = evaluateCheckOutcome({
      result: unparsedResult,
      strictImportant: false,
    });

    expect(criticalOutcome.outcome).toBe("fail");
    expect(unparsedOutcome.outcome).toBe("fail");
  });

  it("summarizes warn-only runs as non-failing", () => {
    const warnEvaluation = evaluateCheckOutcome({
      result: createFailedResult("READ-003", "Architecture overview readability limits exceeded."),
      strictImportant: false,
    });

    const summary = summarizeRunOutcome([warnEvaluation]);
    expect(summary.hasFailures).toBe(false);
    expect(summary.hasWarnings).toBe(true);
  });
});

describe("story 7.3.2 CI/failure policy documentation guardrails", () => {
  it("keeps CI behavior and severity consequences explicit in canonical docs", () => {
    const standard = readFileSync(
      resolve(repoRoot, "docs/context/governance/documentation-quality-standard.md"),
      "utf8",
    ).toLowerCase();
    const standardAi = readFileSync(
      resolve(repoRoot, "docs/context/governance/documentation-quality-standard.ai.md"),
      "utf8",
    ).toLowerCase();
    const standardsGuide = readFileSync(
      resolve(repoRoot, "docs/contributors/documentation-quality-enforced-standards-guide.md"),
      "utf8",
    ).toLowerCase();
    const standardsGuideAi = readFileSync(
      resolve(repoRoot, "docs/contributors/documentation-quality-enforced-standards-guide.ai.md"),
      "utf8",
    ).toLowerCase();

    for (const content of [standard, standardAi, standardsGuide, standardsGuideAi]) {
      expect(content).toContain("shared automation");
      expect(content).toContain("critical");
      expect(content).toContain("important");
      expect(content).toContain("advisory");
      expect(content).toContain("non-blocking");
      expect(content).toContain("strict-important");
      expect(content).toContain("npm run docs:lint");
    }
  });
});
