import { describe, expect, it } from "bun:test";
import type { IFileStorage } from "../../../application/ports/interfaces/IFileStorage";
import { LocalFileStorage } from "../LocalFileStorage";

describe("filesystem contracts", () => {
  it("LocalFileStorage implements IFileStorage surface behavior", async () => {
    const storage: IFileStorage = new LocalFileStorage();
    expect(typeof storage.read).toBe("function");
    expect(typeof storage.write).toBe("function");
    expect(typeof storage.list).toBe("function");
  });
});
