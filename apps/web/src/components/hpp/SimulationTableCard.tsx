import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateSimulationTable } from "@/lib/hpp/calculations";
import { formatCurrency, formatNumber } from "@/lib/hpp/format";
import { cn } from "@/lib/utils";

interface SimulationTableCardProps {
  hpp: number;
  sellingPrice: number;
  variableCostPerUnit: number;
  totalFixedCost: number;
}

export function SimulationTableCard({
  hpp,
  sellingPrice,
  variableCostPerUnit,
  totalFixedCost,
}: SimulationTableCardProps) {
  if (sellingPrice <= 0) return null;

  const simulationData = generateSimulationTable(
    hpp,
    sellingPrice,
    variableCostPerUnit,
    totalFixedCost,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulasi Penjualan</CardTitle>
        <CardDescription>
          Tabel simulasi profit berdasarkan jumlah unit yang terjual
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Omzet</th>
                <th className="px-3 py-2 text-right font-medium">Biaya Variabel</th>
                <th className="px-3 py-2 text-right font-medium">Biaya Tetap</th>
                <th className="px-3 py-2 text-right font-medium">Total Biaya</th>
                <th className="px-3 py-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {simulationData.map((row) => (
                <tr
                  key={row.units}
                  className={cn(
                    row.profit < 0 && "bg-destructive/5",
                    row.profit === 0 && "bg-muted",
                  )}
                >
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.units)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(row.variableCost)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(row.fixedCost)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(row.totalCost)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums",
                      row.profit < 0 && "text-destructive",
                      row.profit > 0 && "text-accent",
                    )}
                  >
                    {formatCurrency(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
