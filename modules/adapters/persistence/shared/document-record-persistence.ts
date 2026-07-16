import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import * as path from "node:path";

import { cloneStructuredJson, type StructuredDocumentStore } from "./structured-document-store";

export interface DocumentRecordPersistenceOptions {
  readonly rootDirectory: string;
  readonly documents?: StructuredDocumentStore;
}

export interface ReadDocumentRecordResult<T> {
  readonly found: boolean;
  readonly value: T;
}

export async function readDocumentRecord<T>(
  options: DocumentRecordPersistenceOptions,
  relativeFilePath: string,
  fallback: T,
): Promise<ReadDocumentRecordResult<T>> {
  const identity = resolveDocumentIdentity(relativeFilePath);
  if (options.documents) {
    const document = await options.documents.readDocument<T>(identity.namespace, identity.key);
    return document
      ? { found: true, value: cloneStructuredJson(document.value) }
      : { found: false, value: cloneStructuredJson(fallback) };
  }

  try {
    const source = await readFile(path.join(options.rootDirectory, relativeFilePath), "utf8");
    return { found: true, value: JSON.parse(source) as T };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { found: false, value: cloneStructuredJson(fallback) };
    }
    throw error;
  }
}

export async function writeDocumentRecord<T>(
  options: DocumentRecordPersistenceOptions,
  relativeFilePath: string,
  value: T,
): Promise<void> {
  const safeValue = cloneStructuredJson(value);
  const identity = resolveDocumentIdentity(relativeFilePath);
  if (options.documents) {
    await options.documents.writeDocument(identity.namespace, identity.key, safeValue);
    return;
  }

  const target = path.join(options.rootDirectory, relativeFilePath);
  const temporaryPath = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(safeValue, null, 2)}\n`, "utf8");
    await rename(temporaryPath, target);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export function resolveDocumentIdentity(relativeFilePath: string): { namespace: string; key: string } {
  const normalized = relativeFilePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("../") || normalized === "..") {
    throw new Error(`Structured document path is invalid: ${relativeFilePath}.`);
  }
  const separator = normalized.lastIndexOf("/");
  return separator < 0
    ? { namespace: "root", key: normalized }
    : { namespace: normalized.slice(0, separator), key: normalized.slice(separator + 1) };
}
