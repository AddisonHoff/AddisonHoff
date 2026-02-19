import { ClaimFiler } from "./base";
import { EpiqFiler } from "./admins/epiq";
import { GenericFiler } from "./admins/generic";

/**
 * Registry of claims admin filers.
 * As we build Playwright scripts for each admin, register them here.
 * Fallback to GenericFiler for unknown admins.
 */
const filerRegistry: Record<string, () => ClaimFiler> = {
  epiq: () => new EpiqFiler(),
  "garden city group": () => new EpiqFiler(), // GCG is now part of Epiq
  gcg: () => new EpiqFiler(),
  // Add more as we build them:
  // "rust consulting": () => new RustFiler(),
  // "jnd": () => new JndFiler(),
  // "kroll": () => new KrollFiler(),
  // "angeion": () => new AngeionFiler(),
};

/**
 * Get the appropriate filer for a given claims administrator.
 */
export function getFiler(adminName?: string | null): ClaimFiler {
  if (!adminName) return new GenericFiler();

  const normalized = adminName.toLowerCase().trim();
  const factory = filerRegistry[normalized];

  return factory ? factory() : new GenericFiler();
}

/**
 * File a claim using the appropriate admin-specific Playwright script.
 */
export async function fileClaimAutomated(
  claimId: string,
  adminName?: string | null,
): Promise<{
  success: boolean;
  confirmationNumber?: string;
  error?: string;
}> {
  const filer = getFiler(adminName);
  return filer.fileClaim(claimId);
}
