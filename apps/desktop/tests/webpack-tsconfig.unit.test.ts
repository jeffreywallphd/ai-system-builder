import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "../../../modules/testing/node-test";

type DesktopWebpackTsConfig = {
  include?: string[];
};

function loadDesktopWebpackTsConfig(): DesktopWebpackTsConfig {
  const configPath = resolve("apps/desktop/tsconfig.webpack.json");
  const source = readFileSync(configPath, "utf8");
  return JSON.parse(source) as DesktopWebpackTsConfig;
}

describe("desktop webpack TypeScript config", () => {
  it("includes shared modules source files required by desktop host composition", () => {
    const config = loadDesktopWebpackTsConfig();
    const include = config.include ?? [];

    expect(include).toContain("../../modules/**/*.ts");
    expect(include).toContain("../../modules/**/*.tsx");
    expect(include).toContain("../../modules/**/*.d.ts");
  });
});
