import { describe, expect, it } from "bun:test";
import { EnvironmentConfig } from "../EnvironmentConfig";
import { EnvironmentConfigProvider } from "../EnvironmentConfigProvider";

describe("EnvironmentConfigProvider", () => {
  it("delegates typed reads to EnvironmentConfig", async () => {
    const provider = new EnvironmentConfigProvider(
      new EnvironmentConfig({ port: "7777", enabled: "true", name: "loom" })
    );

    expect(await provider.getString("name")).toBe("loom");
    expect(await provider.getNumber("port")).toBe(7777);
    expect(await provider.getBoolean("enabled")).toBe(true);
  });

  it("enforces required strings", async () => {
    const provider = new EnvironmentConfigProvider(new EnvironmentConfig({}));

    await expect(provider.requireString("missing")).rejects.toThrow(
      "Required configuration value 'missing' is missing or invalid."
    );
  });
});
