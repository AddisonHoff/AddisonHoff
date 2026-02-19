import Fuse from "fuse.js";
import { normalizeVendorName } from "@/lib/rutter/sync";

export interface FuzzyMatchResult {
  vendorName: string;
  defendantName: string;
  score: number; // 0.0 (no match) to 1.0 (exact match)
  matchedAlias?: string;
}

/**
 * Fuzzy-match vendor names against settlement defendant names (and their aliases).
 * Uses Fuse.js for performant approximate string matching.
 */
export function fuzzyMatchVendors(
  vendorNames: string[],
  defendants: Array<{ name: string; aliases: string[]; parentCompany?: string | null }>,
  threshold: number = 0.7,
): FuzzyMatchResult[] {
  // Build the search corpus: each defendant name + all aliases
  const searchItems: Array<{
    defendantName: string;
    searchTerm: string;
    normalized: string;
  }> = [];

  for (const defendant of defendants) {
    const allNames = [
      defendant.name,
      ...defendant.aliases,
      ...(defendant.parentCompany ? [defendant.parentCompany] : []),
    ];

    for (const name of allNames) {
      searchItems.push({
        defendantName: defendant.name,
        searchTerm: name,
        normalized: normalizeVendorName(name),
      });
    }
  }

  const fuse = new Fuse(searchItems, {
    keys: ["normalized"],
    threshold: 1 - threshold, // Fuse uses 0 = perfect match, 1 = no match
    includeScore: true,
    minMatchCharLength: 3,
  });

  const matches: FuzzyMatchResult[] = [];

  for (const vendor of vendorNames) {
    const normalizedVendor = normalizeVendorName(vendor);
    const results = fuse.search(normalizedVendor);

    if (results.length > 0) {
      const best = results[0];
      const score = 1 - (best.score || 1); // Convert Fuse score to our 0-1 scale

      if (score >= threshold) {
        matches.push({
          vendorName: vendor,
          defendantName: best.item.defendantName,
          score,
          matchedAlias:
            best.item.searchTerm !== best.item.defendantName
              ? best.item.searchTerm
              : undefined,
        });
      }
    }
  }

  return matches;
}

/**
 * Quick exact-match check (after normalization).
 * Fast path before falling back to fuzzy matching.
 */
export function exactMatchVendors(
  vendorNames: string[],
  defendants: Array<{ name: string; aliases: string[]; parentCompany?: string | null }>,
): FuzzyMatchResult[] {
  const defendantLookup = new Map<string, string>();

  for (const defendant of defendants) {
    const allNames = [
      defendant.name,
      ...defendant.aliases,
      ...(defendant.parentCompany ? [defendant.parentCompany] : []),
    ];

    for (const name of allNames) {
      defendantLookup.set(normalizeVendorName(name), defendant.name);
    }
  }

  const matches: FuzzyMatchResult[] = [];

  for (const vendor of vendorNames) {
    const normalized = normalizeVendorName(vendor);
    const match = defendantLookup.get(normalized);

    if (match) {
      matches.push({
        vendorName: vendor,
        defendantName: match,
        score: 1.0,
      });
    }
  }

  return matches;
}
