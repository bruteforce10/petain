"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { BepAnalysisCard } from "@/components/hpp/BepAnalysisCard";
import { FixedCostsCard } from "@/components/hpp/FixedCostsCard";
import { HppResultCard } from "@/components/hpp/HppResultCard";
import { PriceRecommendationSection } from "@/components/hpp/PriceRecommendationSection";
import {
  EMPTY_PRODUCT_IMAGE,
  ProductInfoCard,
  type ProductImageState,
} from "@/components/hpp/ProductInfoCard";
import { ProfitAnalysisCard } from "@/components/hpp/ProfitAnalysisCard";
import { ProfitChartCard } from "@/components/hpp/ProfitChartCard";
import { SimulationTableCard } from "@/components/hpp/SimulationTableCard";
import { VariableCostsCard } from "@/components/hpp/VariableCostsCard";
import {
  calculateBEP,
  calculateHPP,
  calculatePriceRecommendations,
} from "@/lib/hpp/calculations";
import { parseFormattedNumber } from "@/lib/hpp/format";
import type {
  AiCostSuggestions,
  AiPriceRecommendations,
  CalculationMode,
  FixedCostItem,
  ProductImagePayload,
  VariableCostItem,
} from "@/lib/hpp/types";

const EMPTY_VARIABLE_COST: VariableCostItem = {
  name: "",
  usageAmount: "",
  usageUnit: "",
  purchasePrice: "",
  purchaseQuantity: "",
  purchaseUnit: "",
};

const EMPTY_FIXED_COST: FixedCostItem = {
  name: "",
  totalCost: "",
  allocationPerUnit: "",
};

/** POST ke /api/hpp-ai; melempar Error berpesan Indonesia bila gagal. */
async function postHppAi<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/hpp-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Gagal menghubungi layanan AI. Coba lagi.");
  }
  return data;
}

