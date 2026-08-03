/**
 * Narrows an unknown thrown value to a Prisma unique-constraint error (P2002).
 * Avoids importing Prisma runtime types into the CommonJS API workspace.
 */
export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
