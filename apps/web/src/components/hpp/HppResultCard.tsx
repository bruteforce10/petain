import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/hpp/format";

interface HppResultCardProps {
  hpp: number;
  variableCostPerUnit: number;
  fixedCostPerUnit: number;
}

export function HppResultCard({
  hpp,
  variableCostPerUnit,
  fixedCostPerUnit,
}: HppResultCardProps) {
  return (
    <Card className="border-primary/25 bg-mint-sorot/10">
      <CardHeader>
        <CardTitle className="text-primary">Hasil Perhitungan HPP</CardTitle>
        <CardDescription>Harga Pokok Produksi per unit produk</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Biaya Variabel per Unit</span>
            <span className="font-semibold tabular-nums">{formatCurrency(variableCostPerUnit)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Biaya Tetap per Unit</span>
            <span className="font-semibold tabular-nums">{formatCurrency(fixedCostPerUnit)}</span>
          </div>
          <div className="border-t border-primary/15 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Total HPP per Unit</span>
              <span className="text-3xl font-bold tracking-tight text-primary tabular-nums">
                {formatCurrency(hpp)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
