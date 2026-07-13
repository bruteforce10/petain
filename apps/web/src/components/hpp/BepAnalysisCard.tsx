"use client";

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
import type { BepResult } from "@/lib/hpp/types";

interface BepAnalysisCardProps {
  bep: BepResult;
  dailySales: string;
  onDailySalesChange: (value: string) => void;
}

export function BepAnalysisCard({ bep, dailySales, onDailySalesChange }: BepAnalysisCardProps) {
  const dailySalesValue = parseFormattedNumber(dailySales);

  if (!bep.isValid) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">BEP Tidak Valid</CardTitle>
          <CardDescription>
            Harga jual harus lebih besar dari biaya variabel untuk mencapai BEP
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const daysToBep = dailySalesValue > 0 ? Math.ceil(bep.bepUnit / dailySalesValue) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Break Even Point (BEP)</CardTitle>
        <CardDescription>
          Titik dimana total pendapatan sama dengan total biaya
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">BEP dalam Unit</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-primary">
              {formatNumber(bep.bepUnit)} unit
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">BEP dalam Rupiah</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-primary">
              {formatCurrency(bep.bepRupiah)}
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="daily-sales">Penjualan Harian (unit)</Label>
            <Input
              id="daily-sales"
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 30"
              value={dailySales}
              onChange={(e) => onDailySalesChange(sanitizeNumberInput(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Digunakan untuk menghitung waktu tercapainya BEP
            </p>
          </div>
        </div>
        {daysToBep && (
          <div className="mt-4 rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Dengan penjualan {formatNumber(dailySalesValue)} unit/hari
            </p>
            <p className="font-semibold">
              BEP akan tercapai dalam {formatNumber(daysToBep)} hari
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
