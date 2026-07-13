import { formatInputNumber } from "@/lib/hpp/format";
import type {
  AiCostSuggestions,
  AiPriceRecommendations,
  CalculationMode,
  FixedCostItem,
  ProductImagePayload,
  VariableCostItem,
} from "@/lib/hpp/types";
import { callGeminiJson } from "./gemini";

/**
 * Saran AI untuk kalkulator HPP: estimasi komponen biaya (bahan + biaya
 * tetap) dan rekomendasi harga jual. Server-only — dipakai route
 * /api/hpp-ai; port dari kalkulator-hpp/src/lib/gemini.js dengan
 * structured output (responseSchema) sebagai pengganti regex-extract JSON.
 */

const SATUAN_VALID = "g, kg, ml, L, pcs, buah, lembar";

// ---------------------------------------------------------------------------
// Saran komponen biaya (variable + fixed)
// ---------------------------------------------------------------------------

const COSTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    variableCosts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          usageAmount: { type: "NUMBER" },
          usageUnit: { type: "STRING" },
          purchasePrice: { type: "NUMBER" },
          purchaseQuantity: { type: "NUMBER" },
          purchaseUnit: { type: "STRING" },
        },
        required: [
          "name",
          "usageAmount",
          "usageUnit",
          "purchasePrice",
          "purchaseQuantity",
          "purchaseUnit",
        ],
      },
    },
    fixedCosts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          totalCost: { type: "NUMBER" },
        },
        required: ["name", "totalCost"],
      },
    },
  },
  required: ["variableCosts", "fixedCosts"],
};

export interface CostSuggestionInput {
  productName: string;
  productCategory?: string;
  calculationMode: CalculationMode;
  batchSize: number;
  image?: ProductImagePayload | null;
}

function buildCostsPrompt(input: CostSuggestionInput): string {
  const categoryInfo = input.productCategory ? `Kategori: ${input.productCategory}. ` : "";
  const isBatch = input.calculationMode === "perBatch" && input.batchSize > 0;

  const imageInstruction = input.image
    ? "\nGambar produk terlampir. Gunakan detail visual tersebut untuk memahami bahan atau gaya penyajian produk."
    : "";

  const modeInstruction = isBatch
    ? `\nMODE PERHITUNGAN: Per Resep (Batch)\n- usageAmount adalah jumlah bahan yang digunakan untuk membuat 1 RESEP/BATCH (bukan per produk)\n- 1 resep/batch menghasilkan ${input.batchSize} produk\n- Hitung total bahan untuk 1 batch penuh, bukan per produk`
    : `\nMODE PERHITUNGAN: Per Pcs (Satuan)\n- usageAmount adalah jumlah bahan yang digunakan untuk membuat 1 PRODUK (satuan)`;

  return `Sebagai ahli bisnis makanan dan minuman di Indonesia, analisis produk "${input.productName}" secara menyeluruh dan berikan:

1. DAFTAR BAHAN-BAHAN (variableCosts) yang diperlukan${isBatch ? " untuk membuat 1 resep/batch" : " untuk membuat 1 unit produk"}
2. DAFTAR BIAYA TETAP (fixedCosts) yang biasanya diperlukan untuk menjalankan bisnis produk tersebut per bulan

${categoryInfo}${imageInstruction}${modeInstruction}

Aturan untuk variableCosts:
- Berikan 3-8 bahan utama yang biasanya digunakan
- usageAmount: ${
    isBatch
      ? `jumlah bahan untuk 1 RESEP/BATCH (total untuk membuat ${input.batchSize} produk sekaligus)`
      : "jumlah bahan per 1 PRODUK (satuan)"
  }
- usageUnit dan purchaseUnit: pilih salah satu dari ${SATUAN_VALID}, dan keduanya harus kompatibel (sama kategori: berat, volume, atau jumlah)
- purchasePrice: total harga pembelian bahan dalam Rupiah Indonesia
- purchaseQuantity: jumlah yang dibeli
- Gunakan satuan dan harga yang realistis untuk pasar Indonesia

Aturan untuk fixedCosts:
- Berikan 3-8 biaya tetap utama (seperti: sewa tempat, gaji karyawan, listrik, internet, dll)
- totalCost: estimasi biaya per bulan dalam Rupiah Indonesia, realistis untuk UMKM

Gunakan nama bahan/biaya dalam bahasa Indonesia.`;
}

/** Normalisasi angka AI menjadi string terformat id-ID seperti isian form. */
function toInputNumber(value: unknown): string {
  const num = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(num) || num === 0) return "";
  return formatInputNumber(Math.abs(num));
}

interface RawCostsResponse {
  variableCosts?: Array<Record<string, unknown>>;
  fixedCosts?: Array<Record<string, unknown>>;
}

function normaliseVariableCosts(raw: RawCostsResponse["variableCosts"]): VariableCostItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: String(item.name || "").trim(),
      usageAmount: toInputNumber(item.usageAmount),
      usageUnit: String(item.usageUnit || "").trim(),
      purchasePrice: toInputNumber(item.purchasePrice),
      purchaseQuantity: toInputNumber(item.purchaseQuantity),
      purchaseUnit: String(item.purchaseUnit || "").trim(),
    }))
    .filter(
      (item) =>
        item.name &&
        item.usageAmount &&
        item.usageUnit &&
        item.purchasePrice &&
        item.purchaseQuantity &&
        item.purchaseUnit,
    );
}

