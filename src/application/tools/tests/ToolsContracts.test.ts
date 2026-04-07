import { describe, expect, it } from "bun:test";
import { readSource } from "../../../ui/tests/testUtils";

describe("tools contracts", () => {
  it("defines tool use cases", () => {
    expect(readSource("application/tools/ListPublishedToolsUseCase.ts")).toContain("class ListPublishedToolsUseCase");
    expect(readSource("application/tools/LoadToolDefinitionUseCase.ts")).toContain("class LoadToolDefinitionUseCase");
    expect(readSource("application/tools/RunToolUseCase.ts")).toContain("class RunToolUseCase");
    expect(readSource("application/tools/ListToolCapabilitiesUseCase.ts")).toContain("class ListToolCapabilitiesUseCase");
    expect(readSource("application/tools/InvokeToolCapabilityUseCase.ts")).toContain("class InvokeToolCapabilityUseCase");
  });
});
