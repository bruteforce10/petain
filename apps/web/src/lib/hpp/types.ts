/**
 * Tipe domain kalkulator HPP (Harga Pokok Produksi).
 * Nilai numerik pada item biaya disimpan sebagai string terformat id-ID
 * ("85.000") persis seperti yang diketik user di form; parsing terjadi di
 * lib/hpp/format saat perhitungan.
 */

export interface VariableCostItem {
  name: string;
  /** Jumlah pemakaian per produk (mode perPcs) atau per batch (mode perBatch). */
  usageAmount?: string;
  usageUnit?: string;
  purchasePrice?: string;
  purchaseQuantity?: string;
  purchaseUnit?: string;
  /** Struktur lama: biaya langsung per produk (fallback kompatibilitas). */
  cost?: string;
}

export interface FixedCostItem {
  name: string;
  /** Total biaya per bulan. */
  totalCost: string;
  /** Kosong = pakai saran otomatis (totalCost / target penjualan). */
  allocationPerUnit?: string;
}

export type CalculationMode = "perPcs" | "perBatch";

/** Format lama menerima total biaya tetap sebagai string/number tunggal. */
export type FixedCostsInput = FixedCostItem[] | string | number;

export interface HppData {
  variableCostPerUnit: number;
  fixedCostPerUnit: number;
  totalFixedCostPerMonth: number;
  hpp: number;
}

export interface PriceRecommendations {
  competitive: number;
  standard: number;
  premium: number;
  competitiveMarkup: number;
  standardMarkup: number;
  premiumMarkup: number;
}

export interface BepResult {
  bepUnit: number;
  bepRupiah: number;
  isValid: boolean;
}

export interface SimulationRow {
  units: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  totalCost: number;
  profit: number;
}

export interface AiPriceLevel {
  price: number;
  margin: number;
  explanation: string;
}

export interface AiPriceRecommendations {
  competitive: AiPriceLevel;
  standard: AiPriceLevel;
  premium: AiPriceLevel;
}

/** Lampiran gambar produk untuk permintaan AI (base64 tanpa prefix data URL). */
export interface ProductImagePayload {
  data: string;
  mimeType: string;
}

/** Hasil saran biaya dari AI; null berarti AI tidak mengembalikan bagian itu. */
export interface AiCostSuggestions {
  variableCosts: VariableCostItem[] | null;
  fixedCosts: FixedCostItem[] | null;
}
