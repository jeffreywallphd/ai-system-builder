import { describe, expect, it } from "bun:test";
import { FileTypeSignatureSniffer } from "../FileTypeSignatureSniffer";

describe("FileTypeSignatureSniffer", () => {
  it("wraps file-type detection for known binary signatures", async () => {
    const sniffer = new FileTypeSignatureSniffer();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await sniffer.sniff(png);

    expect(result?.extension).toBe(".png");
    expect(result?.mimeType).toBe("image/png");
    expect(result?.detector).toBe("file-type");
  });

  it("returns undefined when binary signature is not recognized", async () => {
    const sniffer = new FileTypeSignatureSniffer();
    const text = new TextEncoder().encode("not a known binary format");

    const result = await sniffer.sniff(text);

    expect(result).toBeUndefined();
  });
});
