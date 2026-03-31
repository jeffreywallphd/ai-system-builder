import { describe, expect, it } from "bun:test";
import {
  compareDataAssetVersions,
  isValidDataAssetVersion,
  parseDataAssetVersion,
} from "../DataAssetVersioning";

describe("DataAssetVersioning", () => {
  it("parses semantic versions and keeps comparability metadata", () => {
    const parsed = parseDataAssetVersion("v2.5.1");
    expect(parsed.scheme).toBe("semantic");
    expect(parsed.major).toBe(2);
    expect(parsed.minor).toBe(5);
    expect(parsed.patch).toBe(1);
    expect(parsed.comparable).toBeTrue();
  });

  it("supports label versions when explicitly allowed", () => {
    expect(isValidDataAssetVersion("v1", { allowLabel: true })).toBeTrue();
    expect(isValidDataAssetVersion("release-candidate", { allowLabel: true })).toBeTrue();
    expect(isValidDataAssetVersion("release-candidate")).toBeFalse();
  });

  it("compares semantic versions for latest resolution", () => {
    expect(compareDataAssetVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareDataAssetVersions("2.0.0", "1.10.0")).toBeGreaterThan(0);
    expect(compareDataAssetVersions(undefined, "1.0.0")).toBeLessThan(0);
  });
});
