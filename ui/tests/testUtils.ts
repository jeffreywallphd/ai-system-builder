import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");
