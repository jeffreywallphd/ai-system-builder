import { describe, expect, it } from "bun:test";
import { EnvironmentConfig } from "../EnvironmentConfig";

describe("EnvironmentConfig", () => {
  it("reads typed values and supports immutable transforms", () => {
    const config = new EnvironmentConfig({
      ENABLED: "yes",
      TIMEOUT: "42",
      name: "loom",
      nested: { a: 1 },
      arr: ["x"],
    });

    expect(config.getBoolean("ENABLED")).toBe(true);
    expect(config.getNumber("TIMEOUT")).toBe(42);
    expect(config.getString("name")).toBe("loom");
    expect(config.has("name")).toBe(true);

    const next = config.withValue("name", "studio").withoutKey("TIMEOUT");
    expect(config.getString("name")).toBe("loom");
    expect(next.getString("name")).toBe("studio");
    expect(next.has("TIMEOUT")).toBe(false);
  });

  it("filters by prefix and constructs from env", () => {
    const config = EnvironmentConfig.fromEnv({
      "app.port": "3000",
      "app.mode": "dev",
      OTHER: undefined,
    });

    const grouped = config.getByPrefix("app");
    expect(grouped["app.port"]).toBe("3000");
    expect(grouped["app.mode"]).toBe("dev");
    expect(Object.isFrozen(grouped)).toBe(true);
  });
});
