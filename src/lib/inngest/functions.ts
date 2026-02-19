import { inngest } from "./client";
import { db } from "@/lib/db";
import { IngestionStatus, ClaimStatus } from "@prisma/client";
import {
  fetchCourtListenerSettlements,
  scrapeTopClassActions,
  scrapeClassActionOrg,
  scrapeAllClaimsAdmins,
} from "@/lib/ingestion";
import { syncCompanyTransactions } from "@/lib/rutter/sync";
import { runMatchingForAllCompanies, runMatchingForCompany } from "@/lib/matching/engine";
import { sendPendingApprovalEmails } from "@/lib/approval/flow";
import { fileClaimAutomated } from "@/lib/filing";

// ─── Daily Settlement Ingestion ───────────────────────────────────
// Runs every day at 6 AM UTC. Pulls new settlements from all sources.

export const dailyIngestion = inngest.createFunction(
  {
    id: "daily-settlement-ingestion",
    name: "Daily Settlement Ingestion",
  },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    // Step 1: CourtListener API
    const clResult = await step.run("ingest-court-listener", async () => {
      const log = await db.ingestionLog.create({
        data: { source: "COURT_LISTENER", status: IngestionStatus.RUNNING },
      });

      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const result = await fetchCourtListenerSettlements(
          process.env.COURT_LISTENER_API_TOKEN!,
          yesterday,
        );

        await db.ingestionLog.update({
          where: { id: log.id },
          data: {
            status: IngestionStatus.COMPLETED,
            itemsFound: result.found,
            itemsNew: result.created,
            finishedAt: new Date(),
          },
        });

        return result;
      } catch (error) {
        await db.ingestionLog.update({
          where: { id: log.id },
          data: {
            status: IngestionStatus.FAILED,
            error: error instanceof Error ? error.message : "Unknown",
            finishedAt: new Date(),
          },
        });
        throw error;
      }
    });

    // Step 2: TopClassActions scrape
    const tcaResult = await step.run("scrape-top-class-actions", async () => {
      const log = await db.ingestionLog.create({
        data: { source: "TOP_CLASS_ACTIONS", status: IngestionStatus.RUNNING },
      });

      try {
        const result = await scrapeTopClassActions();

        await db.ingestionLog.update({
          where: { id: log.id },
          data: {
            status: IngestionStatus.COMPLETED,
            itemsFound: result.found,
            itemsNew: result.created,
            finishedAt: new Date(),
          },
        });

        return result;
      } catch (error) {
        await db.ingestionLog.update({
          where: { id: log.id },
          data: {
            status: IngestionStatus.FAILED,
            error: error instanceof Error ? error.message : "Unknown",
            finishedAt: new Date(),
          },
        });
        // Don't throw — continue with other sources
        return { found: 0, created: 0 };
      }
    });

    // Step 3: ClassAction.org scrape
    const caResult = await step.run("scrape-class-action-org", async () => {
      const log = await db.ingestionLog.create({
        data: { source: "CLASS_ACTION_ORG", status: IngestionStatus.RUNNING },
      });

      try {
        const result = await scrapeClassActionOrg();

        await db.ingestionLog.update({
          where: { id: log.id },
          data: {
            status: IngestionStatus.COMPLETED,
            itemsFound: result.found,
            itemsNew: result.created,
            finishedAt: new Date(),
          },
        });

        return result;
      } catch (error) {
        await db.ingestionLog.update({
          where: { id: log.id },
          data: {
            status: IngestionStatus.FAILED,
            error: error instanceof Error ? error.message : "Unknown",
            finishedAt: new Date(),
          },
        });
        return { found: 0, created: 0 };
      }
    });

    // Step 4: Claims admin portals
    const adminResults = await step.run("scrape-claims-admins", async () => {
      return scrapeAllClaimsAdmins();
    });

    return {
      courtListener: clResult,
      topClassActions: tcaResult,
      classActionOrg: caResult,
      claimsAdmins: adminResults,
    };
  },
);

// ─── Daily Matching Run ──────────────────────────────────────────
// Runs after ingestion. Matches all companies against new settlements.

export const dailyMatching = inngest.createFunction(
  {
    id: "daily-matching",
    name: "Daily Settlement Matching",
  },
  { cron: "0 8 * * *" }, // 2 hours after ingestion
  async ({ step }) => {
    const result = await step.run("run-matching", async () => {
      return runMatchingForAllCompanies();
    });

    // Send approval emails for any new matches
    if (result.totalClaims > 0) {
      await step.run("send-approval-emails", async () => {
        return sendPendingApprovalEmails();
      });
    }

    return result;
  },
);

