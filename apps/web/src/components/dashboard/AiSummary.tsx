"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiMarketSummary } from "@terramap/types";

/**
 * AI market-analyst card for a Google Maps scrape run. Auto-generates on open:
 * it checks Supabase for a stored analysis first (cheap GET) and, if none
 * exists, generates one immediately. The result is persisted to
 * `scrape_runs.ai_summary`, so the AI runs only once per run and every later
 * visit loads instantly from the database.
 */
export function AiSummary({ runId, placeCount }: { runId: string; placeCount: number }) {
  const [summary, setSummary] = useState<AiMarketSummary | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(true); // initial cache lookup
  const [loading, setLoading] = useState(false); // generating
  const [err, setErr] = useState("");

  // Guards setState after unmount (component remounts per run via key={runId}).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const generate = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch("/api/ai-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, force }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Gagal membuat analisa AI.");
        if (!mounted.current) return;
        setSummary(d.summary);
        setGeneratedAt(d.generatedAt ?? null);
      } catch (e) {
        if (mounted.current) setErr(e instanceof Error ? e.message : "Gagal membuat analisa AI.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [runId],
  );

  // Load the stored analysis; if there isn't one yet, generate it automatically.
  // All setState happens inside async callbacks (never synchronously in the
  // effect body), and reset-on-run-change is handled by key={runId}.
  useEffect(() => {
    let active = true;
    fetch(`/api/ai-summary?runId=${encodeURIComponent(runId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setChecking(false);
        if (d.summary) {
          setSummary(d.summary);
          setGeneratedAt(d.generatedAt ?? null);
        } else {
          void generate(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
        void generate(false);
      });
    return () => {
      active = false;
    };
  }, [runId, generate]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden>🤖</span> Analisa Pasar AI
        </h3>
        {summary && !loading && (
          <button
            onClick={() => generate(true)}
            className="text-sm text-gray-500 underline hover:text-brand"
          >
            ↻ Buat ulang
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        {checking ? (
          <LoadingState text="Memuat analisa…" />
        ) : loading ? (
          <LoadingState
            text={`Menganalisa ${placeCount} kompetitor…`}
            sub="Biasanya 5–15 detik."
          />
        ) : summary ? (
          <SummaryView summary={summary} generatedAt={generatedAt} />
        ) : (
          <ErrorState err={err} onRetry={() => generate(false)} />
        )}
      </div>
    </section>
  );
}

function LoadingState({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
      <p className="text-sm font-medium text-gray-700">{text}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ErrorState({ err, onRetry }: { err: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="max-w-md text-sm text-red-600">{err || "Analisa belum tersedia."}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
      >
        ↻ Coba lagi
      </button>
    </div>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function SummaryView({
  summary,
  generatedAt,
}: {
  summary: AiMarketSummary;
  generatedAt: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Executive summary */}
      <section>
        <SectionLabel icon="📊" title="Ringkasan" />
        <p className="text-sm leading-relaxed text-gray-700">{summary.summary}</p>
      </section>

      {/* Opportunity score */}
      <ScoreBlock score={summary.opportunityScore.score} reason={summary.opportunityScore.reason} />

      {/* SWOT */}
      <section>
        <SectionLabel icon="💡" title="Analisa SWOT" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SwotCard
            title="Kekuatan"
            items={summary.swot.strengths}
            wrap="border-green-200 bg-green-50"
            head="text-green-800"
            dot="bg-green-500"
          />
          <SwotCard
            title="Kelemahan"
            items={summary.swot.weaknesses}
            wrap="border-red-200 bg-red-50"
            head="text-red-800"
            dot="bg-red-500"
          />
          <SwotCard
            title="Peluang"
            items={summary.swot.opportunities}
            wrap="border-blue-200 bg-blue-50"
            head="text-blue-800"
            dot="bg-blue-500"
          />
          <SwotCard
            title="Ancaman"
            items={summary.swot.threats}
            wrap="border-amber-200 bg-amber-50"
            head="text-amber-800"
            dot="bg-amber-500"
          />
        </div>
      </section>

      {/* Market analysis */}
      <section>
        <SectionLabel icon="📈" title="Analisa Pasar" />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="Kepadatan Pasar" value={summary.marketAnalysis.marketDensity} />
          <InfoCard label="Tingkat Kompetisi" value={summary.marketAnalysis.competitionLevel} />
          <InfoCard label="Pemain Dominan" value={summary.marketAnalysis.dominantPlayers} />
          <InfoCard label="Posisi Harga" value={summary.marketAnalysis.pricePositioningInsight} />
        </div>
      </section>

      {/* Recommendation */}
      <section>
        <SectionLabel icon="🎯" title="Rekomendasi Strategi" />
        <div className="space-y-3">
          <InfoCard label="Potensi Bisnis" value={summary.recommendation.businessPotential} />
          <InfoCard
            label="Strategi Diferensiasi"
            value={summary.recommendation.differentiationStrategy}
          />
          <InfoCard
            label="Saran Operasional"
            value={summary.recommendation.operationalSuggestion}
          />
        </div>
      </section>

      {generatedAt && (
        <p className="border-t border-gray-100 pt-3 text-xs text-gray-400">
          Dibuat {fmtTime(generatedAt)}
        </p>
      )}
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
      <span aria-hidden>{icon}</span>
      {title}
    </h4>
  );
}

interface ScoreStyle {
  label: string;
  text: string;
  bar: string;
  tint: string;
}

function scoreStyle(score: number): ScoreStyle {
  if (score <= 20)
    return { label: "Sangat Sulit Masuk Pasar", text: "text-red-600", bar: "bg-red-500", tint: "bg-red-50 border-red-200" };
  if (score <= 40)
    return { label: "Sulit", text: "text-orange-600", bar: "bg-orange-500", tint: "bg-orange-50 border-orange-200" };
  if (score <= 60)
    return { label: "Sedang", text: "text-amber-600", bar: "bg-amber-500", tint: "bg-amber-50 border-amber-200" };
  if (score <= 80)
    return { label: "Menarik", text: "text-lime-700", bar: "bg-lime-500", tint: "bg-lime-50 border-lime-200" };
  return { label: "Sangat Menarik", text: "text-emerald-700", bar: "bg-emerald-500", tint: "bg-emerald-50 border-emerald-200" };
}

function ScoreBlock({ score, reason }: { score: number; reason: string }) {
  const s = scoreStyle(score);
  return (
    <section className={`rounded-md border p-4 ${s.tint}`}>
      <div className="flex items-center gap-4">
        <div className="shrink-0 text-center">
          <div className={`text-3xl font-bold leading-none ${s.text}`}>{score}</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">/ 100</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Skor Peluang
            </span>
            <span className={`text-sm font-semibold ${s.text}`}>{s.label}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/70">
            <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>
      {reason && <p className="mt-3 text-sm leading-relaxed text-gray-700">{reason}</p>}
    </section>
  );
}

function SwotCard({
  title,
  items,
  wrap,
  head,
  dot,
}: {
  title: string;
  items: string[];
  wrap: string;
  head: string;
  dot: string;
}) {
  return (
    <div className={`rounded-md border p-3 ${wrap}`}>
      <h5 className={`mb-2 text-xs font-bold uppercase tracking-wide ${head}`}>{title}</h5>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <p className="text-sm leading-relaxed text-gray-700">{value || "—"}</p>
    </div>
  );
}
