import {
  StructuredDocumentConflictError,
  cloneStructuredJson,
  type StructuredDocument,
  type StructuredDocumentStore,
  type StructuredDocumentWriteOptions,
} from "./structured-document-store";

export function createInMemoryStructuredDocumentStore(
  now: () => string = () => new Date().toISOString(),
): StructuredDocumentStore {
  const state = new Map<string, StructuredDocument>();
  let transactionQueue: Promise<void> = Promise.resolve();

  const createStore = (target: Map<string, StructuredDocument>, insideTransaction: boolean): StructuredDocumentStore => ({
    async readDocument<T>(namespace: string, key: string) {
      const document = target.get(identity(namespace, key));
      return document ? cloneDocument<T>(document) : undefined;
    },
    async listNamespaces() {
      return [...new Set([...target.values()].map((document) => document.namespace))]
        .sort((left, right) => left.localeCompare(right));
    },
    async listDocuments<T>(namespace: string) {
      return [...target.values()]
        .filter((document) => document.namespace === namespace)
        .sort((left, right) => left.key.localeCompare(right.key))
        .map((document) => cloneDocument<T>(document));
    },
    async writeDocument<T>(namespace: string, key: string, value: T, options: StructuredDocumentWriteOptions = {}) {
      const mapKey = identity(namespace, key);
      const current = target.get(mapKey);
      if (options.expectedRevision !== undefined && current?.revision !== options.expectedRevision) {
        throw new StructuredDocumentConflictError(namespace, key, options.expectedRevision);
      }
      const document: StructuredDocument<T> = {
        namespace,
        key,
        value: cloneStructuredJson(value),
        revision: (current?.revision ?? 0) + 1,
        updatedAt: options.updatedAt ?? now(),
      };
      target.set(mapKey, document);
      return cloneDocument<T>(document);
    },
    async deleteDocument(namespace: string, key: string, expectedRevision?: number) {
      const mapKey = identity(namespace, key);
      const current = target.get(mapKey);
      if (expectedRevision !== undefined && current?.revision !== expectedRevision) {
        throw new StructuredDocumentConflictError(namespace, key, expectedRevision);
      }
      return target.delete(mapKey);
    },
    async runInTransaction<T>(work: (transaction: StructuredDocumentStore) => Promise<T>) {
      if (insideTransaction) return work(this);
      let release: () => void = () => undefined;
      const previous = transactionQueue;
      transactionQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const snapshot = new Map([...target.entries()].map(([key, value]) => [key, cloneDocument(value)]));
      try {
        const result = await work(createStore(snapshot, true));
        target.clear();
        for (const [key, value] of snapshot) target.set(key, value);
        return result;
      } finally {
        release();
      }
    },
  });

  return createStore(state, false);
}

function identity(namespace: string, key: string): string {
  return `${namespace}\u0000${key}`;
}

function cloneDocument<T>(document: StructuredDocument): StructuredDocument<T> {
  return {
    namespace: document.namespace,
    key: document.key,
    value: cloneStructuredJson(document.value) as T,
    revision: document.revision,
    updatedAt: document.updatedAt,
  };
}
