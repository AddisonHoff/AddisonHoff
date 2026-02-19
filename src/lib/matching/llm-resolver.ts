import OpenAI from "openai";

interface EntityResolutionResult {
  vendorName: string;
  defendantName: string;
  isMatch: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Use an LLM for entity resolution — determining whether a vendor name
 * from accounting software matches a defendant in a class action settlement.
 *
 * This handles cases fuzzy matching can't:
 * - Subsidiaries: "Hillshire Brands" is owned by "Tyson Foods"
 * - DBA names: "Galaxy Motors" operates as "Star Auto Group"
 * - Abbreviations: "P&G" = "Procter & Gamble"
 * - Merged entities: "Kraft Heinz" was formerly "Kraft Foods" and "H.J. Heinz"
 */
export async function llmEntityResolution(
  pairs: Array<{ vendorName: string; defendantName: string; aliases: string[] }>,
): Promise<EntityResolutionResult[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Batch pairs into groups to reduce API calls
  const batchSize = 10;
  const results: EntityResolutionResult[] = [];

  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const batchResults = await resolveBatch(openai, batch);
    results.push(...batchResults);
  }

  return results;
}

async function resolveBatch(
  openai: OpenAI,
  pairs: Array<{ vendorName: string; defendantName: string; aliases: string[] }>,
): Promise<EntityResolutionResult[]> {
  const pairDescriptions = pairs
    .map(
      (p, i) =>
        `${i + 1}. Vendor: "${p.vendorName}" → Defendant: "${p.defendantName}"${p.aliases.length > 0 ? ` (also known as: ${p.aliases.join(", ")})` : ""}`,
    )
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Small, fast, cheap — good enough for entity resolution
    messages: [
      {
        role: "system",
        content: `You are an entity resolution specialist. Your job is to determine whether a vendor name from a company's accounting software refers to the same entity as a defendant in a class action lawsuit.

Consider:
- Parent companies and subsidiaries
- Name variations, abbreviations, and DBA names
- Merged or acquired companies
- Common misspellings or data entry variations

For each pair, respond with a JSON object containing:
- "index": the pair number
- "isMatch": true/false
- "confidence": 0.0 to 1.0
- "reasoning": brief explanation

Respond with a JSON array of objects. Only valid JSON, no other text.`,
      },
      {
        role: "user",
        content: `Determine if these vendor names match these defendants:\n\n${pairDescriptions}`,
      },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    const results = parsed.results || parsed;

    if (!Array.isArray(results)) return [];

    return results.map((r: any, idx: number) => ({
      vendorName: pairs[r.index ? r.index - 1 : idx]?.vendorName || "",
      defendantName: pairs[r.index ? r.index - 1 : idx]?.defendantName || "",
      isMatch: Boolean(r.isMatch),
      confidence: Number(r.confidence) || 0,
      reasoning: String(r.reasoning || ""),
    }));
  } catch {
    return [];
  }
}

/**
 * For a single pair, do a quick LLM check.
 * Used for real-time verification of fuzzy match results.
 */
export async function llmVerifySingleMatch(
  vendorName: string,
  defendantName: string,
  aliases: string[],
): Promise<{ isMatch: boolean; confidence: number; reasoning: string }> {
  const results = await llmEntityResolution([
    { vendorName, defendantName, aliases },
  ]);

  if (results.length === 0) {
    return { isMatch: false, confidence: 0, reasoning: "LLM call failed" };
  }

  return results[0];
}
