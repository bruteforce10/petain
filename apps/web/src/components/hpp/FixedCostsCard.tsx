"use client";

import { Plus, Trash2 } from "lucide-react";

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
import {
  formatCurrency,
  formatInputNumber,
  parseFormattedNumber,
  sanitizeNumberInput,
} from "@/lib/hpp/format";
import type { FixedCostItem } from "@/lib/hpp/types";

interface FixedCostsCardProps {
  fixedCosts: FixedCostItem[];
  targetSales: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, item: FixedCostItem) => void;
  onTargetSalesChange: (value: string) => void;
}

export function FixedCostsCard({
  fixedCosts,
  targetSales,
  onAdd,
  onRemove,
  onChange,
  onTargetSalesChange,
}: FixedCostsCardProps) {
  const totalFixedCostPerMonth = fixedCosts.reduce((sum, item) => {
    const cost = parseFormattedNumber(item.totalCost);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  const salesTarget = parseFormattedNumber(targetSales);
  const suggestedAllocationFor = (totalCost: number) =>
    salesTarget > 0 ? totalCost / salesTarget : 0;

  // Total alokasi per produk: pakai nilai yang di-edit user bila ada, selain itu saran otomatis.
  const totalAllocationPerUnit = fixedCosts.reduce((sum, item) => {
    const suggested = suggestedAllocationFor(parseFormattedNumber(item.totalCost));
    const allocation =
      item.allocationPerUnit !== undefined && item.allocationPerUnit !== ""
        ? parseFormattedNumber(item.allocationPerUnit)
        : suggested;
    return sum + allocation;
  }, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle>Alokasi Biaya Tetap</CardTitle>
            <CardDescription>
              Masukkan biaya tetap per bulan dan target penjualan untuk menghitung
              alokasi per produk
            </CardDescription>
          </div>
          <Button onClick={onAdd} size="sm">
            <Plus className="size-3.5" />
            Tambah Biaya
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-sales">Target Penjualan per Bulan (unit)</Label>
            <Input
              id="target-sales"
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 1.000"
              value={targetSales}
              onChange={(e) => onTargetSalesChange(sanitizeNumberInput(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Digunakan untuk menghitung alokasi biaya tetap per unit produk
            </p>
          </div>

          <div className="space-y-3">
            {fixedCosts.map((item, index) => {
              const suggestedAllocation = suggestedAllocationFor(
                parseFormattedNumber(item.totalCost),
              );
              const allocationDisplayValue =
                item.allocationPerUnit !== undefined && item.allocationPerUnit !== ""
                  ? item.allocationPerUnit
                  : "";

              return (
                <div
                  key={index}
                  className="space-y-3 rounded-md border border-border/70 p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Biaya {index + 1}</h4>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label={`Hapus biaya ${index + 1}`}
                      onClick={() => onRemove(index)}
                      disabled={fixedCosts.length === 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor={`fixed-name-${index}`}>Nama Biaya</Label>
                      <Input
                        id={`fixed-name-${index}`}
                        placeholder="Contoh: Sewa tempat"
                        value={item.name}
                        onChange={(e) => onChange(index, { ...item, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`fixed-cost-${index}`}>Total Biaya (per bulan)</Label>
                      <Input
                        id={`fixed-cost-${index}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="Contoh: 2.000.000"
                        value={item.totalCost}
                        onChange={(e) =>
                          onChange(index, {
                            ...item,
                            totalCost: sanitizeNumberInput(e.target.value),
                            // Reset agar kembali ke saran otomatis saat total berubah
                            allocationPerUnit: "",
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`fixed-allocation-${index}`}>
                        Alokasi per Produk (Rp)
                      </Label>
                      <Input
                        id={`fixed-allocation-${index}`}
                        type="text"
                        inputMode="numeric"
                        placeholder={
                          suggestedAllocation > 0
                            ? formatInputNumber(Math.round(suggestedAllocation))
                            : "0"
                        }
                        value={allocationDisplayValue}
                        onChange={(e) =>
                          onChange(index, {
                            ...item,
                            allocationPerUnit: sanitizeNumberInput(e.target.value),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Saran:{" "}
                        <span className="tabular-nums">
                          {formatCurrency(suggestedAllocation)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 rounded-md bg-muted p-4">
            <div className="flex justify-between">
              <span className="font-medium">Total Biaya Tetap per Bulan:</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatCurrency(totalFixedCostPerMonth)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border/70 pt-2">
              <span className="font-medium">Total Alokasi per Produk:</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatCurrency(totalAllocationPerUnit)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
