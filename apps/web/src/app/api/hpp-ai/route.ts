import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiConfigError } from "@/lib/ai/gemini";
import {
  suggestAllCosts,
  suggestPriceRecommendations,
} from "@/lib/ai/hppSuggestions";
import type { CalculationMode, ProductImagePayload } from "@/lib/hpp/types";

/**
 * Saran AI kalkulator HPP.
 *   POST { action: "costs", productName, productCategory?, calculationMode?, batchSize?, image? }
 *     -> { variableCosts, fixedCosts }
 *   POST { action: "price", productName, productCategory?, hpp, variableCostPerUnit,
 *          totalFixedCostPerMonth, targetSales, image? }
 *     -> { recommendations }
 *
 * Kunci Gemini hanya ada di server (GEMINI_API_KEY) — versi standalone dulu
 * mengeksposnya ke bundle browser via VITE_GEMINI_API_KEY.
 */

const MAX_PRODUCT_NAME_LENGTH = 200;
// ~4,5 MB biner setelah decode; cukup untuk foto produk, mencegah payload jumbo.
const MAX_IMAGE_BASE64_CHARS = 6_000_000;

interface HppAiBody {
  action?: string;
  productName?: string;
  productCategory?: string;
  calculationMode?: string;
  batchSize?: number;
  hpp?: number;
  variableCostPerUnit?: number;
  totalFixedCostPerMonth?: number;
  targetSales?: number;
  image?: { data?: string; mimeType?: string } | null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Validasi lampiran gambar; null jika tidak ada, string pesan error jika invalid. */
function parseImage(
  image: HppAiBody["image"],
): { image: ProductImagePayload | null } | { error: string } {
  if (!image || !image.data) return { image: null };
  if (typeof image.data !== "string" || typeof image.mimeType !== "string") {
    return { error: "Format gambar tidak valid." };
  }
  if (!image.mimeType.startsWith("image/")) {
    return { error: "Tipe gambar tidak didukung." };
  }
  if (image.data.length > MAX_IMAGE_BASE64_CHARS) {
    return { error: "Ukuran gambar terlalu besar (maksimal ±4 MB)." };
  }
  return { image: { data: image.data, mimeType: image.mimeType } };
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function POST(req: Request) {
  let body: HppAiBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body JSON tidak valid");
  }

  const productName = typeof body.productName === "string" ? body.productName.trim() : "";
  if (!productName) return badRequest("productName wajib diisi");
  if (productName.length > MAX_PRODUCT_NAME_LENGTH) {
    return badRequest("productName terlalu panjang");
  }

  const imageResult = parseImage(body.image);
  if ("error" in imageResult) return badRequest(imageResult.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  const productCategory =
    typeof body.productCategory === "string" ? body.productCategory.trim() : "";

  try {
    if (body.action === "costs") {
      const calculationMode: CalculationMode =
        body.calculationMode === "perBatch" ? "perBatch" : "perPcs";
      const batchSize = isNonNegativeNumber(body.batchSize) ? body.batchSize : 0;
      if (calculationMode === "perBatch" && batchSize <= 0) {
        return badRequest("batchSize wajib diisi untuk mode per resep/batch");
      }

      const suggestions = await suggestAllCosts({
        productName,
        productCategory,
        calculationMode,
        batchSize,
        image: imageResult.image,
      });
      return NextResponse.json(suggestions);
    }

    if (body.action === "price") {
      if (!isNonNegativeNumber(body.hpp) || body.hpp <= 0) {
        return badRequest("hpp harus lebih besar dari 0");
      }
      if (
        !isNonNegativeNumber(body.variableCostPerUnit) ||
        !isNonNegativeNumber(body.totalFixedCostPerMonth) ||
        !isNonNegativeNumber(body.targetSales)
      ) {
        return badRequest("Data biaya tidak valid");
      }

      const recommendations = await suggestPriceRecommendations({
        productName,
        productCategory,
        hpp: body.hpp,
        variableCostPerUnit: body.variableCostPerUnit,
        totalFixedCostPerMonth: body.totalFixedCostPerMonth,
        targetSales: body.targetSales,
        image: imageResult.image,
      });
      return NextResponse.json({ recommendations });
    }

    return badRequest("action harus 'costs' atau 'price'");
  } catch (e) {
    if (e instanceof AiConfigError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : "Gagal mendapatkan saran AI";
    console.error("[hpp-ai] request failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
