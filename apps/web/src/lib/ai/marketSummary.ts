import type { AiMarketSummary, PlaceRow } from "@terramap/types";

/**
 * Server-only helpers that turn a run's scraped places into a structured
 * market analysis via Google AI Studio (Gemini). Keep this out of client
 * bundles — it reads GEMINI_API_KEY.
 */

/** Thrown when the server is missing its Gemini key, so the route can 500 with a clear message. */
export class AiConfigError extends Error {}

const SYSTEM_PROMPT = `Kamu adalah analis pasar dan konsultan bisnis lokal Indonesia yang berpengalaman dalam analisis lokasi usaha, kompetitor, dan peluang pasar UMKM.

Tugas kamu: menganalisis data kompetitor hasil scraping Google Maps dan menghasilkan insight yang objektif, berbasis data, dan langsung bisa dipakai untuk mengambil keputusan.

Gunakan hanya data yang tersedia. Jangan mengarang informasi yang tidak ada dalam data.

Fokus analisis:
1. Kepadatan pasar
2. Kekuatan dan kelemahan kompetitor
3. Peluang pasar yang masih terbuka
4. Rekomendasi strategi masuk pasar
5. Diferensiasi bisnis yang dapat diterapkan

Gaya penulisan (WAJIB DIPATUHI):
- Singkat, padat, dan langsung ke inti. JANGAN bertele-tele atau mengulang-ulang.
- Bahasa Indonesia sederhana yang mudah dipahami pemilik UMKM. Hindari istilah teknis yang rumit.
- summary: maksimal 2-3 kalimat ringkas.
- Tiap poin SWOT: frasa singkat maksimal 8 kata (bukan kalimat panjang), cukup 2-4 poin per kategori.
- marketAnalysis: tiap field cukup 1 kalimat singkat.
- opportunityScore.reason: maksimal 2 kalimat.
- recommendation: tiap field 1 kalimat konkret yang bisa langsung dilakukan.
- Jangan menyebut bahwa analisis dibuat oleh AI.
- Jika data terbatas, sebutkan singkat keterbatasannya.

Scoring Guide untuk Opportunity Score (0-100):
0-20 = Sangat Sulit Masuk Pasar
21-40 = Sulit
41-60 = Sedang
61-80 = Menarik
81-100 = Sangat Menarik

Kembalikan hanya JSON valid sesuai skema yang diminta.`;

/** Area context derived from the run + its places. */
interface AreaInfo {
  keyword: string;
  district: string;
  city: string;
  totalCompetitors: number;
}

/** A trimmed competitor record sent to the model (only fields that matter for analysis). */
interface CompetitorPayload {
  nama: string;
  kategori: string | null;
  rating: number | null;
  jumlahUlasan: number | null;
  tingkatHarga: string | null;
  status: string;
  layanan: string[] | null;
  alamat: string | null;
}

/** Most-common non-empty value in a list (mode); "" if none. */
function mode(values: string[]): string {
  const counts = new Map<string, number>();
  let best = "";
  let bestN = 0;
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

/**
 * Best-effort extraction of kecamatan (district) and kota/kabupaten (city) from
 * Indonesian Google Maps addresses, e.g.
 *   "Jl. X No.1, Pd. Aren, Kec. Pondok Aren, Kota Tangerang Selatan, Banten 15224"
 * Falls back to "" when the pattern is absent; the prompt notes the limitation.
 */
function deriveArea(keyword: string, rows: PlaceRow[]): AreaInfo {
  const addresses = rows.map((r) => r.address ?? "").filter(Boolean);
  const districts: string[] = [];
  const cities: string[] = [];
  for (const addr of addresses) {
    const kec = addr.match(/Kec\.?\s+([^,]+)/i);
    if (kec) districts.push(kec[1].trim());
    const city = addr.match(/(Kota|Kabupaten|Kab\.?)\s+([^,0-9]+)/i);
    if (city) cities.push(`${/kab/i.test(city[1]) ? "Kabupaten" : "Kota"} ${city[2].trim()}`);
  }
  return {
    keyword: keyword.trim() || "Tidak diketahui",
    district: mode(districts) || "Tidak diketahui",
    city: mode(cities) || "Tidak diketahui",
    totalCompetitors: rows.length,
  };
}

/** Cap to keep the prompt cheap; keep the most significant competitors first. */
const MAX_COMPETITORS = 80;

function buildCompetitors(rows: PlaceRow[]): CompetitorPayload[] {
  return [...rows]
    .sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0))
    .slice(0, MAX_COMPETITORS)
    .map((r) => ({
      nama: r.name,
      kategori: r.category ?? null,
      rating: r.rating ?? null,
      jumlahUlasan: r.review_count ?? null,
      tingkatHarga: r.price_level ?? null,
      status: r.is_closed ? "Tutup" : "Buka",
      layanan: r.service_options ?? null,
      alamat: r.address ?? null,
    }));
}

