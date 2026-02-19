import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { SettlementSource, SettlementStatus } from "@prisma/client";

const BASE_URL = "https://topclassactions.com";
const BUSINESS_LAWSUITS_URL = `${BASE_URL}/category/lawsuit-settlements/business-lawsuit-settlements/`;

interface ScrapedSettlement {
  title: string;
  url: string;
  description: string;
  deadline?: string;
}

export async function scrapeTopClassActions(): Promise<{
  found: number;
  created: number;
}> {
  const listings = await scrapeListingPage(BUSINESS_LAWSUITS_URL);

  let created = 0;
  for (const listing of listings) {
    const details = await scrapeDetailPage(listing.url);
    const wasCreated = await upsertSettlement(listing, details);
    if (wasCreated) created++;
  }

  return { found: listings.length, created };
}

async function scrapeListingPage(url: string): Promise<ScrapedSettlement[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SettlementClaimsBot/1.0; +https://yourapp.com/bot)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch TopClassActions: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const settlements: ScrapedSettlement[] = [];

  $("article.post, .settlement-item, .entry").each((_, el) => {
    const $el = $(el);
    const title =
      $el.find("h2 a, h3 a, .entry-title a").first().text().trim();
    const href =
      $el.find("h2 a, h3 a, .entry-title a").first().attr("href") || "";
    const description =
      $el.find(".entry-summary, .excerpt, p").first().text().trim();

    if (title && href) {
      settlements.push({
        title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        description,
      });
    }
  });

  return settlements;
}

interface SettlementDetail {
  defendants: string[];
  claimDeadline: Date | null;
  eligibleStartDate: Date | null;
  eligibleEndDate: Date | null;
  claimFormUrl: string | null;
  claimsAdminName: string | null;
  claimsAdminUrl: string | null;
  totalAmount: string | null;
  fullDescription: string;
}

async function scrapeDetailPage(url: string): Promise<SettlementDetail> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SettlementClaimsBot/1.0; +https://yourapp.com/bot)",
    },
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  const content = $(".entry-content, .post-content, article").first();
  const fullText = content.text();

  // Extract claim deadline
  const deadlineMatch = fullText.match(
    /(?:claim\s+deadline|deadline\s+(?:is|to file)|must\s+(?:be\s+)?(?:filed|submitted)\s+by)[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
  );

  // Extract eligible date range
  const dateRangeMatch = fullText.match(
    /(?:between|from)\s+(\w+\s+\d{1,2},?\s+\d{4})\s+(?:and|to|through)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
  );

  // Extract defendant names from bold text or specific patterns
  const defendants: string[] = [];
  content.find("strong, b").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text.match(
        /(?:Inc\.?|Corp\.?|LLC|Co\.?|Ltd\.?|Group|Company|Foods|Industries)/i,
      )
    ) {
      defendants.push(text);
    }
  });

  // Extract claim form URL
  const claimFormUrl =
    content
      .find('a[href*="claim"], a:contains("file a claim"), a:contains("claim form")')
      .first()
      .attr("href") || null;

  // Extract settlement amount
  const amountMatch = fullText.match(
    /\$(\d[\d,.]*)\s*(?:million|billion)/i,
  );

  return {
    defendants: [...new Set(defendants)],
    claimDeadline: deadlineMatch ? safeParseDate(deadlineMatch[1]) : null,
    eligibleStartDate: dateRangeMatch ? safeParseDate(dateRangeMatch[1]) : null,
    eligibleEndDate: dateRangeMatch ? safeParseDate(dateRangeMatch[2]) : null,
    claimFormUrl,
    claimsAdminName: null, // Would need more specific scraping patterns
    claimsAdminUrl: null,
    totalAmount: amountMatch ? amountMatch[0] : null,
    fullDescription: fullText.slice(0, 2000),
  };
}

async function upsertSettlement(
  listing: ScrapedSettlement,
  details: SettlementDetail,
): Promise<boolean> {
  // Check for existing
  const existing = await db.settlement.findFirst({
    where: {
      caseName: listing.title,
      source: SettlementSource.TOP_CLASS_ACTIONS,
    },
  });

  if (existing) {
    // Update deadline if we now have one
    if (details.claimDeadline && !existing.claimDeadline) {
      await db.settlement.update({
        where: { id: existing.id },
        data: { claimDeadline: details.claimDeadline },
      });
    }
    return false;
  }

  await db.settlement.create({
    data: {
      caseName: listing.title,
      source: SettlementSource.TOP_CLASS_ACTIONS,
      sourceUrl: listing.url,
      claimFormUrl: details.claimFormUrl,
      claimsAdminName: details.claimsAdminName,
      claimsAdminUrl: details.claimsAdminUrl,
      claimDeadline: details.claimDeadline,
      eligibleStartDate: details.eligibleStartDate,
      eligibleEndDate: details.eligibleEndDate,
      eligibleDescription: details.fullDescription,
      status:
        details.claimDeadline && details.claimDeadline > new Date()
          ? SettlementStatus.ACTIVE
          : SettlementStatus.UPCOMING,
      defendants: {
        create: details.defendants.map((name) => ({
          name,
          aliases: [],
        })),
      },
    },
  });

  return true;
}

function safeParseDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
