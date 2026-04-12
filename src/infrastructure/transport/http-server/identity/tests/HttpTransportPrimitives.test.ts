import { describe, expect, it } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
  normalizeRequestContentType,
  parseJsonBody,
  resolveRequestUrl,
  toRequestBodyStream,
} from "../primitives/HttpRequestPrimitives";
import {
  writeJsonResponse,
  writeNoContentResponse,
  writeResponseStream,
} from "../primitives/HttpResponsePrimitives";
import {
  buildContentDispositionHeader,
  sanitizeDownloadFileName,
} from "../primitives/HttpFileResponsePrimitives";

class FakeServerResponse {
  public statusCode = 200;
  public headersSent = false;
  private readonly headers = new Map<string, string>();
  private readonly chunks: Buffer[] = [];

  public setHeader(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  public getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase());
  }

  public write(chunk: Uint8Array): boolean {
    this.chunks.push(Buffer.from(chunk));
    return true;
  }

  public end(chunk?: string): void {
    if (chunk) {
      this.chunks.push(Buffer.from(chunk));
    }
    this.headersSent = true;
  }

  public once(_event: string, listener: () => void): this {
    listener();
    return this;
  }

  public bodyText(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function asIncomingMessage(source: AsyncIterable<Uint8Array>): IncomingMessage {
  return source as unknown as IncomingMessage;
}

describe("HttpRequestPrimitives", () => {
  it("parses JSON body and enforces maximum payload size", async () => {
    const request = asIncomingMessage(Readable.from([Buffer.from(`{"ok":true}`)]));
    const parsed = await parseJsonBody(request, 1024);
    expect(parsed.ok).toBeTrue();
    if (parsed.ok) {
      expect(parsed.value).toEqual({ ok: true });
    }

    const oversized = asIncomingMessage(Readable.from([Buffer.from("12345")]));
    const oversizedParsed = await parseJsonBody(oversized, 4);
    expect(oversizedParsed).toEqual({
      ok: false,
      error: "Request body exceeds limit of 4 bytes.",
    });
  });

  it("streams request body chunks and normalizes URL/content-type helpers", async () => {
    const stream = toRequestBodyStream(asIncomingMessage(Readable.from([Buffer.from("a"), Buffer.from("b")])));
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk).toString("utf8"));
    }
    expect(chunks).toEqual(["a", "b"]);

    expect(normalizeRequestContentType(" application/json ")).toBe("application/json");
    expect(normalizeRequestContentType([" text/plain "])).toBe("text/plain");
    expect(resolveRequestUrl("://invalid").pathname).toBe("/");
  });
});

describe("HttpResponsePrimitives", () => {
  it("writes JSON, no-content, and streamed responses", async () => {
    const response = new FakeServerResponse();

    writeJsonResponse(response as unknown as ServerResponse, 201, { ok: true });
    expect(response.statusCode).toBe(201);
    expect(response.getHeader("content-type")).toBe("application/json; charset=utf-8");
    expect(response.bodyText()).toBe(`{"ok":true}`);

    const streamed = new FakeServerResponse();
    await writeResponseStream(
      streamed as unknown as ServerResponse,
      Readable.from([Buffer.from("chunk-1"), Buffer.from("chunk-2")]),
    );
    expect(streamed.bodyText()).toBe("chunk-1chunk-2");

    const noContent = new FakeServerResponse();
    writeNoContentResponse(noContent as unknown as ServerResponse, 204);
    expect(noContent.statusCode).toBe(204);
    expect(noContent.bodyText()).toBe("");
  });
});

describe("HttpFileResponsePrimitives", () => {
  it("sanitizes filenames and builds RFC-5987 content disposition values", () => {
    expect(sanitizeDownloadFileName(" ../../my\\file\"name.txt ")).toBe("..-..-my-file'name.txt");
    expect(sanitizeDownloadFileName("..")).toBeUndefined();

    const disposition = buildContentDispositionHeader("attachment", "hello world.txt");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename=\"hello world.txt\"");
    expect(disposition).toContain("filename*=UTF-8''hello%20world.txt");
  });
});
