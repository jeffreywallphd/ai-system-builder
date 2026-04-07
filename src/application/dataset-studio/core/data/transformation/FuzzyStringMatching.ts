import levenshtein from "fast-levenshtein";

export interface FuzzyMatchResult {
  readonly distance: number;
  readonly maxLength: number;
  readonly confidence: number;
  readonly matched: boolean;
}

export function compareFuzzyStrings(left: string, right: string, maxDistance: number): FuzzyMatchResult {
  const distance = levenshtein.get(left, right);
  const maxLength = Math.max(left.length, right.length);
  const confidence = maxLength === 0
    ? 1
    : Math.max(0, 1 - (distance / maxLength));

  return Object.freeze({
    distance,
    maxLength,
    confidence,
    matched: distance <= maxDistance,
  });
}
