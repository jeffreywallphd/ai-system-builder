import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import { LocalWorkspacePersistenceError, type LocalWorkspacePersistenceErrorCode } from "./localWorkspacePersistenceErrors";

export async function readJsonDocument<T>(filePath: string, fallback: T, readErrorCode: LocalWorkspacePersistenceErrorCode): Promise<T> {
  try {
    return cloneJson(JSON.parse(await readFile(filePath, "utf8")) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return cloneJson(fallback);
    }

    throw new LocalWorkspacePersistenceError(readErrorCode, { cause: error });
  }
}

export async function writeJsonDocument(filePath: string, value: unknown, writeErrorCode: LocalWorkspacePersistenceErrorCode): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(cloneJson(value), null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw new LocalWorkspacePersistenceError(writeErrorCode, { cause: error });
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
