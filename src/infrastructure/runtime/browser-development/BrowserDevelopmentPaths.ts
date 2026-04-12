import path from "node:path";
import { fileURLToPath } from "node:url";

const BROWSER_DEVELOPMENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

export const BROWSER_DEVELOPMENT_REPOSITORY_ROOT = path.resolve(
  BROWSER_DEVELOPMENT_DIRECTORY,
  "../../../..",
);
