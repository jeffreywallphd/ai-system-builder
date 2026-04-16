import { describe, expect, it } from "vitest";

import {
  normalizeTransformExecutionSummary,
  normalizeTransformKind,
} from ".";

describe("transform contracts", () => {
  it("normalizes transform kind and stage vocabulary", () => {
    expect(normalizeTransformKind(" Parsing ")).toBe("parsing");
  });

  it("normalizes transform summaries with input/output artifact references", () => {
    const summary = normalizeTransformExecutionSummary({
      record: {
        specification: {
          id: " parse-json-lines ",
          kind: " parsing ",
          stage: " derivation ",
        },
        inputs: [{ key: " staging/raw/events.ndjson " }],
        outputs: [{ key: " derived/structured/events.parquet " }],
      },
      inputCount: 1,
      outputCount: 1,
    });

    expect(summary).toEqual({
      record: {
        id: undefined,
        specification: {
          id: "parse-json-lines",
          kind: "parsing",
          stage: "derivation",
          name: undefined,
          version: undefined,
        },
        inputs: [{ key: "staging/raw/events.ndjson", role: undefined }],
        outputs: [{ key: "derived/structured/events.parquet", role: undefined }],
        startedAt: undefined,
        completedAt: undefined,
      },
      inputCount: 1,
      outputCount: 1,
    });
  });
});
