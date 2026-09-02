import { ForbiddenException } from "@nestjs/common";

/**
 * Ensures an admin only accesses resources within their own organization.
 */
export function assertAdminOrganizationAccess(
  adminOrganizationId: string,
  requestedOrganizationId: string,
): void {
  if (adminOrganizationId !== requestedOrganizationId) {
    throw new ForbiddenException(
      "Admin cannot access resources outside their organization",
    );
  }
}
