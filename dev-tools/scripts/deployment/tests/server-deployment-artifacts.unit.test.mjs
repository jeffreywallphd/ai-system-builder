import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inspectServerDeploymentArtifacts } from "../server-deployment-artifacts-core.mjs";

const paths = {
  dockerfile: "deployments/server/Dockerfile",
  compose: "deployments/server/compose.qualification.yaml",
  kubernetes: "deployments/server/kubernetes-deployment.example.yaml",
  workflow: ".github/workflows/ci.yml",
};

async function sources() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([name, path]) => [
        name,
        await readFile(path, "utf8"),
      ]),
    ),
  );
}

test("managed deployment artifacts satisfy immutable and restricted single-replica policy", async () => {
  assert.deepEqual(inspectServerDeploymentArtifacts(await sources()), []);
});

test("deployment policy detects mutable images, privilege drift, and overlapping replicas", async () => {
  const changed = await sources();
  changed.dockerfile = changed.dockerfile.replace(/@sha256:[a-f0-9]{64}/g, "");
  changed.compose = changed.compose.replace(
    "read_only: true",
    "read_only: false",
  );
  changed.kubernetes = changed.kubernetes.replace(
    "type: Recreate",
    "type: RollingUpdate",
  );
  const violations = inspectServerDeploymentArtifacts(changed).join("\n");
  assert.match(violations, /digest-pinned/);
  assert.match(violations, /root filesystem is writable/);
  assert.match(violations, /overlapping replicas/);
});
