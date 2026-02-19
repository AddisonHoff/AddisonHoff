import { db } from "@/lib/db";
import { MatchMethod, MatchStatus, ClaimStatus, SettlementStatus } from "@prisma/client";
import { exactMatchVendors, fuzzyMatchVendors } from "./fuzzy";
import { llmEntityResolution } from "./llm-resolver";
import { getVendorSpendSummary } from "@/lib/rutter/sync";

const FUZZY_THRESHOLD = 0.75;
const LLM_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Run the full matching pipeline for a single company against all active settlements.
 *
 * Pipeline:
 * 1. Exact match (normalized names)
 * 2. Fuzzy match (Fuse.js)
 * 3. LLM entity resolution for borderline fuzzy matches
 * 4. Create Match + Claim records for confirmed matches
 */
export async function runMatchingForCompany(companyId: string): Promise<{
  matchesFound: number;
  claimsCreated: number;
}> {
  // Get all active settlements with their defendants
  const settlements = await db.settlement.findMany({
    where: { status: SettlementStatus.ACTIVE },
    include: { defendants: true },
  });

  // Get company's vendor spend summary
  const vendorSpend = await getVendorSpendSummary(companyId);
  const vendorNames = vendorSpend.map((v) => v.vendorName);

  if (vendorNames.length === 0) {
    return { matchesFound: 0, claimsCreated: 0 };
  }

  let matchesFound = 0;
  let claimsCreated = 0;

  for (const settlement of settlements) {
    if (settlement.defendants.length === 0) continue;

    // Check if we already have a match for this company + settlement
    const existingMatch = await db.match.findUnique({
      where: {
        companyId_settlementId: {
          companyId,
          settlementId: settlement.id,
        },
      },
    });

    if (existingMatch) continue;

    const defendants = settlement.defendants.map((d) => ({
      name: d.name,
      aliases: d.aliases,
      parentCompany: d.parentCompany,
    }));

    // Step 1: Exact match
    const exactMatches = exactMatchVendors(vendorNames, defendants);
    if (exactMatches.length > 0) {
      const best = exactMatches[0];
      const spend = vendorSpend.find((v) => v.vendorName === best.vendorName);

      // Check date eligibility
      if (!isDateEligible(spend, settlement)) continue;

      await createMatchAndClaim(
        companyId,
        settlement.id,
        best.vendorName,
        best.defendantName,
        1.0,
        MatchMethod.EXACT,
        spend?.totalSpend,
      );
      matchesFound++;
      claimsCreated++;
      continue;
    }

    // Step 2: Fuzzy match
    const fuzzyMatches = fuzzyMatchVendors(vendorNames, defendants, FUZZY_THRESHOLD);

    if (fuzzyMatches.length === 0) continue;

    // Step 3: For fuzzy matches with score < 0.95, verify with LLM
    for (const match of fuzzyMatches) {
      const spend = vendorSpend.find((v) => v.vendorName === match.vendorName);

      if (!isDateEligible(spend, settlement)) continue;

      if (match.score >= 0.95) {
        // High confidence fuzzy match — treat as confirmed
        await createMatchAndClaim(
          companyId,
          settlement.id,
          match.vendorName,
          match.defendantName,
          match.score,
          MatchMethod.FUZZY,
          spend?.totalSpend,
        );
        matchesFound++;
        claimsCreated++;
      } else {
        // Borderline — send to LLM for verification
        const defendant = settlement.defendants.find(
          (d) => d.name === match.defendantName,
        );

        const llmResults = await llmEntityResolution([
          {
            vendorName: match.vendorName,
            defendantName: match.defendantName,
            aliases: defendant?.aliases || [],
          },
        ]);

        if (
          llmResults.length > 0 &&
          llmResults[0].isMatch &&
          llmResults[0].confidence >= LLM_CONFIDENCE_THRESHOLD
        ) {
          await createMatchAndClaim(
            companyId,
            settlement.id,
            match.vendorName,
            match.defendantName,
            llmResults[0].confidence,
            MatchMethod.LLM,
            spend?.totalSpend,
          );
          matchesFound++;
          claimsCreated++;
        }
      }
    }
  }

  return { matchesFound, claimsCreated };
}

/**
 * Run matching for ALL companies. Used by the daily cron job.
 */
export async function runMatchingForAllCompanies(): Promise<{
  companiesProcessed: number;
  totalMatches: number;
  totalClaims: number;
}> {
  const companies = await db.company.findMany({
    where: {
      rutterConnection: { syncStatus: "SYNCED" },
    },
    select: { id: true },
  });

  let totalMatches = 0;
  let totalClaims = 0;

  for (const company of companies) {
    try {
      const result = await runMatchingForCompany(company.id);
      totalMatches += result.matchesFound;
      totalClaims += result.claimsCreated;
    } catch (error) {
      console.error(`Matching failed for company ${company.id}:`, error);
    }
  }

  return {
    companiesProcessed: companies.length,
    totalMatches,
    totalClaims,
  };
}

function isDateEligible(
  spend: { firstTransaction: Date; lastTransaction: Date } | undefined,
  settlement: { eligibleStartDate: Date | null; eligibleEndDate: Date | null },
): boolean {
  if (!spend) return false;

  // If no eligible date range specified, assume eligible
  if (!settlement.eligibleStartDate && !settlement.eligibleEndDate) return true;

  // Check if any transactions fall within the eligible period
  if (
    settlement.eligibleStartDate &&
    spend.lastTransaction < settlement.eligibleStartDate
  ) {
    return false;
  }

  if (
    settlement.eligibleEndDate &&
    spend.firstTransaction > settlement.eligibleEndDate
  ) {
    return false;
  }

  return true;
}

async function createMatchAndClaim(
  companyId: string,
  settlementId: string,
  vendorName: string,
  defendantName: string,
  confidence: number,
  method: MatchMethod,
  eligibleSpend?: number,
): Promise<void> {
  const match = await db.match.create({
    data: {
      companyId,
      settlementId,
      vendorName,
      defendantName,
      confidence,
      matchMethod: method,
      eligibleSpend: eligibleSpend ?? null,
      status: MatchStatus.CONFIRMED,
    },
  });

  await db.claim.create({
    data: {
      companyId,
      settlementId,
      matchId: match.id,
      status: ClaimStatus.IDENTIFIED,
    },
  });
}
