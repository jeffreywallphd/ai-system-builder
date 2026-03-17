import { describe, expect, it } from "bun:test";
import { PythonRuntimeError } from "../PythonRuntimeError";

describe("Python runtime client contracts", () => {
  it("exposes python runtime error metadata", () => {
    const error = new PythonRuntimeError("boom", { statusCode: 503, details: { endpoint: "/health" } });
    expect(error.name).toBe("PythonRuntimeError");
    expect(error.statusCode).toBe(503);
  });
});
