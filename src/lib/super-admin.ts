/**
 * Super admin system.
 *
 * varun.tyagi83@gmail.com is the permanently hardcoded super admin.
 * Super admins:
 *   - bypass all rate limits
 *   - bypass all subscription/tier checks
 *   - can grant exceptions to any user
 *   - cannot have their own role changed by anyone
 *
 * Regular ADMINs get elevated access based on the UserException table
 * (granted explicitly by the super admin).
 */

export const SUPER_ADMIN_EMAIL = "varun.tyagi83@gmail.com";

export function isSuperAdmin(email: string | null | undefined): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

/** Returns true if the request should bypass rate limiting. */
export function bypassesRateLimit(email: string | null | undefined): boolean {
  return isSuperAdmin(email);
}

/** Returns true if the user has unrestricted AI access (no tier checks). */
export function hasUnlimitedAI(
  email: string | null | undefined,
  exceptions: string[]   // list of feature strings from UserException
): boolean {
  return isSuperAdmin(email) || exceptions.includes("unlimited_ai");
}

/** Returns true if the user has unlimited scans. */
export function hasUnlimitedScans(
  email: string | null | undefined,
  exceptions: string[]
): boolean {
  return isSuperAdmin(email) || exceptions.includes("unlimited_scans");
}

/** Returns true if the user can use AI Deep Scan. Requires Pro tier or explicit exception. */
export function hasDeepScanAccess(
  email: string | null | undefined,
  tier: string | null | undefined,
  exceptions: string[]
): boolean {
  return (
    isSuperAdmin(email) ||
    tier === "PRO" ||
    exceptions.includes("deep_scan")
  );
}
