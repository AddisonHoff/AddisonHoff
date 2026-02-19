import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { SettlementSource, SettlementStatus } from "@prisma/client";

/**
 * Scraper configurations for the major claims administrators.
 * Each admin has a portal listing active settlements.
 * These are the ~10 major admins that handle most class action settlements.
 */

interface AdminConfig {
  name: string;
  source: SettlementSource;
  listUrl: string;
  parseListPage: ($: cheerio.CheerioAPI) => Array<{
    title: string;
    url: string;
    deadline?: string;
  }>;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; SettlementClaimsBot/1.0; +https://yourapp.com/bot)";

const ADMIN_CONFIGS: AdminConfig[] = [
  {
    name: "Epiq",
    source: SettlementSource.EPIQ,
    listUrl: "https://www.epiqglobal.com/en-us/cases",
    parseListPage: ($) => {
      const results: Array<{ title: string; url: string; deadline?: string }> = [];
      $(".case-item, .views-row, tr").each((_, el) => {
        const $el = $(el);
        const title = $el.find("a, .case-title, td:first-child").first().text().trim();
        const href = $el.find("a").first().attr("href") || "";
        const deadline = $el.find(".deadline, td:nth-child(3)").text().trim();
        if (title && href) {
          results.push({
            title,
            url: href.startsWith("http")
              ? href
              : `https://www.epiqglobal.com${href}`,
            deadline: deadline || undefined,
          });
        }
      });
      return results;
    },
  },
  {
    name: "Rust Consulting",
    source: SettlementSource.RUST_CONSULTING,
    listUrl: "https://www.rustconsulting.com/cases",
    parseListPage: ($) => {
      const results: Array<{ title: string; url: string; deadline?: string }> = [];
      $(".case-listing, .views-row, article").each((_, el) => {
        const $el = $(el);
        const title = $el.find("h3, h2, a").first().text().trim();
        const href = $el.find("a").first().attr("href") || "";
        if (title && href) {
          results.push({
            title,
            url: href.startsWith("http")
              ? href
              : `https://www.rustconsulting.com${href}`,
          });
        }
      });
      return results;
    },
  },
  {
    name: "JND Legal Administration",
    source: SettlementSource.JND,
    listUrl: "https://www.jndla.com/cases",
    parseListPage: ($) => {
      const results: Array<{ title: string; url: string; deadline?: string }> = [];
      $(".case-item, .views-row, article").each((_, el) => {
        const $el = $(el);
        const title = $el.find("h3, h2, a, .title").first().text().trim();
        const href = $el.find("a").first().attr("href") || "";
        if (title && href) {
          results.push({
            title,
            url: href.startsWith("http") ? href : `https://www.jndla.com${href}`,
          });
        }
      });
      return results;
    },
  },
  {
    name: "Kroll",
    source: SettlementSource.KROLL,
    listUrl: "https://www.krollsettlementadministration.com/cases",
    parseListPage: ($) => {
      const results: Array<{ title: string; url: string; deadline?: string }> = [];
      $(".case-listing, article, .settlement-row").each((_, el) => {
        const $el = $(el);
        const title = $el.find("h3, h2, a, .case-name").first().text().trim();
        const href = $el.find("a").first().attr("href") || "";
        if (title && href) {
          results.push({
            title,
            url: href.startsWith("http")
              ? href
              : `https://www.krollsettlementadministration.com${href}`,
          });
        }
      });
      return results;
    },
  },
  {
    name: "Angeion Group",
    source: SettlementSource.ANGEION,
    listUrl: "https://www.angeiongroup.com/cases.php",
    parseListPage: ($) => {
      const results: Array<{ title: string; url: string; deadline?: string }> = [];
      $("table tr, .case-row, article").each((_, el) => {
        const $el = $(el);
        const title = $el.find("td:first-child a, h3 a, .case-name").first().text().trim();
        const href = $el.find("a").first().attr("href") || "";
        if (title && href) {
          results.push({
            title,
            url: href.startsWith("http")
              ? href
              : `https://www.angeiongroup.com/${href}`,
          });
        }
      });
      return results;
    },
  },
];

export async function scrapeAllClaimsAdmins(): Promise<{
  results: Array<{ admin: string; found: number; created: number; error?: string }>;
}> {
  const results = [];

  for (const config of ADMIN_CONFIGS) {
    try {
      const { found, created } = await scrapeAdmin(config);
      results.push({ admin: config.name, found, created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ admin: config.name, found: 0, created: 0, error: message });
    }
  }

  return { results };
}

async function scrapeAdmin(
  config: AdminConfig,
): Promise<{ found: number; created: number }> {
  const response = await fetch(config.listUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.name}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const listings = config.parseListPage($);

  let created = 0;
  for (const listing of listings) {
    const existing = await db.settlement.findFirst({
      where: {
        caseName: listing.title,
        source: config.source,
      },
    });

    if (!existing) {
      await db.settlement.create({
        data: {
          caseName: listing.title,
          source: config.source,
          sourceUrl: listing.url,
          claimsAdminName: config.name,
          claimsAdminUrl: config.listUrl,
          claimDeadline: listing.deadline
            ? safeParseDate(listing.deadline)
            : null,
          status: SettlementStatus.ACTIVE,
          defendants: { create: [] },
        },
      });
      created++;
    }
  }

  return { found: listings.length, created };
}

function safeParseDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
