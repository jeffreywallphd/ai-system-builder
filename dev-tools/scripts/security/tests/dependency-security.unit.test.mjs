import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateAuditReport,
  validateRuntimeSbom,
} from "../check-dependency-security.mjs";

const report = (counts) => ({
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      ...counts,
    },
  },
});

test("dependency security policy blocks every runtime advisory", () => {
  assert.equal(evaluateAuditReport(report({ moderate: 1 }), "runtime").blocking, true);
  assert.equal(evaluateAuditReport(report({}), "runtime").blocking, false);
});

test("dependency security policy reports toolchain debt but blocks critical findings", () => {
  assert.equal(evaluateAuditReport(report({ high: 4 }), "toolchain").blocking, false);
  assert.equal(evaluateAuditReport(report({ critical: 1 }), "toolchain").blocking, true);
});

test("runtime SBOM validation requires SPDX packages and relationships", () => {
  assert.deepEqual(
    validateRuntimeSbom({ spdxVersion: "SPDX-2.3", packages: [{}], relationships: [{}] }),
    { packageCount: 1, relationshipCount: 1 },
  );
  assert.throws(() => validateRuntimeSbom({ spdxVersion: "SPDX-2.2" }), /SPDX 2.3/);
});

test("CI and image builds use the tracked lockfile and immutable action references", async () => {
  const [gitignore, workflow, dockerfile] = await Promise.all([
    readFile(".gitignore", "utf8"),
    readFile(".github/workflows/ci.yml", "utf8"),
    readFile("deployments/server/Dockerfile", "utf8"),
  ]);

  assert.doesNotMatch(gitignore, /^package-lock\.json$/m);
  assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(?![0-9a-f]{40}(?:\s|$))/);
  assert.match(dockerfile, /COPY package\.json package-lock\.json/);
  assert.doesNotMatch(dockerfile, /npm install/);
});
