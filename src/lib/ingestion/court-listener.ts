import { db } from "@/lib/db";
import { SettlementSource, SettlementStatus } from "@prisma/client";

const COURT_LISTENER_BASE = "https://www.courtlistener.com/api/rest/v4";

// Nature of suit codes relevant to B2B settlements
const NATURE_OF_SUIT_CODES = [
  "410", // Antitrust
  "480", // Consumer Credit
  "370", // Fraud
  "470", // RICO
];

interface CLOpinion {
  id: number;
  absolute_url: string;
  case_name: string;
  docket: {
    case_name: string;
    docket_number: string;
    court: string;
    nature_of_suit: string;
  };
  date_filed: string;
  plain_text: string;
  html_with_citations: string;
}

interface CLSearchResult {
  count: number;
  next: string | null;
  results: CLOpinion[];
}

export async function fetchCourtListenerSettlements(
  apiToken: string,
  sinceDate?: Date,
): Promise<{ found: number; created: number }> {
  const headers = {
    Authorization: `Token ${apiToken}`,
    "Content-Type": "application/json",
  };

  let totalFound = 0;
  let totalCreated = 0;

  for (const nosCode of NATURE_OF_SUIT_CODES) {
    const params = new URLSearchParams({
      type: "o", // opinions
      q: '"settlement" AND ("preliminary approval" OR "final approval")',
      nature_of_suit: nosCode,
      order_by: "dateFiled desc",
      page_size: "20",
    });

    if (sinceDate) {
      params.set(
        "filed_after",
        sinceDate.toISOString().split("T")[0],
      );
    }

    const url = `${COURT_LISTENER_BASE}/search/?${params}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(
        `CourtListener API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: CLSearchResult = await response.json();
    totalFound += data.results.length;

    for (const opinion of data.results) {
      const created = await upsertSettlementFromCL(opinion);
      if (created) totalCreated++;
    }
  }

  return { found: totalFound, created: totalCreated };
}

async function upsertSettlementFromCL(opinion: CLOpinion): Promise<boolean> {
  const caseName = opinion.docket?.case_name || opinion.case_name;
  const caseNumber = opinion.docket?.docket_number || null;

  // Check if we already have this settlement
  const existing = await db.settlement.findFirst({
    where: {
      caseName,
      source: SettlementSource.COURT_LISTENER,
    },
  });

  if (existing) return false;

  // Extract defendant names from the case name (basic heuristic: "Plaintiff v. Defendant")
  const defendants = extractDefendantsFromCaseName(caseName);

  // Parse dates from opinion text
  const dates = extractDatesFromText(
    opinion.plain_text || opinion.html_with_citations,
  );

  await db.settlement.create({
    data: {
      caseName,
      caseNumber,
      court: opinion.docket?.court,
      source: SettlementSource.COURT_LISTENER,
      sourceUrl: `https://www.courtlistener.com${opinion.absolute_url}`,
      claimDeadline: dates.claimDeadline,
      eligibleStartDate: dates.eligibleStart,
      eligibleEndDate: dates.eligibleEnd,
      settlementDate: opinion.date_filed
        ? new Date(opinion.date_filed)
        : null,
      status: dates.claimDeadline && dates.claimDeadline > new Date()
        ? SettlementStatus.ACTIVE
        : SettlementStatus.UPCOMING,
      rawData: {
        courtListenerId: opinion.id,
        natureOfSuit: opinion.docket?.nature_of_suit,
      },
      defendants: {
        create: defendants.map((name) => ({
          name,
          aliases: [],
        })),
      },
    },
  });

  return true;
}

function extractDefendantsFromCaseName(caseName: string): string[] {
  // Common patterns: "X v. Y", "X vs. Y", "In re: Y Settlement"
  const vMatch = caseName.match(/\s+v\.?\s+(.+?)(?:\s*$|\s*,)/i);
  if (vMatch) {
    return vMatch[1]
      .split(/\s*(?:,|and)\s*/i)
      .map((d) => d.trim())
      .filter(Boolean);
  }

  const inReMatch = caseName.match(/In re[:\s]+(.+?)(?:\s+Settlement|\s+Litigation|\s*$)/i);
  if (inReMatch) {
    return [inReMatch[1].trim()];
  }

  return [];
}

function extractDatesFromText(text: string): {
  claimDeadline: Date | null;
  eligibleStart: Date | null;
  eligibleEnd: Date | null;
} {
  if (!text) return { claimDeadline: null, eligibleStart: null, eligibleEnd: null };

  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi;

  // Look for claim deadline patterns
  const deadlineMatch = text.match(
    /(?:claim[s]?\s+(?:must be|deadline|due|filed|submitted).*?)(\w+ \d{1,2}, \d{4})/i,
  );

  // Look for eligible purchase period
  const periodMatch = text.match(
    /(?:between|from)\s+(\w+ \d{1,2}, \d{4})\s+(?:and|to|through)\s+(\w+ \d{1,2}, \d{4})/i,
  );

  return {
    claimDeadline: deadlineMatch ? safeParseDate(deadlineMatch[1]) : null,
    eligibleStart: periodMatch ? safeParseDate(periodMatch[1]) : null,
    eligibleEnd: periodMatch ? safeParseDate(periodMatch[2]) : null,
  };
}

function safeParseDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
