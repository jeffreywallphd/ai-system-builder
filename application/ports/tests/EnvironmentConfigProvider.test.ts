import { describe, expect, it } from "bun:test";
import { EnvironmentConfigProvider } from "../EnvironmentConfigProvider";

describe("EnvironmentConfigProvider", () => {
  it("normalizes keys and returns raw/string/number/boolean values", async () => {
    const provider = new EnvironmentConfigProvider({
      " app.port ": " 8080 ",
      "app.enabled": "YeS",
      "app.retries": 3,
      "app.flag": true,
      "app.null": null,
    });

    expect(await provider.get("app.port")).toBe(" 8080 ");
    expect(await provider.getString(" app.retries ")).toBe("3");
    expect(await provider.getString("app.flag")).toBe("true");
    expect(await provider.getNumber("app.port")).toBe(8080);
    expect(await provider.getBoolean("app.enabled")).toBeTrue();
    expect(await provider.getString("app.null")).toBeUndefined();
  });

  it("returns undefined for invalid coercions and missing keys", async () => {
    const provider = new EnvironmentConfigProvider({
      "app.badNumber": "abc",
      "app.obj": { key: "value" },
    });

    expect(await provider.getNumber("app.badNumber")).toBeUndefined();
    expect(await provider.getBoolean("app.badNumber")).toBeUndefined();
    expect(await provider.getString("app.obj")).toBeUndefined();
    expect(await provider.get("missing")).toBeUndefined();
  });

  it("requireString enforces existence and validity", async () => {
    const provider = new EnvironmentConfigProvider({ "app.name": "loom" });

    expect(await provider.requireString("app.name")).toBe("loom");
    expect(provider.requireString("missing")).rejects.toThrow("Required configuration value 'missing'");
  });

  it("supports has/getByPrefix and protects cloned values", async () => {
    const arr = ["a", "b"] as const;
    const obj = { x: "y" } as const;
    const provider = new EnvironmentConfigProvider({
      "app.arr": arr,
      "app.obj": obj,
      "app.value": 1,
      "other.value": 2,
    });

    expect(await provider.has("app.arr")).toBeTrue();
    expect(await provider.has("unknown")).toBeFalse();

    const grouped = await provider.getByPrefix("app");
    expect(Object.keys(grouped)).toEqual(["app.arr", "app.obj", "app.value"]);
    expect(Object.isFrozen(grouped)).toBeTrue();
    expect(Object.isFrozen(grouped["app.arr"] as object)).toBeTrue();
    expect(Object.isFrozen(grouped["app.obj"] as object)).toBeTrue();
  });

  it("supports immutable updates and environment loading", async () => {
    const initial = new EnvironmentConfigProvider({ "app.name": "loom" });
    const withValue = initial.withValue("app.mode", "dev");
    const withoutKey = withValue.withoutKey("app.name");
    const fromEnv = EnvironmentConfigProvider.fromEnv({ A: "1", B: undefined });

    expect(await initial.has("app.mode")).toBeFalse();
    expect(await withValue.getString("app.mode")).toBe("dev");
    expect(await withoutKey.has("app.name")).toBeFalse();
    expect(await fromEnv.has("A")).toBeTrue();
    expect(await fromEnv.has("B")).toBeFalse();
  });

  it("rejects empty keys", async () => {
    const provider = new EnvironmentConfigProvider();

    expect(() => new EnvironmentConfigProvider({ " ": "x" })).toThrow("Configuration key cannot be empty.");
    expect(provider.get(" ")).rejects.toThrow("Configuration key cannot be empty.");
    expect(provider.has(" ")).rejects.toThrow("Configuration key cannot be empty.");
  });
});
