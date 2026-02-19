import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { SettlementSource, SettlementStatus } from "@prisma/client";

const BASE_URL = "https://www.classaction.org";
const SETTLEMENTS_URL = `${BASE_URL}/settlements/`;

interface ScrapedSettlement {
  title: string;
  url: string;
  description: string;
}

export async function scrapeClassActionOrg(): Promise<{
  found: number;
  created: number;
}> {
  const listings = await scrapeListingPage(SETTLEMENTS_URL);

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
    throw new Error(`Failed to fetch ClassAction.org: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const settlements: ScrapedSettlement[] = [];

  $(".settlement-item, article, .node--type-settlement").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h2 a, h3 a, .field--name-title a").first().text().trim();
    const href = $el.find("h2 a, h3 a, .field--name-title a").first().attr("href") || "";
    const description = $el.find(".field--name-body, .summary, p").first().text().trim();

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

  const content = $(".field--name-body, .entry-content, article").first();
  const fullText = content.text();

  const deadlineMatch = fullText.match(
    /(?:claim\s+deadline|deadline\s+(?:is|to file)|must\s+(?:be\s+)?(?:filed|submitted)\s+by)[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
  );

  const dateRangeMatch = fullText.match(
    /(?:between|from)\s+(\w+\s+\d{1,2},?\s+\d{4})\s+(?:and|to|through)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
  );

  const defendants: string[] = [];
  content.find("strong, b").each((_, el) => {
    const text = $(el).text().trim();
    if (text.match(/(?:Inc\.?|Corp\.?|LLC|Co\.?|Ltd\.?|Group|Company)/i)) {
      defendants.push(text);
    }
  });

  const claimFormUrl =
    content
      .find('a[href*="claim"], a:contains("file a claim")')
      .first()
      .attr("href") || null;

  const amountMatch = fullText.match(/\$(\d[\d,.]*)\s*(?:million|billion)/i);

  return {
    defendants: [...new Set(defendants)],
    claimDeadline: deadlineMatch ? safeParseDate(deadlineMatch[1]) : null,
    eligibleStartDate: dateRangeMatch ? safeParseDate(dateRangeMatch[1]) : null,
    eligibleEndDate: dateRangeMatch ? safeParseDate(dateRangeMatch[2]) : null,
    claimFormUrl,
    totalAmount: amountMatch ? amountMatch[0] : null,
    fullDescription: fullText.slice(0, 2000),
  };
}

async function upsertSettlement(
  listing: ScrapedSettlement,
  details: SettlementDetail,
): Promise<boolean> {
  const existing = await db.settlement.findFirst({
    where: {
      caseName: listing.title,
      source: SettlementSource.CLASS_ACTION_ORG,
    },
  });

  if (existing) return false;

  await db.settlement.create({
    data: {
      caseName: listing.title,
      source: SettlementSource.CLASS_ACTION_ORG,
      sourceUrl: listing.url,
      claimFormUrl: details.claimFormUrl,
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
