import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const requireFromRoot = createRequire(path.resolve("package.json"));
const forgeConfig = requireFromRoot("./apps/desktop/forge.config.js") as {
  packagerConfig?: { ignore?: (file: string) => boolean };
};

test("desktop packaging includes only webpack output and excludes runtime data", () => {
  const ignored = forgeConfig.packagerConfig?.ignore;
  assert.equal(typeof ignored, "function");
  for (const path of ["/artifacts/runtime-data", "/dist/apps", "/out/package", "/.git/objects"]) {
    assert.equal(ignored?.(path), true, `${path} should be excluded from packaging`);
  }
  assert.equal(ignored?.("/apps/server/.local/server-runtime/model.bin"), true);
  assert.equal(ignored?.("/apps/desktop/src/main/index.ts"), true);
  assert.equal(ignored?.("/.webpack/main/index.js"), false);
  assert.equal(ignored?.("/.webpack/main/index.js.map"), true);
});
