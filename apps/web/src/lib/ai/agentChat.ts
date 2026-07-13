/**
 * Orkestrasi chat Agent AI: system prompt + mapping pesan ke format contents
 * Gemini. Server-only karena memanggil klien Gemini (GEMINI_API_KEY).
 */

import { isTextAttachment, type ChatAttachmentPayload } from "./chatAttachments";
import { callGeminiChat, type GeminiContent } from "./gemini";

export interface AgentChatMessage {
  role: "user" | "model";
  text: string;
  attachments?: ChatAttachmentPayload[];
}

const AGENT_SYSTEM_PROMPT = `Kamu adalah Agent AI Petain, asisten untuk pemilik usaha (UMKM) di Indonesia.
Petain membantu riset lokasi & analisa pasar dari data Google Maps serta perhitungan HPP.
Jawab dalam Bahasa Indonesia yang jelas dan ringkas. Jika user melampirkan gambar atau file,
analisa isinya dan kaitkan dengan pertanyaan. Jika tidak yakin, katakan tidak yakin.`;

/** Decode lampiran teks (base64) jadi text part berlabel nama file. */
function textAttachmentPart(attachment: ChatAttachmentPayload): { text: string } {
  const content = Buffer.from(attachment.data, "base64").toString("utf-8");
  return { text: `File: ${attachment.name}\n---\n${content}` };
}

/** Pure mapping pesan chat -> contents Gemini (diuji unit tanpa network). */
export function buildGeminiContents(messages: AgentChatMessage[]): GeminiContent[] {
  return messages.map((message) => {
    const attachmentParts = (message.attachments ?? []).map((attachment) =>
      isTextAttachment(attachment.mimeType)
        ? textAttachmentPart(attachment)
        : { inlineData: { data: attachment.data, mimeType: attachment.mimeType } },
    );

    return {
      role: message.role,
      parts: [
        ...(message.text ? [{ text: message.text }] : []),
        ...attachmentParts,
      ],
    };
  });
}

/** Kirim seluruh riwayat percakapan ke Gemini, kembalikan balasan teks. */
export async function runAgentChat(messages: AgentChatMessage[]): Promise<string> {
  return callGeminiChat({
    systemPrompt: AGENT_SYSTEM_PROMPT,
    contents: buildGeminiContents(messages),
  });
}