function normaliseFixedCosts(raw: RawCostsResponse["fixedCosts"]): FixedCostItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: String(item.name || "").trim(),
      totalCost: toInputNumber(item.totalCost),
      allocationPerUnit: "",
    }))
    .filter((item) => item.name && item.totalCost);
}

/** Minta AI mengisi komponen biaya variabel + tetap untuk sebuah produk. */
export async function suggestAllCosts(input: CostSuggestionInput): Promise<AiCostSuggestions> {
  const raw = await callGeminiJson<RawCostsResponse>({
    userPrompt: buildCostsPrompt(input),
    image: input.image ?? null,
    responseSchema: COSTS_RESPONSE_SCHEMA,
  });

  const variableCosts = normaliseVariableCosts(raw.variableCosts);
  const fixedCosts = normaliseFixedCosts(raw.fixedCosts);

  if (variableCosts.length === 0 && fixedCosts.length === 0) {
    throw new Error("Tidak ada data valid yang ditemukan dari AI.");
  }

  return {
    variableCosts: variableCosts.length > 0 ? variableCosts : null,
    fixedCosts: fixedCosts.length > 0 ? fixedCosts : null,
  };
}

// ---------------------------------------------------------------------------
// Rekomendasi harga jual
// ---------------------------------------------------------------------------

const PRICE_LEVEL_SCHEMA = {
  type: "OBJECT",
  properties: {
    price: { type: "NUMBER" },
    margin: { type: "NUMBER" },
    explanation: { type: "STRING" },
  },
  required: ["price", "margin", "explanation"],
} as const;

const PRICE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    competitive: PRICE_LEVEL_SCHEMA,
    standard: PRICE_LEVEL_SCHEMA,
    premium: PRICE_LEVEL_SCHEMA,
  },
  required: ["competitive", "standard", "premium"],
};

export interface PriceSuggestionInput {
  productName: string;
  productCategory?: string;
  hpp: number;
  variableCostPerUnit: number;
  totalFixedCostPerMonth: number;
  targetSales: number;
  image?: ProductImagePayload | null;
}

function buildPricePrompt(input: PriceSuggestionInput): string {
  const categoryInfo = input.productCategory ? `Kategori: ${input.productCategory}. ` : "";
  const imageInstruction = input.image
    ? "\nGambar produk terlampir. Gunakan detail visual tersebut untuk menilai positioning harga."
    : "";

  return `Sebagai konsultan bisnis makanan dan minuman di Indonesia, analisis produk "${input.productName}" dan berikan rekomendasi harga jual yang strategis.

${categoryInfo}${imageInstruction}
Data Produk:
- HPP (Harga Pokok Produksi): Rp ${input.hpp.toLocaleString("id-ID")}
- Biaya Variabel per Unit: Rp ${input.variableCostPerUnit.toLocaleString("id-ID")}
- Total Biaya Tetap per Bulan: Rp ${input.totalFixedCostPerMonth.toLocaleString("id-ID")}
- Target Penjualan per Bulan: ${input.targetSales.toLocaleString("id-ID")} unit

Berikan rekomendasi harga jual dengan 3 level strategi:
1. competitive: margin 20-40%, fokus volume penjualan tinggi
2. standard: margin 50-70%, keseimbangan profitabilitas dan daya saing
3. premium: margin 70-100%, positioning premium dengan fokus kualitas

Aturan:
- price: harga jual dalam Rupiah Indonesia (angka bulat)
- margin: persentase (angka saja)
- explanation: bahasa Indonesia, singkat dan jelas (maksimal 100 karakter)`;
}

interface RawPriceLevel {
  price?: unknown;
  margin?: unknown;
  explanation?: unknown;
}

function normalisePriceLevel(raw: RawPriceLevel | undefined) {
  return {
    price: Math.round(parseFloat(String(raw?.price ?? 0)) || 0),
    margin: Math.round(parseFloat(String(raw?.margin ?? 0)) || 0),
    explanation: String(raw?.explanation ?? "").trim(),
  };
}

/** Minta AI memberi rekomendasi harga jual 3 level berdasarkan data HPP. */
export async function suggestPriceRecommendations(
  input: PriceSuggestionInput,
): Promise<AiPriceRecommendations> {
  const raw = await callGeminiJson<Record<string, RawPriceLevel>>({
    userPrompt: buildPricePrompt(input),
    image: input.image ?? null,
    responseSchema: PRICE_RESPONSE_SCHEMA,
  });

  const recommendations: AiPriceRecommendations = {
    competitive: normalisePriceLevel(raw.competitive),
    standard: normalisePriceLevel(raw.standard),
    premium: normalisePriceLevel(raw.premium),
  };

  if (
    recommendations.competitive.price === 0 &&
    recommendations.standard.price === 0 &&
    recommendations.premium.price === 0
  ) {
    throw new Error("Tidak ada rekomendasi harga valid yang ditemukan dari AI.");
  }

  return recommendations;
}
