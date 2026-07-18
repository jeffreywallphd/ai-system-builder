import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CI continuously runs the disposable PostgreSQL 18 live conformance suite", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /postgresql-qualification:/);
  assert.match(workflow, /image: postgres:18-bookworm/);
  assert.match(
    workflow,
    /pg_isready -U ai_system_builder -d ai_system_builder_qualification/,
  );
  assert.match(workflow, /run: npm run test:postgres-live/);
  assert.match(workflow, /run: npm run test:postgres-recovery/);
  assert.match(
    workflow,
    /RECOVERY_POSTGRES_CONTAINER: \$\{\{ job\.services\.postgres\.id \}\}/,
  );
  assert.match(workflow, /name: postgres-recovery-evidence/);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /TEST_POSTGRES_SSL_MODE: disable/);
  assert.doesNotMatch(workflow, /TEST_POSTGRES_URL:\s*\$\{\{/);
});
