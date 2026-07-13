import { describe, test, expect } from "bun:test";
import {
  calculateHPP,
  calculatePriceRecommendations,
  calculateMarkupPercent,
  calculateMarginPercent,
  calculateProfitPerUnit,
  calculateBEP,
  calculateSalesNeeded,
  generateSimulationTable,
} from "./calculations";
import type { FixedCostItem, VariableCostItem } from "./types";

// Skenario nyata "Kopi Susu Gula Aren" — data persis dari laporan bug:
// nilai tersimpan sebagai string terformat id-ID seperti yang dihasilkan form.
const VARIABLE_COSTS: VariableCostItem[] = [
  { name: "Biji kopi", usageAmount: "18", usageUnit: "g", purchasePrice: "85.000", purchaseQuantity: "1.000", purchaseUnit: "g" },
  { name: "Susu", usageAmount: "105", usageUnit: "ml", purchasePrice: "30.000", purchaseQuantity: "1.000", purchaseUnit: "ml" },
  { name: "Gula aren", usageAmount: "30", usageUnit: "g", purchasePrice: "38.000", purchaseQuantity: "1.000", purchaseUnit: "g" },
  { name: "Es batu", usageAmount: "80", usageUnit: "g", purchasePrice: "6.000", purchaseQuantity: "1.000", purchaseUnit: "g" },
  { name: "Cup plastik", usageAmount: "1", usageUnit: "pcs", purchasePrice: "85.000", purchaseQuantity: "100", purchaseUnit: "pcs" },
  { name: "Tutup cup", usageAmount: "1", usageUnit: "pcs", purchasePrice: "25.000", purchaseQuantity: "100", purchaseUnit: "pcs" },
  { name: "Sedotan", usageAmount: "1", usageUnit: "pcs", purchasePrice: "18.000", purchaseQuantity: "200", purchaseUnit: "pcs" },
];

const FIXED_COSTS: FixedCostItem[] = [
  { name: "Sewa tempat/kios", totalCost: "3.000.000", allocationPerUnit: "" },
  { name: "Gaji karyawan", totalCost: "3.500.000", allocationPerUnit: "" },
  { name: "Listrik", totalCost: "600.000", allocationPerUnit: "" },
  { name: "Internet & POS", totalCost: "350.000", allocationPerUnit: "" },
  { name: "Penyusutan", totalCost: "500.000", allocationPerUnit: "" },
  { name: "Pemasaran", totalCost: "400.000", allocationPerUnit: "" },
  { name: "Air bersih", totalCost: "150.000", allocationPerUnit: "" },
  { name: "Kebersihan", totalCost: "200.000", allocationPerUnit: "" },
];

const TARGET_SALES = 1000;

describe("calculateHPP - skenario laporan bug (mode perPcs)", () => {
  const hppData = calculateHPP(VARIABLE_COSTS, FIXED_COSTS, TARGET_SALES);

  test("biaya variabel per unit = 7490 (bukan 6301)", () => {
    // 1530 + 3150 + 1140 + 480 + 850 + 250 + 90
    expect(hppData.variableCostPerUnit).toBeCloseTo(7490, 6);
  });

  test("total biaya tetap per bulan = 8.700.000 (bukan 2.207)", () => {
    expect(hppData.totalFixedCostPerMonth).toBeCloseTo(8700000, 6);
  });

  test("biaya tetap per unit = 8700 (8.700.000 / 1000 unit)", () => {
    expect(hppData.fixedCostPerUnit).toBeCloseTo(8700, 6);
  });

  test("total HPP per unit = 16190 (bukan 8508)", () => {
    expect(hppData.hpp).toBeCloseTo(16190, 6);
  });
});

describe("calculateHPP - perilaku lain", () => {
  test("menghormati alokasi per unit yang di-edit user", () => {
    const fixedCosts: FixedCostItem[] = [
      { name: "Sewa", totalCost: "1.000.000", allocationPerUnit: "1.500" },
    ];
    const result = calculateHPP([], fixedCosts, 1000);
    expect(result.fixedCostPerUnit).toBe(1500);
    expect(result.totalFixedCostPerMonth).toBe(1000000);
  });

  test("target penjualan 0 membuat alokasi biaya tetap 0 (tanpa pembagian nol)", () => {
    const result = calculateHPP(VARIABLE_COSTS, FIXED_COSTS, 0);
    expect(result.fixedCostPerUnit).toBe(0);
    expect(result.hpp).toBeCloseTo(7490, 6);
  });

  test("mendukung struktur lama {cost} sebagai biaya langsung per produk", () => {
    const result = calculateHPP(
      [{ name: "Kemasan", cost: "2.500" }],
      [],
      1000,
    );
    expect(result.variableCostPerUnit).toBe(2500);
  });

  test("mendukung fixedCosts non-array (format lama, string terformat)", () => {
    const result = calculateHPP([], "8.700.000", 1000);
    expect(result.totalFixedCostPerMonth).toBe(8700000);
    expect(result.fixedCostPerUnit).toBe(8700);
  });

  test("mode perBatch membagi total biaya batch dengan ukuran batch", () => {
    const batchCosts: VariableCostItem[] = [
      // 1 batch memakai 1000 g kopi: 85.000/1.000g -> 85.000 per batch
      { name: "Biji kopi", usageAmount: "1.000", usageUnit: "g", purchasePrice: "85.000", purchaseQuantity: "1.000", purchaseUnit: "g" },
      // 1 batch memakai 50 cup: 85.000/100pcs -> 42.500 per batch
      { name: "Cup", usageAmount: "50", usageUnit: "pcs", purchasePrice: "85.000", purchaseQuantity: "100", purchaseUnit: "pcs" },
    ];
    const result = calculateHPP(batchCosts, [], 1000, "perBatch", 50);
    // (85000 + 42500) / 50 = 2550
    expect(result.variableCostPerUnit).toBeCloseTo(2550, 6);
  });

  test("mode perBatch tanpa batchSize valid menghasilkan biaya variabel 0", () => {
    const result = calculateHPP(VARIABLE_COSTS, [], 1000, "perBatch", 0);
    expect(result.variableCostPerUnit).toBe(0);
  });
});

