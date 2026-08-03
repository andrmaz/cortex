import type { CSSProperties, ReactNode } from "react";
import { AdminAccessError, requireAdminAccess } from "./_lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireAdminAccess();
  } catch (err) {
    if (err instanceof AdminAccessError) {
      return (
        <div style={gateStyle}>
          <h1 style={{ margin: "0 0 8px", fontSize: "20px" }}>
            Admin access required
          </h1>
          <p style={{ margin: 0, color: "#6b7280" }}>{err.message}</p>
        </div>
      );
    }
    throw err;
  }

  return children;
}

const gateStyle: CSSProperties = {
  maxWidth: "480px",
  margin: "64px auto",
  padding: "24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
};
