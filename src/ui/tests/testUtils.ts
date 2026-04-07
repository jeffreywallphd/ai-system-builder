import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

export const importModule = async (relativePath: string): Promise<Record<string, unknown>> => {
  const moduleUrl = pathToFileURL(resolve(process.cwd(), relativePath)).href;
  return import(moduleUrl);
};

export const expectPlaceholderModule = (relativePath: string): void => {
  const source = readSource(relativePath);

  if (source.trim() !== "") {
    throw new Error(`${relativePath} is expected to be blank placeholder content.`);
  }
};
