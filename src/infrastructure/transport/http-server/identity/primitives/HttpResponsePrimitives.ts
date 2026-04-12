import type { ServerResponse } from "node:http";

export function writeJsonResponse(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function writeNoContentResponse(response: ServerResponse, statusCode: number): void {
  response.statusCode = statusCode;
  response.end();
}

export async function writeResponseStream(
  response: ServerResponse,
  stream: AsyncIterable<Uint8Array>,
): Promise<void> {
  for await (const chunk of stream) {
    const encoded = Buffer.from(chunk);
    if (!response.write(encoded)) {
      await new Promise<void>((resolve) => response.once("drain", resolve));
    }
  }
  response.end();
}
