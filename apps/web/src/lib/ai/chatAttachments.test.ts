import { describe, expect, test } from "bun:test";

import {
  MAX_ATTACHMENT_BASE64_CHARS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  isTextAttachment,
  resolveAttachmentMimeType,
  validateAttachmentPayload,
} from "./chatAttachments";

describe("resolveAttachmentMimeType", () => {
  test("returns reported mime type when it is allowed", () => {
    expect(resolveAttachmentMimeType("foto.png", "image/png")).toBe("image/png");
    expect(resolveAttachmentMimeType("catatan.txt", "text/plain")).toBe("text/plain");
  });

  test("falls back to extension when browser reports empty type", () => {
    expect(resolveAttachmentMimeType("README.md", "")).toBe("text/markdown");
    expect(resolveAttachmentMimeType("data.csv", "")).toBe("text/csv");
  });

  test("extension matching is case-insensitive", () => {
    expect(resolveAttachmentMimeType("FOTO.PNG", "")).toBe("image/png");
  });

  test("rejects ppt and office files even with reported mime type", () => {
    expect(
      resolveAttachmentMimeType(
        "slide.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBeNull();
    expect(resolveAttachmentMimeType("slide.ppt", "application/vnd.ms-powerpoint")).toBeNull();
    expect(resolveAttachmentMimeType("laporan.docx", "")).toBeNull();
  });

  test("rejects unknown extensions without reported type", () => {
    expect(resolveAttachmentMimeType("misteri.xyz", "")).toBeNull();
    expect(resolveAttachmentMimeType("tanpa-ekstensi", "")).toBeNull();
  });
});

describe("isTextAttachment", () => {
  test("true for text-like mime types", () => {
    expect(isTextAttachment("text/plain")).toBe(true);
    expect(isTextAttachment("text/markdown")).toBe(true);
    expect(isTextAttachment("application/json")).toBe(true);
  });

  test("false for images and pdf", () => {
    expect(isTextAttachment("image/png")).toBe(false);
    expect(isTextAttachment("application/pdf")).toBe(false);
  });
});

describe("validateAttachmentPayload", () => {
  const valid = { name: "foto.png", mimeType: "image/png", data: "aGFsbG8=" };

  test("accepts a valid image attachment", () => {
    const result = validateAttachmentPayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attachment.mimeType).toBe("image/png");
    }
  });

  test("rejects disallowed mime types", () => {
    const result = validateAttachmentPayload({
      ...valid,
      name: "slide.pptx",
      mimeType: "application/vnd.ms-powerpoint",
    });
    expect(result.ok).toBe(false);
  });

  test("rejects oversized base64 data", () => {
    const result = validateAttachmentPayload({
      ...valid,
      data: "a".repeat(MAX_ATTACHMENT_BASE64_CHARS + 1),
    });
    expect(result.ok).toBe(false);
  });

  test("rejects payloads that are not objects or miss fields", () => {
    expect(validateAttachmentPayload(null).ok).toBe(false);
    expect(validateAttachmentPayload("string").ok).toBe(false);
    expect(validateAttachmentPayload({ ...valid, data: "" }).ok).toBe(false);
    expect(validateAttachmentPayload({ ...valid, name: "" }).ok).toBe(false);
  });

  test("exposes sane limits", () => {
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBeGreaterThan(0);
    expect(MAX_ATTACHMENT_BASE64_CHARS).toBeGreaterThan(1_000_000);
  });
});
