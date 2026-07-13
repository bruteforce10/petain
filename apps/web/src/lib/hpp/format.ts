/**
 * Format & parsing angka gaya id-ID untuk kalkulator HPP, plus konversi
 * satuan bahan. Port 1:1 dari kalkulator-hpp/src/lib/utils.js — perilaku
 * dikunci oleh format.test.ts.
 */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

// Pola pemisah ribuan id-ID: "85.000", "3.000.000" (setiap grup setelah titik = 3 digit).
// Bagian bulat tidak boleh berawalan nol: "0.125" pasti desimal, bukan ribuan.
const ID_THOUSANDS_PATTERN = /^[1-9]\d{0,2}(\.\d{3})+$/;

// Normalisasi string angka format Indonesia ke notasi JS.
// Kebijakan: koma = desimal; titik = pemisah ribuan bila cocok pola grup-3-digit,
// titik tunggal di luar pola itu = desimal (mis. "0.5" dari data AI),
// multi-titik di luar pola = pemisah ribuan salah ketik (buang semua titik).
function normalizeIdNumberString(text: string): string {
  if (text.includes(",")) {
    const [integerPart, ...decimalParts] = text.split(",");
    const integerDigits = integerPart.replace(/\./g, "");
    const decimalDigits = decimalParts.join("").replace(/\./g, "");
    return decimalDigits ? `${integerDigits}.${decimalDigits}` : integerDigits;
  }

  const dotCount = (text.match(/\./g) || []).length;
  if (dotCount === 0) return text;
  if (ID_THOUSANDS_PATTERN.test(text)) return text.replace(/\./g, "");
  if (dotCount === 1) return text;
  return text.replace(/\./g, "");
}

// Parse nilai input (string terformat id-ID atau number mentah) menjadi number.
// Contoh: "85.000" -> 85000, "3.000.000" -> 3000000, "0,5" -> 0.5, "1.234,56" -> 1234.56
export function parseFormattedNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || value === undefined) return 0;

  const text = String(value).trim();
  if (text === "") return 0;

  const parsed = parseFloat(normalizeIdNumberString(text));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Format number for input display (with thousand separators)
export function formatInputNumber(value: string | number): string {
  if (!value && value !== 0) return "";
  const num = parseFormattedNumber(value);
  if (isNaN(num) || num === 0) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

// Format persentase satu desimal gaya id-ID (mis. "23,1%").
// Guard "|| 0" menormalkan -0 hasil pembulatan nilai mikro-negatif agar tidak tampil "-0%".
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10 || 0;
  return `${rounded.toLocaleString("id-ID")}%`;
}

// Bersihkan ketikan user pada input angka: buang karakter selain digit dan koma,
// pertahankan satu koma desimal (termasuk koma menggantung saat mengetik),
// dan format bagian bulat dengan pemisah ribuan id-ID.
export function sanitizeNumberInput(rawValue: string | null | undefined): string {
  if (rawValue === null || rawValue === undefined) return "";

  const cleaned = String(rawValue).replace(/[^\d,]/g, "");
  if (cleaned === "") return "";

  const hasComma = cleaned.includes(",");
  const [integerPart, ...decimalParts] = cleaned.split(",");
  const decimalDigits = decimalParts.join("");

  const formattedInteger = new Intl.NumberFormat("id-ID").format(
    parseInt(integerPart, 10) || 0,
  );

  return hasComma ? `${formattedInteger},${decimalDigits}` : formattedInteger;
}

// Convert unit to base unit for calculation
function convertToBaseUnit(value: number, unit: string): number {
  if (!value || !unit) return 0;

  const unitLower = unit.toLowerCase();

  // Weight conversions (to grams)
  if (unitLower === "kg") return value * 1000;
  if (unitLower === "g") return value;

  // Volume conversions (to ml)
  if (unitLower === "l") return value * 1000;
  if (unitLower === "ml") return value;

  // Count units (no conversion needed)
  if (["pcs", "buah", "lembar"].includes(unitLower)) return value;

  return value;
}

// Check if units are compatible (same category)
function areUnitsCompatible(unit1: string, unit2: string): boolean {
  if (!unit1 || !unit2) return false;

  const unit1Lower = unit1.toLowerCase();
  const unit2Lower = unit2.toLowerCase();

  const weightUnits = ["g", "kg"];
  if (weightUnits.includes(unit1Lower) && weightUnits.includes(unit2Lower)) {
    return true;
  }

  const volumeUnits = ["ml", "l"];
  if (volumeUnits.includes(unit1Lower) && volumeUnits.includes(unit2Lower)) {
    return true;
  }

  const countUnits = ["pcs", "buah", "lembar"];
  if (countUnits.includes(unit1Lower) && countUnits.includes(unit2Lower)) {
    return true;
  }

  return unit1Lower === unit2Lower;
}

/**
 * Hitung biaya bahan per produk dari info pemakaian dan pembelian.
 * Mengembalikan 0 bila input belum lengkap atau satuan tidak kompatibel.
 */
export function calculateCostPerProduct(
  usageAmount: number,
  usageUnit: string,
  purchasePrice: number,
  purchaseQuantity: number,
  purchaseUnit: string,
): number {
  if (!usageAmount || !purchasePrice || !purchaseQuantity || !usageUnit || !purchaseUnit) {
    return 0;
  }

  if (!areUnitsCompatible(usageUnit, purchaseUnit)) {
    return 0;
  }

  const usageInBase = convertToBaseUnit(usageAmount, usageUnit);
  const purchaseInBase = convertToBaseUnit(purchaseQuantity, purchaseUnit);

  if (purchaseInBase === 0) return 0;

  const costPerBaseUnit = purchasePrice / purchaseInBase;
  return costPerBaseUnit * usageInBase;
}
