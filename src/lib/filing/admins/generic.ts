import { ClaimFiler, ClaimFormData } from "../base";

/**
 * Generic claims form filer.
 * Used as a fallback for claims admins without a specific Playwright script.
 * Attempts to fill common form fields by name/label heuristics.
 *
 * This won't work for every form, but covers the basics.
 * Failed submissions get flagged for manual handling.
 */
export class GenericFiler extends ClaimFiler {
  adminName = "Generic";

  private readonly fieldMappings: Array<{
    selectors: string[];
    dataKey: keyof ClaimFormData;
  }> = [
    {
      selectors: [
        'input[name*="company" i]',
        'input[name*="business" i]',
        'input[name*="claimant" i]',
        'input[name*="organization" i]',
        'input[label*="company" i]',
      ],
      dataKey: "companyName",
    },
    {
      selectors: [
        'input[name*="ein" i]',
        'input[name*="tax" i]',
        'input[name*="fein" i]',
      ],
      dataKey: "ein",
    },
    {
      selectors: [
        'input[name*="address" i]',
        'input[name*="street" i]',
        'input[name*="addr1" i]',
      ],
      dataKey: "address",
    },
    {
      selectors: ['input[name*="city" i]'],
      dataKey: "city",
    },
    {
      selectors: ['input[name*="zip" i]', 'input[name*="postal" i]'],
      dataKey: "zip",
    },
    {
      selectors: [
        'input[name*="email" i]',
        'input[type="email"]',
      ],
      dataKey: "contactEmail",
    },
    {
      selectors: [
        'input[name*="amount" i]',
        'input[name*="purchase" i]',
        'input[name*="spend" i]',
        'input[name*="total" i]',
      ],
      dataKey: "purchaseAmount",
    },
  ];

  async fillForm(formUrl: string, data: ClaimFormData): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    await this.page.goto(formUrl, { waitUntil: "networkidle" });

    for (const mapping of this.fieldMappings) {
      const value = data[mapping.dataKey];
      if (!value) continue;

      for (const selector of mapping.selectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.fill(value);
            break; // Found and filled, move to next field
          }
        } catch {
          continue;
        }
      }
    }

    // Handle state dropdown
    if (data.state) {
      for (const selector of [
        'select[name*="state" i]',
        'select[name*="province" i]',
      ]) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.selectOption({ label: data.state });
            break;
          }
        } catch {
          continue;
        }
      }
    }
  }

  async submitForm(): Promise<{ confirmationNumber?: string }> {
    if (!this.page) throw new Error("Browser not initialized");

    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("File")',
      'button:has-text("Send")',
      'a:has-text("Submit")',
    ];

    for (const selector of submitSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          await button.click();
          await this.page.waitForLoadState("networkidle");

          // Try to find confirmation number on result page
          const bodyText = await this.page.textContent("body");
          const confirmMatch = bodyText?.match(
            /(?:confirmation|reference|claim)\s*(?:number|#|id)[:\s]*([A-Z0-9-]+)/i,
          );

          return { confirmationNumber: confirmMatch?.[1] || undefined };
        }
      } catch {
        continue;
      }
    }

    throw new Error("Could not find submit button on form");
  }
}