// ─── New Company Onboarding ──────────────────────────────────────
// Triggered when a company connects their accounting software.

export const onCompanyConnected = inngest.createFunction(
  {
    id: "company-connected",
    name: "New Company Onboarding Sync",
  },
  { event: "company/connected" },
  async ({ event, step }) => {
    const { companyId } = event.data;

    // Step 1: Sync transactions from accounting software
    const syncResult = await step.run("sync-transactions", async () => {
      return syncCompanyTransactions(companyId);
    });

    // Step 2: Run matching immediately for this company
    const matchResult = await step.run("run-matching", async () => {
      return runMatchingForCompany(companyId);
    });

    // Step 3: Send approval emails if matches found
    if (matchResult.claimsCreated > 0) {
      await step.run("send-approval-emails", async () => {
        return sendPendingApprovalEmails();
      });
    }

    return { sync: syncResult, matches: matchResult };
  },
);

// ─── File Approved Claims ────────────────────────────────────────
// Triggered when a customer approves a claim via email link.

export const onClaimApproved = inngest.createFunction(
  {
    id: "claim-approved",
    name: "File Approved Claim",
  },
  { event: "claim/approved" },
  async ({ event, step }) => {
    const { claimId } = event.data;

    const claim = await step.run("get-claim-details", async () => {
      return db.claim.findUnique({
        where: { id: claimId },
        include: { settlement: true },
      });
    });

    if (!claim) return { error: "Claim not found" };

    // Attempt automated filing
    const result = await step.run("file-claim", async () => {
      return fileClaimAutomated(claimId, claim.settlement.claimsAdminName);
    });

    return result;
  },
);

// ─── Deadline Reminders ──────────────────────────────────────────
// Sends escalating reminders for pending approvals with approaching deadlines.

export const deadlineReminders = inngest.createFunction(
  {
    id: "deadline-reminders",
    name: "Claim Deadline Reminders",
  },
  { cron: "0 10 * * *" }, // Daily at 10 AM UTC
  async ({ step }) => {
    const pendingClaims = await step.run("find-pending-claims", async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      return db.claim.findMany({
        where: {
          status: ClaimStatus.PENDING_APPROVAL,
          settlement: {
            claimDeadline: {
              lte: sevenDaysFromNow,
              gt: new Date(),
            },
          },
        },
        include: {
          company: { include: { members: { where: { role: "ADMIN" } } } },
          settlement: true,
        },
      });
    });

    // Re-send approval emails for urgent claims
    let reminded = 0;
    for (const claim of pendingClaims) {
      await step.run(`remind-${claim.id}`, async () => {
        // The sendPendingApprovalEmails function handles re-sending
        // For now, log that we need to send a reminder
        console.log(
          `Deadline reminder: Claim ${claim.id} for ${claim.company.name} — deadline ${claim.settlement.claimDeadline}`,
        );
        reminded++;
      });
    }

    // Expire claims past their deadline
    await step.run("expire-claims", async () => {
      const result = await db.claim.updateMany({
        where: {
          status: ClaimStatus.PENDING_APPROVAL,
          settlement: {
            claimDeadline: { lt: new Date() },
          },
        },
        data: { status: ClaimStatus.EXPIRED },
      });

      return { expired: result.count };
    });

    return { reminded, total: pendingClaims.length };
  },
);

// ─── Periodic Transaction Sync ───────────────────────────────────
// Re-syncs transactions for all connected companies weekly.

export const weeklyTransactionSync = inngest.createFunction(
  {
    id: "weekly-transaction-sync",
    name: "Weekly Transaction Sync",
  },
  { cron: "0 4 * * 0" }, // Sundays at 4 AM UTC
  async ({ step }) => {
    const connections = await step.run("get-connections", async () => {
      return db.rutterConnection.findMany({
        where: { syncStatus: { not: "ERROR" } },
        select: { companyId: true },
      });
    });

    let synced = 0;
    let errors = 0;

    for (const conn of connections) {
      try {
        await step.run(`sync-${conn.companyId}`, async () => {
          return syncCompanyTransactions(conn.companyId);
        });
        synced++;
      } catch {
        errors++;
      }
    }

    return { synced, errors, total: connections.length };
  },
);
