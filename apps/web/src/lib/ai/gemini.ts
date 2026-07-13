/**
 * Klien REST Gemini bersama untuk fitur AI server-side (analisa pasar,
 * saran biaya HPP). Server-only — membaca GEMINI_API_KEY; jangan diimpor
 * dari kode client.
 */

/** Dilempar saat server belum punya Gemini key, agar route bisa 500 dengan pesan jelas. */
export class AiConfigError extends Error {}

/** Lampiran gambar inline (base64 tanpa prefix data URL). */
export interface GeminiImagePart {
  data: string;
  mimeType: string;
}

/** Satu giliran percakapan dalam format contents Gemini. */
export interface GeminiContent {
  role: "user" | "model";
  parts: Array<Record<string, unknown>>;
}

export interface CallGeminiJsonOptions {
  systemPrompt?: string;
  userPrompt: string;
  image?: GeminiImagePart | null;
  /** Skema structured-output Gemini (subset OpenAPI) — memaksa JSON valid. */
  responseSchema: Record<string, unknown>;
  temperature?: number;
}

export interface CallGeminiChatOptions {
  systemPrompt?: string;
  contents: GeminiContent[];
  temperature?: number;
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TEMPERATURE = 0.4;

interface GeminiRequest {
  systemPrompt?: string;
  contents: GeminiContent[];
  generationConfig: Record<string, unknown>;
}

/** Jalur request bersama: kirim ke Gemini, kembalikan teks kandidat pertama. */
async function requestGeminiText(request: GeminiRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiConfigError(
      "GEMINI_API_KEY belum diatur di server. Tambahkan key dari Google AI Studio ke .env.local.",
    );
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(request.systemPrompt
        ? { system_instruction: { parts: [{ text: request.systemPrompt }] } }
        : {}),
      contents: request.contents,
      generationConfig: request.generationConfig,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Permintaan diblokir oleh Gemini: ${data.promptFeedback.blockReason}`);
  }
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini mengembalikan respons kosong.");

  return text;
}

/** Panggil Gemini dan kembalikan JSON hasil parse (caller yang menormalisasi bentuknya). */
export async function callGeminiJson<T = Record<string, unknown>>(
  options: CallGeminiJsonOptions,
): Promise<T> {
  const parts: Array<Record<string, unknown>> = [{ text: options.userPrompt }];
  if (options.image?.data) {
    parts.push({
      inlineData: {
        data: options.image.data,
        mimeType: options.image.mimeType || "image/png",
      },
    });
  }

  const text = await requestGeminiText({
    systemPrompt: options.systemPrompt,
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
    },
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini mengembalikan JSON yang tidak valid.");
  }
}

/** Percakapan multi-turn dengan respons teks polos (dipakai chat Agent AI). */
export async function callGeminiChat(options: CallGeminiChatOptions): Promise<string> {
  return requestGeminiText({
    systemPrompt: options.systemPrompt,
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    },
  });
}
