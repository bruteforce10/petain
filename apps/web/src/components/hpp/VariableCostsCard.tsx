"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  calculateCostPerProduct,
  formatCurrency,
  parseFormattedNumber,
  sanitizeNumberInput,
} from "@/lib/hpp/format";
import type { CalculationMode, VariableCostItem } from "@/lib/hpp/types";

const UNITS = ["g", "kg", "ml", "L", "pcs", "buah", "lembar"] as const;

/** Biaya satu bahan per produk; mode batch membagi dengan ukuran batch. */
function itemCostPerProduct(
  item: VariableCostItem,
  calculationMode: CalculationMode,
  batchSize: number,
): number {
  let cost: number;
  if (item.usageAmount !== undefined || item.purchasePrice !== undefined) {
    cost = calculateCostPerProduct(
      parseFormattedNumber(item.usageAmount || 0),
      item.usageUnit || "",
      parseFormattedNumber(item.purchasePrice || 0),
      parseFormattedNumber(item.purchaseQuantity || 0),
      item.purchaseUnit || "",
    );
  } else {
    cost = parseFormattedNumber(item.cost || 0);
  }
  if (isNaN(cost)) return 0;
  if (calculationMode === "perBatch" && batchSize > 0) return cost / batchSize;
  return cost;
}

interface VariableCostsCardProps {
  variableCosts: VariableCostItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, item: VariableCostItem) => void;
  onAiFill: () => void;
  loadingAi: boolean;
  productName: string;
  calculationMode: CalculationMode;
  batchSize: number;
}

export function VariableCostsCard({
  variableCosts,
  onAdd,
  onRemove,
  onChange,
  onAiFill,
  loadingAi,
  productName,
  calculationMode,
  batchSize,
}: VariableCostsCardProps) {
  const totalVariableCost = variableCosts.reduce(
    (sum, item) => sum + itemCostPerProduct(item, calculationMode, batchSize),
    0,
  );

  const unitSelectOptions = (
    <>
      <option value="">Pilih</option>
      {UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle>Biaya Variabel per Produk</CardTitle>
            <CardDescription>
              {calculationMode === "perBatch"
                ? "Rincikan semua bahan yang digunakan untuk membuat 1 resep/batch"
                : "Rincikan semua bahan yang digunakan untuk membuat produk jadi"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onAiFill}
              disabled={loadingAi || !productName.trim()}
              title={!productName.trim() ? "Isi nama produk terlebih dahulu" : undefined}
              size="sm"
              variant="outline"
              className="border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
            >
              <Sparkles className="size-3.5" />
              {loadingAi ? "Memproses..." : "Rekomendasi AI"}
            </Button>
            <Button onClick={onAdd} size="sm">
              <Plus className="size-3.5" />
              Tambah Bahan
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAi && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-md bg-muted p-4 text-center text-sm text-muted-foreground"
          >
            <Sparkles className="mx-auto mb-2 size-5 motion-safe:animate-pulse" />
            AI sedang menganalisis produk dan mengisi bahan-bahan...
          </div>
        )}
        <div className="space-y-4">
          {variableCosts.map((item, index) => (
            <div key={index} className="space-y-4 rounded-md border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Bahan {index + 1}</h4>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label={`Hapus bahan ${index + 1}`}
                  onClick={() => onRemove(index)}
                  disabled={variableCosts.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`var-name-${index}`}>Nama Bahan</Label>
                <Input
                  id={`var-name-${index}`}
                  placeholder="Contoh: Kopi bubuk"
                  value={item.name || ""}
                  onChange={(e) => onChange(index, { ...item, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-medium">
                    {calculationMode === "perBatch"
                      ? "Pemakaian per Resep/Batch"
                      : "Pemakaian per Produk"}
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={`var-usage-amount-${index}`}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Jumlah Pakai
                      </Label>
                      <Input
                        id={`var-usage-amount-${index}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={item.usageAmount || ""}
                        onChange={(e) =>
                          onChange(index, {
                            ...item,
                            usageAmount: sanitizeNumberInput(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label
                        htmlFor={`var-usage-unit-${index}`}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Satuan
                      </Label>
                      <Select
                        id={`var-usage-unit-${index}`}
                        value={item.usageUnit || ""}
                        onChange={(e) =>
                          onChange(index, { ...item, usageUnit: e.target.value })
                        }
                      >
                        {unitSelectOptions}
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">Info Pembelian Bahan</Label>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`var-purchase-price-${index}`}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Total Harga
                      </Label>
                      <Input
                        id={`var-purchase-price-${index}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={item.purchasePrice || ""}
                        onChange={(e) =>
                          onChange(index, {
                            ...item,
                            purchasePrice: sanitizeNumberInput(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`var-purchase-quantity-${index}`}
                          className="text-xs font-normal text-muted-foreground"
                        >
                          Jumlah Beli
                        </Label>
                        <Input
                          id={`var-purchase-quantity-${index}`}
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={item.purchaseQuantity || ""}
                          onChange={(e) =>
                            onChange(index, {
                              ...item,
                              purchaseQuantity: sanitizeNumberInput(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label
                          htmlFor={`var-purchase-unit-${index}`}
                          className="text-xs font-normal text-muted-foreground"
                        >
                          Satuan
                        </Label>
                        <Select
                          id={`var-purchase-unit-${index}`}
                          value={item.purchaseUnit || ""}
                          onChange={(e) =>
                            onChange(index, { ...item, purchaseUnit: e.target.value })
                          }
                        >
                          {unitSelectOptions}
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-muted p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {calculationMode === "perBatch"
                      ? "Biaya per Produk (dari batch):"
                      : "Biaya Produk:"}
                  </span>
                  <span className="font-bold tabular-nums text-primary">
                    {formatCurrency(itemCostPerProduct(item, calculationMode, batchSize))}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-md bg-muted p-4">
            <div className="flex justify-between">
              <span className="font-medium">Total Biaya Variabel:</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatCurrency(totalVariableCost)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
