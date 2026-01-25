/**
 * Tokenizes a string into a set of lowercase alphanumeric words.
 */
function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return new Set(words);
}

/**
 * Calculates the Jaccard similarity between two strings based on word tokens.
 *
 * Jaccard Index: |intersection| / |union|
 *
 * @param text1 - First string to compare
 * @param text2 - Second string to compare
 * @returns A value between 0.0 (no overlap) and 1.0 (identical)
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);

  if (set1.size === 0 || set2.size === 0) {
    return 0;
  }

  const intersection = new Set([...set1].filter((word) => set2.has(word)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
