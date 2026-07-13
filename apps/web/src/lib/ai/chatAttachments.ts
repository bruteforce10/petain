/**
 * Aturan lampiran chat Agent AI — single source untuk client dan server.
 * Client-safe: tanpa import server-only. Gambar/PDF dikirim sebagai
 * inlineData Gemini; file teks di-decode server jadi text part.
 */

export interface ChatAttachmentPayload {
  name: string;
  /** Mime hasil resolveAttachmentMimeType (sudah tervalidasi). */
  mimeType: string;
  /** Base64 tanpa prefix data URL. */
  data: string;
}

export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
/** ~4,5 MB biner setelah decode — sama dengan batas /api/hpp-ai. */
export const MAX_ATTACHMENT_BASE64_CHARS = 6_000_000;
const MAX_ATTACHMENT_NAME_LENGTH = 200;

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const BINARY_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/** Fallback saat browser memberi file.type kosong (umum untuk .md/.csv). */
const EXTENSION_MIME_MAP: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

/** Nilai atribut accept pada input file di composer. */
export const ATTACHMENT_ACCEPT = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
].join(",");

export function isAllowedAttachmentType(mimeType: string): boolean {
  return TEXT_MIME_TYPES.has(mimeType) || BINARY_MIME_TYPES.has(mimeType);
}

/** Lampiran yang isinya teks (dikirim ke Gemini sebagai text part, bukan inlineData). */
export function isTextAttachment(mimeType: string): boolean {
  return TEXT_MIME_TYPES.has(mimeType);
}

/**
 * Tentukan mime lampiran dari tipe yang dilaporkan browser, fallback ke
 * ekstensi nama file. Null = tipe tidak didukung (ppt, doc, dll.).
 */
export function resolveAttachmentMimeType(
  fileName: string,
  reportedType: string,
): string | null {
  if (reportedType && isAllowedAttachmentType(reportedType)) return reportedType;

  const extension = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase()
    : "";
  return EXTENSION_MIME_MAP[extension] ?? null;
}

export type AttachmentValidation =
  | { ok: true; attachment: ChatAttachmentPayload }
  | { ok: false; error: string };

/** Validasi payload lampiran dari request (untrusted) di sisi server. */
export function validateAttachmentPayload(payload: unknown): AttachmentValidation {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Format lampiran tidak valid." };
  }

  const { name, mimeType, data } = payload as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.length > MAX_ATTACHMENT_NAME_LENGTH) {
    return { ok: false, error: "Nama file lampiran tidak valid." };
  }
  if (typeof mimeType !== "string" || !isAllowedAttachmentType(mimeType)) {
    return {
      ok: false,
      error: "Tipe file tidak didukung. Gunakan gambar, txt, md, csv, json, atau pdf.",
    };
  }
  if (typeof data !== "string" || !data) {
    return { ok: false, error: "Isi file lampiran kosong atau tidak valid." };
  }
  if (data.length > MAX_ATTACHMENT_BASE64_CHARS) {
    return { ok: false, error: "Ukuran file terlalu besar (maksimal ±4 MB)." };
  }

  return { ok: true, attachment: { name: name.trim(), mimeType, data } };
}
