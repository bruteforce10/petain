"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCurrency,
  formatNumber,
  parseFormattedNumber,
  sanitizeNumberInput,
} from "@/lib/hpp/format";
import { cn } from "@/lib/utils";

const DAYS_PER_MONTH = 30;

interface ProfitAnalysisCardProps {
  sellingPrice: number;
  variableCostPerUnit: number;
  totalFixedCostPerMonth: number;
  fixedCostPerUnit: number;
  targetSalesPerMonth: number;
}

export function ProfitAnalysisCard({
  sellingPrice,
  variableCostPerUnit,
  totalFixedCostPerMonth,
  fixedCostPerUnit,
  targetSalesPerMonth,
}: ProfitAnalysisCardProps) {
  const [targetProfit, setTargetProfit] = useState("");
  const [customSellingPrice, setCustomSellingPrice] = useState("");

  // Variabel rumus: P = harga jual/unit, V = biaya variabel/unit,
  // F = total biaya tetap/bulan, L = target laba bersih/bulan.
  const targetProfitValue = parseFormattedNumber(targetProfit);
  const customSellingPriceValue = parseFormattedNumber(customSellingPrice);

  const P = customSellingPrice ? customSellingPriceValue : sellingPrice;
  const V = variableCostPerUnit;
  const fixedCostFromTargetSales =
    fixedCostPerUnit > 0 && targetSalesPerMonth > 0
      ? fixedCostPerUnit * targetSalesPerMonth
      : 0;
  const F = fixedCostFromTargetSales > 0 ? fixedCostFromTargetSales : totalFixedCostPerMonth;
  const L = targetProfitValue;

  const contributionMargin = P - V;

  // u = (F + L) / (P - V): unit per bulan untuk mencapai target laba
  const totalSalesPerMonth =
    contributionMargin > 0 && L > 0 ? Math.ceil((F + L) / contributionMargin) : 0;
  const salesPerDay = totalSalesPerMonth > 0 ? totalSalesPerMonth / DAYS_PER_MONTH : 0;
  const potentialRevenue = P * totalSalesPerMonth;
  const totalProductionCost = V * totalSalesPerMonth + F;
  const projectedNetProfit = potentialRevenue - totalProductionCost;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analisis Profit &amp; Penjualan</CardTitle>
        <CardDescription>
          Hitung jumlah penjualan yang dibutuhkan untuk mencapai target laba
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="target-profit">Target Laba Bersih Bulanan</Label>
            <Input
              id="target-profit"
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 5.000.000"
              value={targetProfit}
              onChange={(e) => setTargetProfit(sanitizeNumberInput(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-selling-price">Harga Jual Pilihan (Rp)</Label>
            <Input
              id="custom-selling-price"
              type="text"
              inputMode="numeric"
              placeholder={
                sellingPrice > 0
                  ? `Default: ${formatCurrency(sellingPrice)}`
                  : "Masukkan harga jual"
              }
              value={customSellingPrice}
              onChange={(e) => setCustomSellingPrice(sanitizeNumberInput(e.target.value))}
            />
            {sellingPrice > 0 && !customSellingPrice && (
              <p className="text-xs text-muted-foreground">
                Kosongkan untuk memakai harga rekomendasi: {formatCurrency(sellingPrice)}
              </p>
            )}
          </div>
        </div>

        {P > 0 && (
          <div className="space-y-3 rounded-md bg-muted p-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Harga Jual (P):</span>
              <span className="font-semibold tabular-nums">{formatCurrency(P)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Biaya Variabel per Unit (V):
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(V)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Total Biaya Tetap / Bulan (F):
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(F)}</span>
            </div>
            <div className="flex justify-between border-t border-border/70 pt-2">
              <span className="text-sm text-muted-foreground">
                Contribution Margin (P - V):
              </span>
              <span className="font-semibold tabular-nums text-primary">
                {formatCurrency(contributionMargin)}
              </span>
            </div>
          </div>
        )}

        {targetProfit && L > 0 && P > 0 && contributionMargin > 0 && (
          <div className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border/70 bg-background p-4 text-center">
                <p className="mb-1 text-sm text-muted-foreground">Target Jual / Hari</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {(Math.round(salesPerDay * 10) / 10).toLocaleString("id-ID", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  })}{" "}
                  pcs
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-4 text-center">
                <p className="mb-1 text-sm text-muted-foreground">Total Jual / Bulan</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatNumber(totalSalesPerMonth)} pcs
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border/70 bg-background p-4 text-center">
                <p className="mb-1 text-sm text-muted-foreground">Potensi Omzet / Bulan</p>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(potentialRevenue)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-4 text-center">
                <p className="mb-1 text-sm text-muted-foreground">
                  Total Biaya Produksi / Bulan
                </p>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(totalProductionCost)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-4 text-center">
                <p className="mb-1 text-sm text-muted-foreground">
                  Total Biaya Tetap / Bulan
                </p>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(F)}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-md border p-4 text-center",
                  projectedNetProfit >= 0
                    ? "border-primary/25 bg-mint-sorot/15"
                    : "border-destructive/30 bg-destructive/10",
                )}
              >
                <p
                  className={cn(
                    "mb-1 text-sm",
                    projectedNetProfit >= 0 ? "text-accent" : "text-destructive",
                  )}
                >
                  Proyeksi Laba Bersih / Bulan
                </p>
                <p
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    projectedNetProfit >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {formatCurrency(projectedNetProfit)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
