import {
  createOperationIdentity,
  isOperationIdentity,
  normalizeOperationIdentity,
  type OperationIdentity,
} from "../shared";

export type PersistenceOperation = OperationIdentity;

export function isPersistenceOperation(
  value: string,
): value is PersistenceOperation {
  return isOperationIdentity(value);
}

export function normalizePersistenceOperation(
  operation: string,
): PersistenceOperation {
  return normalizeOperationIdentity(operation);
}

export function createPersistenceOperation(
  firstSegment: string,
  secondSegment: string,
  ...remainingSegments: readonly string[]
): PersistenceOperation {
  return createOperationIdentity(firstSegment, secondSegment, ...remainingSegments);
}
