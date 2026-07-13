import { NextResponse } from "next/server";

import { runAgentChat, type AgentChatMessage } from "@/lib/ai/agentChat";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  validateAttachmentPayload,
  type ChatAttachmentPayload,
} from "@/lib/ai/chatAttachments";
import { AiConfigError } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";

/**
 * Chat Agent AI.
 *   POST { messages: [{ role: "user"|"model", text, attachments? }] }
 *     -> { reply }
 * Client mengirim ulang seluruh riwayat tiap request; server stateless.
 * Kunci Gemini hanya ada di server (GEMINI_API_KEY).
 */

const MAX_MESSAGES = 30;
const MAX_MESSAGE_TEXT_LENGTH = 8_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

type MessagesValidation =
  | { ok: true; messages: AgentChatMessage[] }
  | { ok: false; error: string };

/** Validasi body untrusted -> daftar pesan yang aman dikirim ke Gemini. */
function validateMessages(raw: unknown): MessagesValidation {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "messages wajib berupa array berisi minimal satu pesan." };
  }
  if (raw.length > MAX_MESSAGES) {
    return { ok: false, error: `Riwayat terlalu panjang (maksimal ${MAX_MESSAGES} pesan).` };
  }

  const messages: AgentChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: "Format pesan tidak valid." };
    }
    const { role, text, attachments } = item as Record<string, unknown>;

    if (role !== "user" && role !== "model") {
      return { ok: false, error: "role pesan harus 'user' atau 'model'." };
    }
    if (typeof text !== "string" || text.length > MAX_MESSAGE_TEXT_LENGTH) {
      return { ok: false, error: "Teks pesan tidak valid atau terlalu panjang." };
    }

    const validAttachments: ChatAttachmentPayload[] = [];
    if (attachments !== undefined) {
      if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        return {
          ok: false,
          error: `Maksimal ${MAX_ATTACHMENTS_PER_MESSAGE} lampiran per pesan.`,
        };
      }
      for (const attachment of attachments) {
        const result = validateAttachmentPayload(attachment);
        if (!result.ok) return { ok: false, error: result.error };
        validAttachments.push(result.attachment);
      }
    }

    if (!text.trim() && validAttachments.length === 0) {
      return { ok: false, error: "Pesan kosong tidak bisa dikirim." };
    }
    messages.push({ role, text, attachments: validAttachments });
  }

  if (messages[messages.length - 1].role !== "user") {
    return { ok: false, error: "Pesan terakhir harus dari user." };
  }
  return { ok: true, messages };
}

export async function POST(req: Request) {
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("Body JSON tidak valid");
  }

  const validation = validateMessages(body.messages);
  if (!validation.ok) return badRequest(validation.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  try {
    const reply = await runAgentChat(validation.messages);
    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof AiConfigError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : "Gagal mendapatkan balasan AI";
    console.error("[agent-ai] request failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
