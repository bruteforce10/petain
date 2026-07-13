"use client";

import * as React from "react";
import { Paperclip, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BASE64_CHARS,
  resolveAttachmentMimeType,
  type ChatAttachmentPayload,
} from "@/lib/ai/chatAttachments";

/**
 * Composer chat: textarea auto-grow (Enter kirim, Shift+Enter baris baru),
 * tombol lampiran (gambar/txt/md/csv/json/pdf), chip lampiran bisa dihapus.
 */

const MAX_TEXTAREA_HEIGHT_PX = 160;

interface ChatComposerProps {
  isLoading: boolean;
  onSend: (text: string, attachments: ChatAttachmentPayload[]) => void;
  onError: (message: string) => void;
}

/** Baca File browser jadi base64 tanpa prefix data URL. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      if (!base64) reject(new Error(`Gagal membaca file ${file.name}.`));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function ChatComposer({ isLoading, onSend, onError }: ChatComposerProps) {
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<ChatAttachmentPayload[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    if (fileInputRef.current) fileInputRef.current.value = "";

    let next = attachments;
    for (const file of incoming) {
      if (next.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
        onError(`Maksimal ${MAX_ATTACHMENTS_PER_MESSAGE} lampiran per pesan.`);
        break;
      }
      const mimeType = resolveAttachmentMimeType(file.name, file.type);
      if (!mimeType) {
        onError(
          `Tipe file "${file.name}" tidak didukung. Gunakan gambar, txt, md, csv, json, atau pdf.`,
        );
        continue;
      }
      try {
        const data = await readFileAsBase64(file);
        if (data.length > MAX_ATTACHMENT_BASE64_CHARS) {
          onError(`File "${file.name}" terlalu besar (maksimal ±4 MB).`);
          continue;
        }
        next = [...next, { name: file.name, mimeType, data }];
      } catch (error) {
        onError(error instanceof Error ? error.message : `Gagal membaca file ${file.name}.`);
      }
    }
    setAttachments(next);
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, i) => i !== index));
  }

  function submit() {
    const trimmed = text.trim();
    if (isLoading || (!trimmed && attachments.length === 0)) return;
    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className="border-t border-border/70 p-3">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <span
              key={`${attachment.name}-${index}`}
              className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
            >
              {attachment.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau data URL, bukan asset
                <img
                  src={`data:${attachment.mimeType};base64,${attachment.data}`}
                  alt=""
                  className="size-6 rounded object-cover"
                />
              ) : (
                <Paperclip className="size-3.5" />
              )}
              <span className="max-w-40 truncate">{attachment.name}</span>
              <button
                type="button"
                aria-label={`Hapus lampiran ${attachment.name}`}
                className="rounded p-0.5 hover:bg-background"
                onClick={() => removeAttachment(index)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => handleFilesSelected(event.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tambah lampiran"
          disabled={isLoading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          placeholder="Tanya apa saja... (Enter untuk kirim)"
          className="max-h-40 flex-1 resize-none rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => setText(event.target.value)}
          onInput={resizeTextarea}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          aria-label="Kirim pesan"
          disabled={isLoading || (!text.trim() && attachments.length === 0)}
          onClick={submit}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
