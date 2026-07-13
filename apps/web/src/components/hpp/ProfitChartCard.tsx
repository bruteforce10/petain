"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateSimulationTable } from "@/lib/hpp/calculations";
import { formatCurrency } from "@/lib/hpp/format";

const CHART_MAX_UNITS = 1000;
// Warna garis dalam palet Peta Lapangan (DESIGN.md): omzet Hijau Sinyal,
// biaya Kuning Penanda (langkah gelap ramp agar terbaca di ivory), profit Hijau Rimba.
const COLOR_REVENUE = "#01c07a";
const COLOR_COST = "#b98a00";
const COLOR_PROFIT = "#00372e";

/** Format sumbu Y ringkas gaya id-ID (mis. "Rp 8,7 jt"). */
function formatAxisCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

interface ProfitChartCardProps {
  hpp: number;
  sellingPrice: number;
  variableCostPerUnit: number;
  totalFixedCost: number;
}

export function ProfitChartCard({
  hpp,
  sellingPrice,
  variableCostPerUnit,
  totalFixedCost,
}: ProfitChartCardProps) {
  if (sellingPrice <= 0) return null;

  const chartData = generateSimulationTable(
    hpp,
    sellingPrice,
    variableCostPerUnit,
    totalFixedCost,
    CHART_MAX_UNITS,
  ).map((row) => ({
    units: row.units,
    revenue: row.revenue,
    totalCost: row.totalCost,
    profit: row.profit,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grafik Profit</CardTitle>
        <CardDescription>
          Visualisasi hubungan antara jumlah penjualan dengan profit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 55, 46, 0.12)" />
            <XAxis
              dataKey="units"
              tick={{ fontSize: 12 }}
              tickLine={false}
              label={{ value: "unit", position: "insideBottomRight", offset: -4, fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={formatAxisCurrency} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelFormatter={(label) => `${label} unit`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={COLOR_REVENUE}
              strokeWidth={2}
              dot={false}
              name="Omzet"
            />
            <Line
              type="monotone"
              dataKey="totalCost"
              stroke={COLOR_COST}
              strokeWidth={2}
              dot={false}
              name="Total Biaya"
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke={COLOR_PROFIT}
              strokeWidth={2}
              dot={false}
              name="Profit"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
