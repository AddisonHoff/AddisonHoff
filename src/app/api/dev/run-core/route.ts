import { NextResponse } from "next/server";
import { SettlementSource, SettlementStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { scrapeAllClaimsAdmins } from "@/lib/ingestion/claims-admin-scrapers";
import { runMatchingForCompany } from "@/lib/matching/engine";

const demoSettlements = [
  {
    caseName: "In re Google Ads B2B Purchaser Settlement",
    sourceUrl: "https://example.com/google-ads-settlement",
    defendant: "Google LLC",
  },
  {
    caseName: "In re Apple App Store Developer Antitrust Settlement",
    sourceUrl: "https://example.com/apple-app-store-settlement",
    defendant: "Apple Inc",
  },
  {
    caseName: "In re Microsoft Enterprise Licensing Settlement",
    sourceUrl: "https://example.com/microsoft-enterprise-settlement",
    defendant: "Microsoft Corporation",
  },
];

const demoVendors = ["Google LLC", "Apple Inc", "Microsoft Corporation", "Adobe Inc"];

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unable to resolve current user" }, { status: 401 });
    }

    let member = await db.companyMember.findFirst({
      where: { clerkUserId: userId },
      include: { company: true },
    });

    if (!member) {
      const company = await db.company.create({
        data: {
          name: "Demo Company",
          state: "CA",
          members: {
            create: {
              clerkUserId: userId,
              role: "ADMIN",
              email: "demo@claimscout.local",
            },
          },
        },
      });

      member = await db.companyMember.findFirst({
        where: { companyId: company.id, clerkUserId: userId },
        include: { company: true },
      });
    }

    if (!member) {
      return NextResponse.json({ error: "Failed to initialize demo company" }, { status: 500 });
    }

    const existingTxCount = await db.vendorTransaction.count({
      where: { companyId: member.company.id },
    });

    if (existingTxCount === 0) {
      await db.vendorTransaction.createMany({
        data: demoVendors.map((vendorName, idx) => ({
          companyId: member!.company.id,
          vendorName,
          vendorNameNormalized: vendorName.toLowerCase(),
          amount: 5000 + idx * 2500,
          transactionDate: new Date("2024-06-15"),
          description: "Demo seeded purchase",
          category: "Software",
        })),
      });
    }

    const scrape = await scrapeAllClaimsAdmins();

    const existingActiveSettlements = await db.settlement.count({
      where: { status: SettlementStatus.ACTIVE },
    });

    let fallbackSeeded = 0;
    if (existingActiveSettlements === 0) {
      for (const item of demoSettlements) {
        const existing = await db.settlement.findFirst({ where: { caseName: item.caseName } });
        if (existing) {
          continue;
        }

        await db.settlement.create({
          data: {
            caseName: item.caseName,
            source: SettlementSource.MANUAL,
            sourceUrl: item.sourceUrl,
            status: SettlementStatus.ACTIVE,
            defendants: {
              create: [
                {
                  name: item.defendant,
                  aliases: [],
                },
              ],
            },
          },
        });

        fallbackSeeded += 1;
      }
    }

    const matching = await runMatchingForCompany(member.company.id);

    return NextResponse.json({
      companyName: member.company.name,
      scrapeResults: scrape.results,
      fallbackSeeded,
      matching,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
