"use client";

import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  calculateMarginPercent,
  calculateMarkupPercent,
} from "@/lib/hpp/calculations";
import { formatCurrency, formatPercent } from "@/lib/hpp/format";
import type { AiPriceRecommendations, PriceRecommendations } from "@/lib/hpp/types";

type PriceLevel = "competitive" | "standard" | "premium";

const FALLBACK_EXPLANATIONS: Record<PriceLevel, string> = {
  competitive:
    "Cocok untuk pasar yang sangat kompetitif. Fokus pada volume penjualan tinggi.",
  standard:
    "Keseimbangan antara profitabilitas dan daya saing. Pilihan yang paling umum.",
  premium:
    "Untuk positioning premium dengan fokus pada kualitas dan eksklusivitas.",
};

/* Level dibedakan lewat penanda kecil dalam palet (DESIGN.md: The Satu Hijau
   Rule), bukan tiga keluarga warna berbeda. */
const LEVEL_BADGES: Record<PriceLevel, { label: string; className: string }> = {
  competitive: {
    label: "Volume tinggi",
    className: "border border-border text-muted-foreground",
  },
  standard: { label: "Paling seimbang", className: "bg-mint-sorot/60 text-primary" },
  premium: { label: "Margin terbesar", className: "bg-kuning-penanda/70 text-primary" },
};

const LEVEL_TITLES: Record<PriceLevel, string> = {
  competitive: "Harga Kompetitif",
  standard: "Harga Standar",
  premium: "Harga Premium",
};

interface PriceRecommendationSectionProps {
  recommendations: PriceRecommendations;
  hpp: number;
  selectedPrice: number;
  onSelectPrice: (price: number) => void;
  aiRecommendations: AiPriceRecommendations | null;
  loadingAi: boolean;
  onGetAiRecommendations: () => void;
  productName: string;
}

export function PriceRecommendationSection({
  recommendations,
  hpp,
  selectedPrice,
  onSelectPrice,
  aiRecommendations,
  loadingAi,
  onGetAiRecommendations,
  productName,
}: PriceRecommendationSectionProps) {
  const levels: PriceLevel[] = ["competitive", "standard", "premium"];

  const priceCards = levels.map((level) => ({
    level,
    title: LEVEL_TITLES[level],
    price: aiRecommendations?.[level]?.price || recommendations[level],
    description: aiRecommendations?.[level]?.explanation || FALLBACK_EXPLANATIONS[level],
    isAi: Boolean(aiRecommendations?.[level]),
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Rekomendasi Harga Jual</h3>
          <p className="text-sm text-muted-foreground">
            Klik salah satu kartu untuk memakai harga tersebut pada analisis di bawah
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loadingAi && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 motion-safe:animate-pulse" />
              AI sedang menganalisis...
            </span>
          )}
          {aiRecommendations && !loadingAi && (
            <span className="flex items-center gap-2 text-sm text-accent">
              <Sparkles className="size-4" />
              Saran AI aktif
            </span>
          )}
          <Button
            onClick={onGetAiRecommendations}
            disabled={loadingAi || !productName.trim() || !hpp}
            size="sm"
            variant="outline"
            className="border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
          >
            <Sparkles className="size-3.5" />
            {loadingAi ? "Memproses..." : "Dapatkan Saran AI"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {priceCards.map((card) => {
          const profitPerUnit = card.price - hpp;
          const markupPercent = calculateMarkupPercent(card.price, hpp);
          const marginPercent = calculateMarginPercent(card.price, hpp);
          const isSelected = selectedPrice > 0 && selectedPrice === card.price;
          const badge = LEVEL_BADGES[card.level];

          return (
            <button
              key={card.level}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectPrice(card.price)}
              className={cn(
                "rounded-lg border bg-card p-5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-all motion-safe:hover:-translate-y-0.5",
                isSelected
                  ? "border-primary ring-2 ring-primary/25"
                  : "border-border/70 hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <h4 className="font-semibold">{card.title}</h4>
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[11px] font-bold",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  {card.isAi && <Sparkles className="size-4 text-accent" />}
                  {isSelected && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>

              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Harga Jual</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums text-primary">
                    {formatCurrency(card.price)}
                  </p>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Markup (dari HPP):</span>
                  <span className="font-semibold tabular-nums">
                    {formatPercent(markupPercent)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margin (dari harga):</span>
                  <span className="font-semibold tabular-nums">
                    {formatPercent(marginPercent)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit/Unit:</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(profitPerUnit)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
