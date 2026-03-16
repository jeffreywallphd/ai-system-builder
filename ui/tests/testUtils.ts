import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

export const expectPlaceholderModule = (relativePath: string): void => {
  expect(readSource(relativePath).trim()).toBe("");
};

export const importModule = async (relativePath: string): Promise<Record<string, unknown>> => {
  const moduleUrl = pathToFileURL(resolve(process.cwd(), relativePath)).href;
  return (await import(moduleUrl)) as Record<string, unknown>;
};
