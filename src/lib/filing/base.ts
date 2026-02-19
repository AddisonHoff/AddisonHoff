import { chromium, Browser, Page } from "playwright";
import { db } from "@/lib/db";
import { ClaimStatus } from "@prisma/client";
import { sendClaimFiledEmail } from "@/lib/email/send";

export interface ClaimFormData {
  companyName: string;
  ein: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  contactEmail: string;
  vendorName: string;
  purchaseAmount: string;
  purchaseStartDate: string;
  purchaseEndDate: string;
}

/**
 * Base class for claims admin form automation.
 * Each admin portal gets a subclass implementing the specific form-filling logic.
 *
 * Short term: Semi-automated with human review before submission
 * Medium term: Fully automated per-admin Playwright scripts
 * Long term: Bulk CSV uploads for high-volume filer access
 */
export abstract class ClaimFiler {
  abstract adminName: string;
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });
    this.page = await this.browser.newPage();
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Navigate to claim form and fill it out.
   * Implemented by each admin-specific subclass.
   */
  abstract fillForm(formUrl: string, data: ClaimFormData): Promise<void>;

  /**
   * Submit the filled form.
   * Override if the admin has a non-standard submit process.
   */
  abstract submitForm(): Promise<{ confirmationNumber?: string }>;

  /**
   * Full filing pipeline for a claim.
   */
  async fileClaim(claimId: string): Promise<{
    success: boolean;
    confirmationNumber?: string;
    error?: string;
  }> {
    const claim = await db.claim.findUnique({
      where: { id: claimId },
      include: {
        company: { include: { members: { where: { role: "ADMIN" } } } },
        settlement: { include: { defendants: true } },
        match: true,
      },
    });

    if (!claim) return { success: false, error: "Claim not found" };
    if (claim.status !== ClaimStatus.APPROVED) {
      return { success: false, error: "Claim not approved" };
    }
    if (!claim.settlement.claimFormUrl) {
      return { success: false, error: "No claim form URL" };
    }

    // Mark as filing
    await db.claim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.FILING },
    });

    try {
      await this.init();

      const formData: ClaimFormData = {
        companyName: claim.company.name,
        ein: claim.company.ein || "",
        address: claim.company.address || "",
        city: claim.company.city || "",
        state: claim.company.state || "",
        zip: claim.company.zip || "",
        contactName: claim.company.members[0]?.email || "",
        contactEmail: claim.company.members[0]?.email || "",
        vendorName: claim.match?.vendorName || "",
        purchaseAmount: claim.match?.eligibleSpend
          ? Number(claim.match.eligibleSpend).toFixed(2)
          : "",
        purchaseStartDate: claim.settlement.eligibleStartDate
          ? claim.settlement.eligibleStartDate.toISOString().split("T")[0]
          : "",
        purchaseEndDate: claim.settlement.eligibleEndDate
          ? claim.settlement.eligibleEndDate.toISOString().split("T")[0]
          : "",
      };

      await this.fillForm(claim.settlement.claimFormUrl, formData);
      const result = await this.submitForm();

      // Mark as filed
      await db.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.FILED,
          filedAt: new Date(),
          notes: result.confirmationNumber
            ? `Confirmation: ${result.confirmationNumber}`
            : null,
        },
      });

      // Send notification email
      const adminEmail = claim.company.members[0]?.email;
      if (adminEmail) {
        await sendClaimFiledEmail({
          to: adminEmail,
          companyName: claim.company.name,
          caseName: claim.settlement.caseName,
          estimatedPayout: claim.match?.estimatedPayout || "Varies",
        });
      }

      return { success: true, confirmationNumber: result.confirmationNumber };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";

      // Revert to approved so it can be retried
      await db.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.APPROVED,
          notes: `Filing failed: ${msg}`,
        },
      });

      return { success: false, error: msg };
    } finally {
      await this.cleanup();
    }
  }
}
