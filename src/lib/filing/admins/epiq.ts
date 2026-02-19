import { ClaimFiler, ClaimFormData } from "../base";

/**
 * Epiq Global claims form automation.
 * Epiq (formerly Garden City Group / GCG) is the largest claims administrator.
 * Their forms typically follow a multi-step wizard pattern.
 */
export class EpiqFiler extends ClaimFiler {
  adminName = "Epiq";

  async fillForm(formUrl: string, data: ClaimFormData): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    await this.page.goto(formUrl, { waitUntil: "networkidle" });

    // Epiq forms vary by settlement but generally have these fields.
    // This is a template — each specific settlement may need adjustments.

    // Company information
    await this.tryFill(
      'input[name*="company"], input[name*="business"], input[name*="claimant"]',
      data.companyName,
    );

    await this.tryFill('input[name*="ein"], input[name*="tax"]', data.ein);

    await this.tryFill(
      'input[name*="address"], input[name*="street"]',
      data.address,
    );

    await this.tryFill('input[name*="city"]', data.city);

    await this.trySelect(
      'select[name*="state"]',
      data.state,
    );

    await this.tryFill('input[name*="zip"], input[name*="postal"]', data.zip);

    await this.tryFill(
      'input[name*="email"]',
      data.contactEmail,
    );

    // Purchase information
    await this.tryFill(
      'input[name*="amount"], input[name*="purchase"], input[name*="spend"]',
      data.purchaseAmount,
    );

    await this.tryFill(
      'input[name*="start_date"], input[name*="from_date"], input[name*="begin"]',
      data.purchaseStartDate,
    );

    await this.tryFill(
      'input[name*="end_date"], input[name*="to_date"]',
      data.purchaseEndDate,
    );
  }

  async submitForm(): Promise<{ confirmationNumber?: string }> {
    if (!this.page) throw new Error("Browser not initialized");

    // Look for submit button
    const submitButton = await this.page.$(
      'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("File Claim")',
    );

    if (!submitButton) {
      throw new Error("Submit button not found on Epiq form");
    }

    await submitButton.click();
    await this.page.waitForLoadState("networkidle");

    // Try to extract confirmation number from the confirmation page
    const confirmText = await this.page.textContent("body");
    const confirmMatch = confirmText?.match(
      /(?:confirmation|reference|claim)\s*(?:number|#|id)[:\s]*([A-Z0-9-]+)/i,
    );

    return {
      confirmationNumber: confirmMatch?.[1] || undefined,
    };
  }

  private async tryFill(selector: string, value: string): Promise<void> {
    if (!this.page || !value) return;
    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.fill(value);
      }
    } catch {
      // Field not found for this specific settlement form — skip
    }
  }

  private async trySelect(selector: string, value: string): Promise<void> {
    if (!this.page || !value) return;
    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.selectOption({ label: value });
      }
    } catch {
      // Try by value if label doesn't work
      try {
        const element = await this.page.$(selector);
        if (element) {
          await element.selectOption(value);
        }
      } catch {
        // Field not found or value not in options
      }
    }
  }
}
