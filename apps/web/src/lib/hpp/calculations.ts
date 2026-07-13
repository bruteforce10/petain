import { parseFormattedNumber, calculateCostPerProduct } from "./format";
import type {
  BepResult,
  CalculationMode,
  FixedCostsInput,
  HppData,
  PriceRecommendations,
  SimulationRow,
  VariableCostItem,
} from "./types";

/**
 * Kalkulasi inti HPP, rekomendasi harga, BEP, dan simulasi penjualan.
 * Port 1:1 dari kalkulator-hpp/src/lib/calculations.js — perilaku dikunci
 * oleh calculations.test.ts (skenario "Kopi Susu Gula Aren").
 */

/** Biaya satu item bahan: struktur baru dihitung dari pemakaian+pembelian, lama pakai `cost` langsung. */
function variableItemCost(item: VariableCostItem): number {
  if (item.usageAmount !== undefined || item.purchasePrice !== undefined) {
    const cost = calculateCostPerProduct(
      parseFormattedNumber(item.usageAmount || 0),
      item.usageUnit || "",
      parseFormattedNumber(item.purchasePrice || 0),
      parseFormattedNumber(item.purchaseQuantity || 0),
      item.purchaseUnit || "",
    );
    return isNaN(cost) ? 0 : cost;
  }
  return parseFormattedNumber(item.cost || 0);
}

function sumFixedCosts(fixedCosts: FixedCostsInput): number {
  return Array.isArray(fixedCosts)
    ? fixedCosts.reduce((sum, item) => sum + parseFormattedNumber(item.totalCost), 0)
    : parseFormattedNumber(fixedCosts);
}

export function calculateHPP(
  variableCosts: VariableCostItem[],
  fixedCosts: FixedCostsInput,
  targetSales: number,
  calculationMode: CalculationMode = "perPcs",
  batchSize = 0,
): HppData {
  let variableCostPerUnit = 0;

  if (calculationMode === "perBatch") {
    // Mode Per Resep (Batch): usageAmount adalah total untuk 1 batch,
    // jadi jumlahkan biaya batch lalu bagi dengan jumlah produk per batch.
    if (batchSize > 0) {
      const totalBatchCost = variableCosts.reduce(
        (sum, item) => sum + variableItemCost(item),
        0,
      );
      variableCostPerUnit = totalBatchCost / batchSize;
    }
  } else {
    // Mode Per Pcs (Satuan) - default
    variableCostPerUnit = variableCosts.reduce(
      (sum, item) => sum + variableItemCost(item),
      0,
    );
  }

  const totalFixedCostPerMonth = sumFixedCosts(fixedCosts);

  // Alokasi biaya tetap per unit: hormati nilai yang di-edit user bila ada,
  // selain itu hitung otomatis dari target penjualan.
  let fixedCostPerUnit = 0;
  if (Array.isArray(fixedCosts)) {
    fixedCostPerUnit = fixedCosts.reduce((sum, item) => {
      const totalCost = parseFormattedNumber(item.totalCost);
      if (item.allocationPerUnit !== undefined && item.allocationPerUnit !== "") {
        return sum + parseFormattedNumber(item.allocationPerUnit);
      }
      const suggestedAllocation = targetSales > 0 ? totalCost / targetSales : 0;
      return sum + suggestedAllocation;
    }, 0);
  } else {
    // Fallback untuk format lama (total tunggal)
    fixedCostPerUnit = targetSales > 0 ? totalFixedCostPerMonth / targetSales : 0;
  }

  const hpp = variableCostPerUnit + fixedCostPerUnit;

  return {
    variableCostPerUnit,
    fixedCostPerUnit,
    totalFixedCostPerMonth,
    hpp,
  };
}

// Persentase markup terhadap HPP untuk tiap level harga.
// Catatan istilah: markup = profit/HPP, sedangkan margin = profit/harga jual.
const COMPETITIVE_MARKUP_PERCENT = 30; // rentang pasar kompetitif 20-40%
const STANDARD_MARKUP_PERCENT = 55; // rentang standar 50-60%
const PREMIUM_MARKUP_PERCENT = 80; // rentang premium 70-90%

export function calculatePriceRecommendations(hpp: number): PriceRecommendations {
  if (hpp <= 0) {
    return {
      competitive: 0,
      standard: 0,
      premium: 0,
      competitiveMarkup: 0,
      standardMarkup: 0,
      premiumMarkup: 0,
    };
  }

  const applyMarkup = (markupPercent: number) =>
    Math.round(hpp * (1 + markupPercent / 100));

  return {
    competitive: applyMarkup(COMPETITIVE_MARKUP_PERCENT),
    standard: applyMarkup(STANDARD_MARKUP_PERCENT),
    premium: applyMarkup(PREMIUM_MARKUP_PERCENT),
    competitiveMarkup: COMPETITIVE_MARKUP_PERCENT,
    standardMarkup: STANDARD_MARKUP_PERCENT,
    premiumMarkup: PREMIUM_MARKUP_PERCENT,
  };
}

// Markup = profit relatif terhadap HPP (dasar penentuan harga dari biaya)
export function calculateMarkupPercent(sellingPrice: number, hpp: number): number {
  if (hpp <= 0) return 0;
  return ((sellingPrice - hpp) / hpp) * 100;
}

// Margin = profit relatif terhadap harga jual (porsi laba dari tiap rupiah penjualan)
export function calculateMarginPercent(sellingPrice: number, hpp: number): number {
  if (sellingPrice <= 0) return 0;
  return ((sellingPrice - hpp) / sellingPrice) * 100;
}

export function calculateProfitPerUnit(hpp: number, sellingPrice: number): number {
  return sellingPrice - hpp;
}

export function calculateBEP(
  fixedCosts: FixedCostsInput,
  sellingPrice: number,
  variableCostPerUnit: number,
): BepResult {
  const contributionMargin = sellingPrice - variableCostPerUnit;

  if (contributionMargin <= 0) {
    return {
      bepUnit: 0,
      bepRupiah: 0,
      isValid: false,
    };
  }

  const totalFixedCost = sumFixedCosts(fixedCosts);
  const bepUnit = Math.ceil(totalFixedCost / contributionMargin);
  const bepRupiah = bepUnit * sellingPrice;

  return {
    bepUnit,
    bepRupiah,
    isValid: true,
  };
}

export function calculateSalesNeeded(targetProfit: number, profitPerUnit: number): number {
  if (profitPerUnit <= 0) {
    return 0;
  }
  return Math.ceil(targetProfit / profitPerUnit);
}

export function generateSimulationTable(
  hpp: number,
  sellingPrice: number,
  variableCostPerUnit: number,
  fixedCosts: FixedCostsInput,
  maxUnits = 1500,
): SimulationRow[] {
  const data: SimulationRow[] = [];
  const step = Math.max(1, Math.floor(maxUnits / 50));

  const totalFixedCost = sumFixedCosts(fixedCosts);

  for (let units = 0; units <= maxUnits; units += step) {
    const revenue = units * sellingPrice;
    const variableCost = units * variableCostPerUnit;
    const totalCost = variableCost + totalFixedCost;
    const profit = revenue - totalCost;

    data.push({
      units,
      revenue,
      variableCost,
      fixedCost: totalFixedCost,
      totalCost,
      profit,
    });
  }

  return data;
}
