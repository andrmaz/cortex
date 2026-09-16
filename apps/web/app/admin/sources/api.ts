import { createHash } from "node:crypto";
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

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

export function documentUploadIdempotencyKey(
  sourceId: string,
  file: Pick<File, "name" | "size">,
  bytes: Uint8Array,
): string {
  return createHash("sha256")
    .update(sourceId)
    .update("\0")
    .update(file.name)
    .update("\0")
    .update(String(file.size))
    .update("\0")
    .update(bytes)
    .digest("hex");
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
  idempotencyKey?: string,
): Promise<{ document?: UploadedDocument; error?: string }> {
  const body = new FormData();
  body.set("file", file);
  const headers = new Headers(await adminAuthHeaders());
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}/api/admin/sources/${encodeURIComponent(sourceId)}/documents`,
      {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        error:
          "Upload timed out before a response arrived. Retry the same file; the server will reuse the original document if it already exists.",
      };
    }
    throw error;
  }

  if (!res.ok) {
    const responseBody = await parseJsonSafe<{ message?: string }>(res);
    return {
      error: responseBody?.message ?? "Failed to upload document",
    };
  }

  return { document: (await res.json()) as UploadedDocument };
}