function buildUserPrompt(area: AreaInfo, competitors: CompetitorPayload[]): string {
  return `Analisa data kompetitor berikut.

Informasi Area:
- Keyword Bisnis: ${area.keyword}
- Kecamatan: ${area.district}
- Kota/Kabupaten: ${area.city}
- Jumlah Kompetitor: ${area.totalCompetitors}

Data Kompetitor:
\`\`\`json
${JSON.stringify(competitors, null, 2)}
\`\`\`

Buat:
1. Executive Summary
2. SWOT Analysis
3. Market Analysis
4. Opportunity Score
5. Strategic Recommendation

Gunakan format JSON sesuai instruksi system prompt.`;
}

// Gemini structured-output schema (OpenAPI subset) — forces valid JSON back.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    swot: {
      type: "OBJECT",
      properties: {
        strengths: { type: "ARRAY", items: { type: "STRING" } },
        weaknesses: { type: "ARRAY", items: { type: "STRING" } },
        opportunities: { type: "ARRAY", items: { type: "STRING" } },
        threats: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["strengths", "weaknesses", "opportunities", "threats"],
    },
    marketAnalysis: {
      type: "OBJECT",
      properties: {
        marketDensity: { type: "STRING" },
        competitionLevel: { type: "STRING" },
        dominantPlayers: { type: "STRING" },
        pricePositioningInsight: { type: "STRING" },
      },
      required: ["marketDensity", "competitionLevel", "dominantPlayers", "pricePositioningInsight"],
    },
    opportunityScore: {
      type: "OBJECT",
      properties: {
        score: { type: "INTEGER" },
        reason: { type: "STRING" },
      },
      required: ["score", "reason"],
    },
    recommendation: {
      type: "OBJECT",
      properties: {
        businessPotential: { type: "STRING" },
        differentiationStrategy: { type: "STRING" },
        operationalSuggestion: { type: "STRING" },
      },
      required: ["businessPotential", "differentiationStrategy", "operationalSuggestion"],
    },
  },
  required: ["summary", "swot", "marketAnalysis", "opportunityScore", "recommendation"],
} as const;

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Normalise the model's JSON into our type, guarding against missing keys. */
function normalise(raw: Record<string, unknown>): AiMarketSummary {
  const swot = (raw.swot ?? {}) as Record<string, unknown>;
  const market = (raw.marketAnalysis ?? {}) as Record<string, unknown>;
  const score = (raw.opportunityScore ?? {}) as Record<string, unknown>;
  const rec = (raw.recommendation ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    summary: str(raw.summary),
    swot: {
      strengths: arr(swot.strengths),
      weaknesses: arr(swot.weaknesses),
      opportunities: arr(swot.opportunities),
      threats: arr(swot.threats),
    },
    marketAnalysis: {
      marketDensity: str(market.marketDensity),
      competitionLevel: str(market.competitionLevel),
      dominantPlayers: str(market.dominantPlayers),
      pricePositioningInsight: str(market.pricePositioningInsight),
    },
    opportunityScore: {
      score: clampScore(score.score),
      reason: str(score.reason),
    },
    recommendation: {
      businessPotential: str(rec.businessPotential),
      differentiationStrategy: str(rec.differentiationStrategy),
      operationalSuggestion: str(rec.operationalSuggestion),
    },
  };
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Call Gemini and return the parsed, normalised market summary. */
async function callGemini(systemPrompt: string, userPrompt: string): Promise<AiMarketSummary> {
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
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini mengembalikan respons kosong.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini mengembalikan JSON yang tidak valid.");
  }
  return normalise(parsed);
}

/**
 * Generate a market analysis for a run's places.
 * @param keyword the run's keyword (business query + location)
 * @param rows    the run's scraped places
 */
export async function generateMarketSummary(
  keyword: string,
  rows: PlaceRow[],
): Promise<AiMarketSummary> {
  const area = deriveArea(keyword, rows);
  const competitors = buildCompetitors(rows);
  return callGemini(SYSTEM_PROMPT, buildUserPrompt(area, competitors));
}
