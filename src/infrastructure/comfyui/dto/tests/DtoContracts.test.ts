import { describe, expect, it } from "bun:test";

describe("dto contracts", () => {
  it("defines stable keys for queue/history integration", () => {
    const queueResponse = { prompt_id: "p1" };
    const historyResponse = { p1: { status: { completed: true } } };
    expect(queueResponse.prompt_id).toBe("p1");
    expect(historyResponse.p1.status?.completed).toBe(true);
  });
});
