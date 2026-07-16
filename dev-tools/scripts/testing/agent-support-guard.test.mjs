import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findAgentSupportFailures,
  scenarioMatchesPack,
} from "../agent-support/check-agent-support.mjs";

const createFixtureRoot = async () => mkdtemp(path.join(tmpdir(), "agent-support-guard-"));
const writeFixture = async (root, relativePath, contents = "fixture\n") => {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
};

const buildInputs = () => ({
  catalog: {
    schemaVersion: 1,
    baselinePack: "docs/context/packs/index.pack.md",
    defaultAdditionalPackLimit: 2,
    packs: [
      {
        id: "testing",
        path: "docs/context/packs/testing.pack.md",
        description: "Testing",
        taskSignals: ["test"],
        pathSignals: ["tests/"],
        verification: ["npm test"],
      },
    ],
  },
  evaluationSuite: {
    schemaVersion: 1,
    scenarios: [
      {
        id: "test-change",
        task: "Add a focused test.",
        affectedPaths: ["tests/example.test.ts"],
        expectedPacks: ["testing"],
        forbiddenPacks: [],
        requiredSources: ["docs/source.md"],
        requiredChecks: ["npm test"],
        decisionExpectation: "proceed",
        acceptanceSignals: ["The test proves the behavior."],
      },
    ],
  },
  packageJson: { scripts: { test: "node test.mjs" } },
});

test("agent support matching uses task and affected-path signals", () => {
  const inputs = buildInputs();
  assert.equal(
    scenarioMatchesPack(inputs.evaluationSuite.scenarios[0], inputs.catalog.packs[0]),
    true,
  );
});

test("agent support guard accepts a complete minimal catalog and scenario suite", async () => {
  const root = await createFixtureRoot();
  await writeFixture(root, "docs/context/packs/index.pack.md");
  await writeFixture(root, "docs/context/packs/testing.pack.md");
  await writeFixture(root, "docs/source.md");

  assert.deepEqual(findAgentSupportFailures({ repoRoot: root, ...buildInputs() }), []);
});

test("agent support guard rejects unknown and over-budget pack expectations", async () => {
  const root = await createFixtureRoot();
  await writeFixture(root, "docs/context/packs/index.pack.md");
  await writeFixture(root, "docs/context/packs/testing.pack.md");
  await writeFixture(root, "docs/source.md");
  const inputs = buildInputs();
  inputs.evaluationSuite.scenarios[0].expectedPacks = ["testing", "missing", "extra"];

  const failures = findAgentSupportFailures({ repoRoot: root, ...inputs });

  assert.ok(failures.some((failure) => failure.includes("expectedPacks must contain")));
  assert.ok(failures.some((failure) => failure.includes("unknown expected pack 'missing'")));
});