export function KalkulatorHppClient() {
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [calculationMode, setCalculationMode] = useState<CalculationMode>("perPcs");
  const [batchSize, setBatchSize] = useState("");
  const [variableCosts, setVariableCosts] = useState<VariableCostItem[]>([
    { ...EMPTY_VARIABLE_COST },
  ]);
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([{ ...EMPTY_FIXED_COST }]);
  const [targetSales, setTargetSales] = useState("");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [dailySales, setDailySales] = useState("");
  const [productImage, setProductImage] = useState<ProductImageState>(EMPTY_PRODUCT_IMAGE);
  const [loadingAiCosts, setLoadingAiCosts] = useState(false);
  const [loadingAiPrice, setLoadingAiPrice] = useState(false);
  const [aiPriceRecommendations, setAiPriceRecommendations] =
    useState<AiPriceRecommendations | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Semua angka turunan dihitung ulang tiap render dari state form (tanpa efek samping).
  const hppData = calculateHPP(
    variableCosts,
    fixedCosts,
    parseFormattedNumber(targetSales),
    calculationMode,
    parseFormattedNumber(batchSize),
  );
  const priceRecommendations =
    hppData.hpp > 0 ? calculatePriceRecommendations(hppData.hpp) : null;
  const bep =
    selectedPrice > 0
      ? calculateBEP(fixedCosts, selectedPrice, hppData.variableCostPerUnit)
      : { bepUnit: 0, bepRupiah: 0, isValid: false };

  const imagePayload: ProductImagePayload | undefined =
    productImage.base64 && productImage.mimeType
      ? { data: productImage.base64, mimeType: productImage.mimeType }
      : undefined;

  function addVariableCost() {
    setVariableCosts((prev) => [...prev, { ...EMPTY_VARIABLE_COST }]);
  }

  function removeVariableCost(index: number) {
    setVariableCosts((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  }

  function changeVariableCost(index: number, item: VariableCostItem) {
    setVariableCosts((prev) => prev.map((existing, i) => (i === index ? item : existing)));
  }

  function addFixedCost() {
    setFixedCosts((prev) => [...prev, { ...EMPTY_FIXED_COST }]);
  }

  function removeFixedCost(index: number) {
    setFixedCosts((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function changeFixedCost(index: number, item: FixedCostItem) {
    setFixedCosts((prev) => prev.map((existing, i) => (i === index ? item : existing)));
  }

  async function handleAiFillCosts() {
    if (!productName.trim()) {
      setErrorMessage("Mohon masukkan nama produk terlebih dahulu.");
      return;
    }
    setErrorMessage("");
    setLoadingAiCosts(true);
    try {
      const data = await postHppAi<AiCostSuggestions>({
        action: "costs",
        productName,
        productCategory,
        calculationMode,
        batchSize: parseFormattedNumber(batchSize),
        image: imagePayload,
      });

      if (data.variableCosts?.length) setVariableCosts(data.variableCosts);
      if (data.fixedCosts?.length) setFixedCosts(data.fixedCosts);
      if (!data.variableCosts?.length && !data.fixedCosts?.length) {
        setErrorMessage(
          "Tidak dapat mendapatkan rekomendasi dari AI. Coba lagi atau isi manual.",
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Gagal mendapatkan saran AI.");
    } finally {
      setLoadingAiCosts(false);
    }
  }

  async function handleAiPriceRecommendations() {
    if (!productName.trim() || hppData.hpp <= 0) {
      setErrorMessage(
        "Mohon lengkapi nama produk dan pastikan HPP sudah terhitung terlebih dahulu.",
      );
      return;
    }
    setErrorMessage("");
    setLoadingAiPrice(true);
    try {
      const data = await postHppAi<{ recommendations: AiPriceRecommendations }>({
        action: "price",
        productName,
        productCategory,
        hpp: hppData.hpp,
        variableCostPerUnit: hppData.variableCostPerUnit,
        totalFixedCostPerMonth: hppData.totalFixedCostPerMonth || 0,
        targetSales: parseFormattedNumber(targetSales) || 0,
        image: imagePayload,
      });
      setAiPriceRecommendations(data.recommendations);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Gagal mendapatkan saran harga AI.");
    } finally {
      setLoadingAiPrice(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kalkulator HPP</h1>
        <p className="text-sm text-muted-foreground">
          Hitung Harga Pokok Produksi, tentukan harga jual ideal, dan analisis profit &amp; BEP
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            aria-label="Tutup pesan error"
            className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
            onClick={() => setErrorMessage("")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProductInfoCard
            productName={productName}
            onProductNameChange={setProductName}
            productCategory={productCategory}
            onProductCategoryChange={setProductCategory}
            calculationMode={calculationMode}
            onCalculationModeChange={setCalculationMode}
            batchSize={batchSize}
            onBatchSizeChange={setBatchSize}
            productImage={productImage}
            onProductImageChange={setProductImage}
            onImageError={setErrorMessage}
          />

          <VariableCostsCard
            variableCosts={variableCosts}
            onAdd={addVariableCost}
            onRemove={removeVariableCost}
            onChange={changeVariableCost}
            onAiFill={handleAiFillCosts}
            loadingAi={loadingAiCosts}
            productName={productName}
            calculationMode={calculationMode}
            batchSize={parseFormattedNumber(batchSize)}
          />

          <FixedCostsCard
            fixedCosts={fixedCosts}
            targetSales={targetSales}
            onAdd={addFixedCost}
            onRemove={removeFixedCost}
            onChange={changeFixedCost}
            onTargetSalesChange={setTargetSales}
          />
        </div>

        <div className="space-y-6">
          <div className="lg:sticky lg:top-20">
            {hppData.hpp > 0 ? (
              <HppResultCard
                hpp={hppData.hpp}
                variableCostPerUnit={hppData.variableCostPerUnit}
                fixedCostPerUnit={hppData.fixedCostPerUnit}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Hasil HPP akan muncul di sini</p>
                <p className="mt-1">
                  Isi bahan pada <span className="font-medium">Biaya Variabel</span> (atau
                  pakai tombol Rekomendasi AI) untuk mulai menghitung.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {priceRecommendations && (
        <PriceRecommendationSection
          recommendations={priceRecommendations}
          hpp={hppData.hpp}
          selectedPrice={selectedPrice}
          onSelectPrice={setSelectedPrice}
          aiRecommendations={aiPriceRecommendations}
          loadingAi={loadingAiPrice}
          onGetAiRecommendations={handleAiPriceRecommendations}
          productName={productName}
        />
      )}

      {selectedPrice > 0 && (
        <div className="space-y-6">
          <ProfitAnalysisCard
            sellingPrice={selectedPrice}
            variableCostPerUnit={hppData.variableCostPerUnit || 0}
            totalFixedCostPerMonth={hppData.totalFixedCostPerMonth || 0}
            fixedCostPerUnit={hppData.fixedCostPerUnit || 0}
            targetSalesPerMonth={parseFormattedNumber(targetSales)}
          />
          <BepAnalysisCard
            bep={bep}
            dailySales={dailySales}
            onDailySalesChange={setDailySales}
          />
          <ProfitChartCard
            hpp={hppData.hpp}
            sellingPrice={selectedPrice}
            variableCostPerUnit={hppData.variableCostPerUnit}
            totalFixedCost={hppData.totalFixedCostPerMonth || 0}
          />
          <SimulationTableCard
            hpp={hppData.hpp}
            sellingPrice={selectedPrice}
            variableCostPerUnit={hppData.variableCostPerUnit}
            totalFixedCost={hppData.totalFixedCostPerMonth || 0}
          />
        </div>
      )}
    </div>
  );
}