describe("calculatePriceRecommendations", () => {
  test("menghasilkan harga dari markup 30%/55%/80% terhadap HPP", () => {
    const rec = calculatePriceRecommendations(10000);
    expect(rec.competitive).toBe(13000);
    expect(rec.standard).toBe(15500);
    expect(rec.premium).toBe(18000);
  });

  test("menyertakan persentase markup, bukan mengaku margin", () => {
    const rec = calculatePriceRecommendations(10000);
    expect(rec.competitiveMarkup).toBe(30);
    expect(rec.standardMarkup).toBe(55);
    expect(rec.premiumMarkup).toBe(80);
  });

  test("HPP nol atau negatif menghasilkan semua nilai nol", () => {
    const rec = calculatePriceRecommendations(0);
    expect(rec.competitive).toBe(0);
    expect(rec.standard).toBe(0);
    expect(rec.premium).toBe(0);
  });
});

describe("calculateMarkupPercent & calculateMarginPercent", () => {
  test("markup = profit / HPP; margin = profit / harga jual", () => {
    // profit = 13000 - 10000 = 3000
    expect(calculateMarkupPercent(13000, 10000)).toBeCloseTo(30, 6);
    expect(calculateMarginPercent(13000, 10000)).toBeCloseTo(23.0769, 3);
  });

  test("contoh laporan bug: harga standar 13187 pada HPP 8508", () => {
    // markup 55% vs margin sebenarnya 35.5%
    expect(calculateMarkupPercent(13187, 8508)).toBeCloseTo(54.99, 1);
    expect(calculateMarginPercent(13187, 8508)).toBeCloseTo(35.48, 1);
  });

  test("mengembalikan 0 saat pembagi tidak valid", () => {
    expect(calculateMarkupPercent(13000, 0)).toBe(0);
    expect(calculateMarginPercent(0, 10000)).toBe(0);
  });
});

describe("calculateProfitPerUnit", () => {
  test("profit per unit = harga jual - HPP", () => {
    expect(calculateProfitPerUnit(16190, 21047)).toBe(4857);
  });
});

describe("calculateBEP", () => {
  test("BEP unit = ceil(total biaya tetap / contribution margin)", () => {
    const bep = calculateBEP(FIXED_COSTS, 15000, 7490);
    // CM = 7510; 8.700.000 / 7510 = 1158.45... -> 1159
    expect(bep.isValid).toBe(true);
    expect(bep.bepUnit).toBe(1159);
    expect(bep.bepRupiah).toBe(1159 * 15000);
  });

  test("tidak valid jika harga jual <= biaya variabel", () => {
    const bep = calculateBEP(FIXED_COSTS, 7000, 7490);
    expect(bep.isValid).toBe(false);
    expect(bep.bepUnit).toBe(0);
  });

  test("menerima total biaya tetap sebagai angka mentah", () => {
    const bep = calculateBEP(8700000, 15000, 7490);
    expect(bep.bepUnit).toBe(1159);
  });
});

describe("calculateSalesNeeded", () => {
  test("unit yang dibutuhkan = ceil(target laba / profit per unit)", () => {
    expect(calculateSalesNeeded(5000000, 7510)).toBe(666);
  });

  test("mengembalikan 0 jika profit per unit tidak positif", () => {
    expect(calculateSalesNeeded(5000000, 0)).toBe(0);
    expect(calculateSalesNeeded(5000000, -100)).toBe(0);
  });
});

describe("generateSimulationTable", () => {
  test("baris pertama (0 unit) rugi sebesar total biaya tetap", () => {
    const data = generateSimulationTable(16190, 21000, 7490, FIXED_COSTS);
    expect(data[0]).toEqual({
      units: 0,
      revenue: 0,
      variableCost: 0,
      fixedCost: 8700000,
      totalCost: 8700000,
      profit: -8700000,
    });
  });

  test("menghitung profit per baris = revenue - (variabel + tetap)", () => {
    const data = generateSimulationTable(16190, 21000, 7490, 8700000, 100);
    // step = max(1, floor(100/50)) = 2
    const row = data.find((r) => r.units === 100);
    expect(row).toBeDefined();
    expect(row!.revenue).toBe(100 * 21000);
    expect(row!.variableCost).toBe(100 * 7490);
    expect(row!.totalCost).toBe(100 * 7490 + 8700000);
    expect(row!.profit).toBe(100 * 21000 - (100 * 7490 + 8700000));
  });

  test("menerima total biaya tetap sebagai angka mentah (seperti dipakai App)", () => {
    const data = generateSimulationTable(16190, 21000, 7490, 8700000);
    expect(data[0].fixedCost).toBe(8700000);
  });
});
