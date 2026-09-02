import type { CSSProperties } from "react";
import Link from "next/link";
import type { AdminUser } from "./types";

interface UserTableProps {
  users: AdminUser[];
  organizationId: string;
  selectedUserId?: string;
}

export function UserTable({
  users,
  organizationId,
  selectedUserId,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <p style={{ color: "#6b7280", fontStyle: "italic" }}>
        No users in this organization yet.
      </p>
    );
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Email</th>
          <th style={thStyle}>Role</th>
          <th style={thStyle}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr
            key={user.id}
            style={
              user.id === selectedUserId ? { background: "#eff6ff" } : undefined
            }
          >
            <td style={tdStyle}>{user.email}</td>
            <td style={tdStyle}>{user.role}</td>
            <td style={tdStyle}>
              <Link
                href={`/admin/users?orgId=${organizationId}&userId=${user.id}`}
                style={linkBtnStyle}
              >
                {user.id === selectedUserId ? "Editing…" : "Assign departments"}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#f1f5f9",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#374151",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const linkBtnStyle: CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  color: "#2563eb",
  border: "1px solid #2563eb",
  borderRadius: "4px",
  fontSize: "13px",
  textDecoration: "none",
};
