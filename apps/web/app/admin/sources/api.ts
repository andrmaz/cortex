import { adminAuthHeaders } from "../_lib/admin-auth";
import type { Source, UploadedDocument } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchSources(): Promise<Source[]> {
  const res = await fetch(`${API_URL}/api/admin/sources`, {
    headers: await adminAuthHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sources: ${res.status}`);
  }

  return res.json() as Promise<Source[]>;
}

export async function createSource(
  name: string,
): Promise<{ source?: Source; error?: string }> {
  const res = await fetch(`${API_URL}/api/admin/sources`, {
    method: "POST",
    headers: {
      ...(await adminAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, type: "upload" }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    const body = await parseJsonSafe<{ message?: string }>(res);
    return { error: body?.message ?? "Failed to create source" };
  }

  return { source: (await res.json()) as Source };
}

export async function uploadSourceDocument(
  sourceId: string,
  file: File,
): Promise<{ document?: UploadedDocument; error?: string }> {
  const body = new FormData();
  body.set("file", file);

  const res = await fetch(
    `${API_URL}/api/admin/sources/${encodeURIComponent(sourceId)}/documents`,
    {
      method: "POST",
      headers: await adminAuthHeaders(),
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const responseBody = await parseJsonSafe<{ message?: string }>(res);
    return {
      error: responseBody?.message ?? "Failed to upload document",
    };
  }

  return { document: (await res.json()) as UploadedDocument };
}
