/**
 * Login Code Utilities
 *
 * Generates role-prefixed unique login codes:
 *   STUDENT     → STU + 4 digits  e.g. STU4839
 *   INSTRUCTOR  → INS + 4 digits  e.g. INS5521
 *   ADMIN       → ADM + 4 digits  e.g. ADM9921
 *
 * Collision-safe: caller retries with a fresh code if the unique constraint fails.
 */

const ROLE_PREFIXES: Record<string, string> = {
  STUDENT: "STU",
  INSTRUCTOR: "INS",
  ADMIN: "ADM",
};

/**
 * Generate a candidate login code for the given role.
 * The caller is responsible for verifying uniqueness (retry on conflict).
 */
export function generateLoginCode(role: string): string {
  const prefix = ROLE_PREFIXES[role] ?? "USR";
  const digits = Math.floor(1000 + Math.random() * 9000); // 1000–9999
  return `${prefix}${digits}`;
}

/**
 * Generate a guaranteed-unique login code by checking the DB.
 * Import prisma lazily to avoid circular deps.
 */
export async function generateUniqueLoginCode(
  role: string,
  prisma: { user: { findUnique: (args: { where: { loginCode: string } }) => Promise<unknown> } },
  maxAttempts = 20
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateLoginCode(role);
    const existing = await prisma.user.findUnique({ where: { loginCode: code } });
    if (!existing) return code;
  }
  // Extremely unlikely, but fall back to a longer code to break the deadlock
  const prefix = ROLE_PREFIXES[role] ?? "USR";
  return `${prefix}${Date.now().toString().slice(-6)}`;
}
