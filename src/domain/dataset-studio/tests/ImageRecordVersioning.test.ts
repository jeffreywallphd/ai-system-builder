import { describe, expect, it } from "bun:test";
import {
  assessImageRecordVersionCompatibility,
  resolveImageRecordSchemaVersion,
} from "../contracts/ImageRecordVersioning";

describe("ImageRecordVersioning", () => {
  it("defaults missing schema versions to the minimum compatible media record version", () => {
    expect(resolveImageRecordSchemaVersion(undefined)).toBe("1.0.0");
    const compatibility = assessImageRecordVersionCompatibility(undefined);
    expect(compatibility.compatible).toBeTrue();
    expect(compatibility.reason).toBe("schema-version-missing");
  });

  it("accepts compatible semantic versions and rejects incompatible major upgrades", () => {
    expect(assessImageRecordVersionCompatibility("1.0.0").compatible).toBeTrue();
    expect(assessImageRecordVersionCompatibility("1.1.0").compatible).toBeTrue();

    const incompatible = assessImageRecordVersionCompatibility("2.0.0");
    expect(incompatible.compatible).toBeFalse();
    expect(incompatible.reason).toBe("schema-version-incompatible-major");
  });
});
