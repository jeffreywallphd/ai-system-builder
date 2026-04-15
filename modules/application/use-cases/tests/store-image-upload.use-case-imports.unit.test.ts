import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("StoreImageUploadUseCase dependency boundaries", () => {
  it("does not import IPC contract types into the application use case", () => {
    const useCasePath = fileURLToPath(
      new URL("../store-image-upload.use-case.ts", import.meta.url),
    );
    const source = readFileSync(useCasePath, "utf8");

    expect(source).not.toContain('from "../../contracts/ipc"');
  });
});
