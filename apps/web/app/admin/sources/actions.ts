"use server";

import { revalidatePath } from "next/cache";
import {
  createSource,
  documentUploadIdempotencyKey,
  fetchSources,
  uploadSourceDocument,
} from "./api";
import type { Source } from "./types";
import type { SourceStatusRefreshResult } from "./source-status-polling";

export interface SourceActionState {
  error?: string;
  message?: string;
}

export async function fetchSourcesAction(): Promise<
  SourceStatusRefreshResult<Source>
> {
  try {
    return { sources: await fetchSources() };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Failed to load sources",
    };
  }
}

function getStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createSourceAction(
  formData: FormData,
): Promise<SourceActionState> {
  const name = getStringField(formData, "name");
  if (!name) {
    return { error: "Source name is required" };
  }

  try {
    const result = await createSource(name);
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to create source. Please try again." };
  }

  revalidatePath("/admin/sources");
  return { message: "Source registered." };
}

export async function uploadDocumentAction(
  sourceId: string,
  formData: FormData,
): Promise<SourceActionState> {
  if (!sourceId) {
    return { error: "Select a source first" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a non-empty file" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const idempotencyKey = documentUploadIdempotencyKey(sourceId, file, bytes);

  try {
    const result = await uploadSourceDocument(sourceId, file, idempotencyKey);
    if (result.error) {
      return { error: result.error };
    }
    return {
      message: `Uploaded ${file.name}; ingestion job ${result.document?.jobId ?? "queued"}.`,
    };
  } catch {
    return { error: "Failed to upload document. Please try again." };
  }
}
