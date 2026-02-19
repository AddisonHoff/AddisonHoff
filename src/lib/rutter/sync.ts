import { db } from "@/lib/db";
import { createRutterClient } from "./client";
import { SyncStatus } from "@prisma/client";

/**
 * Normalize vendor names for consistent matching.
 * Strips common suffixes, normalizes whitespace, lowercases.
 */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]|'s$/g, "")
    .replace(
      /\b(inc|incorporated|corp|corporation|llc|llp|ltd|limited|co|company|group|holdings|enterprises|industries)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sync vendor transactions from Rutter into our database.
 * This is the core data pull that enables matching.
 */
export async function syncCompanyTransactions(companyId: string): Promise<{
  synced: number;
  errors: string[];
}> {
  const connection = await db.rutterConnection.findUnique({
    where: { companyId },
  });

  if (!connection) {
    throw new Error(`No Rutter connection for company ${companyId}`);
  }

  // Mark sync as in progress
  await db.rutterConnection.update({
    where: { id: connection.id },
    data: { syncStatus: SyncStatus.SYNCING },
  });

  const rutter = createRutterClient();
  const errors: string[] = [];
  let synced = 0;

  try {
    // Pull bills (these represent purchases from vendors — the key data for matching)
    const bills = await rutter.listAllBills(
      connection.accessToken,
      connection.lastSyncAt?.toISOString(),
    );

    for (const bill of bills) {
      try {
        const vendorName = bill.vendor_name || "Unknown Vendor";
        const normalized = normalizeVendorName(vendorName);

        await db.vendorTransaction.upsert({
          where: { rutterTxnId: bill.id },
          create: {
            companyId,
            vendorName,
            vendorNameNormalized: normalized,
            amount: bill.total_amount,
            currency: bill.currency_code || "USD",
            transactionDate: new Date(bill.issue_date),
            description: bill.line_items
              .map((li) => li.description)
              .filter(Boolean)
              .join("; "),
            rutterTxnId: bill.id,
          },
          update: {
            vendorName,
            vendorNameNormalized: normalized,
            amount: bill.total_amount,
            transactionDate: new Date(bill.issue_date),
          },
        });

        synced++;
      } catch (err) {
        errors.push(
          `Bill ${bill.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    // Update sync status
    await db.rutterConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
      },
    });
  } catch (err) {
    await db.rutterConnection.update({
      where: { id: connection.id },
      data: { syncStatus: SyncStatus.ERROR },
    });
    throw err;
  }

  return { synced, errors };
}

/**
 * Get aggregated spend per vendor for a company within a date range.
 * Used to calculate eligible spend for settlement matching.
 */
export async function getVendorSpendSummary(
  companyId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<
  Array<{
    vendorName: string;
    vendorNameNormalized: string;
    totalSpend: number;
    transactionCount: number;
    firstTransaction: Date;
    lastTransaction: Date;
  }>
> {
  const where: Record<string, unknown> = { companyId };
  if (startDate || endDate) {
    where.transactionDate = {};
    if (startDate) (where.transactionDate as Record<string, unknown>).gte = startDate;
    if (endDate) (where.transactionDate as Record<string, unknown>).lte = endDate;
  }

  const transactions = await db.vendorTransaction.groupBy({
    by: ["vendorName", "vendorNameNormalized"],
    where: where as any,
    _sum: { amount: true },
    _count: { id: true },
    _min: { transactionDate: true },
    _max: { transactionDate: true },
  });

  return transactions.map((t) => ({
    vendorName: t.vendorName,
    vendorNameNormalized: t.vendorNameNormalized,
    totalSpend: Number(t._sum.amount || 0),
    transactionCount: t._count.id,
    firstTransaction: t._min.transactionDate!,
    lastTransaction: t._max.transactionDate!,
  }));
}
