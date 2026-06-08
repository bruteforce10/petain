import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiMarketSummary } from "@terramap/types";
import { fetchPlacesByRun } from "@terramap/supabase";
import { createClient } from "@/lib/supabase/server";
import { AiConfigError, generateMarketSummary } from "@/lib/ai/marketSummary";

/**
 * AI market analysis for a scrape run.
 *   GET  ?runId=…            -> cached summary (or { summary: null })
 *   POST { runId, force? }   -> generate (returns cache unless force=true)
 *
 * Auth + RLS: the cookie client only sees the caller's own runs/places, so a
 * user can never analyse someone else's data.
 */

interface CachedSummary {
  summary: AiMarketSummary | null;
  generatedAt: string | null;
}

/**
 * Read the cached summary. Resilient to the `ai_summary` columns not existing
 * yet (migration not applied) — treats that as "no cache" instead of 500ing.
 */
async function readCache(supabase: SupabaseClient, runId: string): Promise<CachedSummary> {
  const { data, error } = await supabase
    .from("scrape_runs")
    .select("ai_summary, ai_summary_generated_at")
    .eq("id", runId)
    .single();
  if (error || !data) return { summary: null, generatedAt: null };
  return {
    summary: (data.ai_summary as AiMarketSummary | null) ?? null,
    generatedAt: (data.ai_summary_generated_at as string | null) ?? null,
  };
}

/** Persist the summary (best-effort: a missing column or RLS hiccup is non-fatal). */
async function writeCache(
  supabase: SupabaseClient,
  runId: string,
  summary: AiMarketSummary,
  generatedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from("scrape_runs")
    .update({ ai_summary: summary, ai_summary_generated_at: generatedAt })
    .eq("id", runId);
  if (error) {
    console.warn("[ai-summary] cache write skipped:", error.message);
  }
}

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId wajib diisi" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  const cached = await readCache(supabase, runId);
  return NextResponse.json(cached);
}

export async function POST(req: Request) {
  let body: { runId?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }
  const runId = body.runId;
  if (!runId) return NextResponse.json({ error: "runId wajib diisi" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .select("id, keyword, source")
    .eq("id", runId)
    .single();
  if (runErr || !run) return NextResponse.json({ error: "Run tidak ditemukan" }, { status: 404 });
  if (run.source !== "gmaps") {
    return NextResponse.json(
      { error: "Analisa AI hanya tersedia untuk hasil Google Maps." },
      { status: 400 },
    );
  }

  if (!body.force) {
    const cached = await readCache(supabase, runId);
    if (cached.summary) return NextResponse.json({ ...cached, cached: true });
  }

  const rows = await fetchPlacesByRun(supabase, runId);
  if (!rows.length) {
    return NextResponse.json(
      { error: "Belum ada data tempat pada run ini untuk dianalisa." },
      { status: 400 },
    );
  }

  try {
    const summary = await generateMarketSummary(run.keyword as string, rows);
    const generatedAt = new Date().toISOString();
    await writeCache(supabase, runId, summary, generatedAt);
    return NextResponse.json({ summary, generatedAt, cached: false });
  } catch (e) {
    if (e instanceof AiConfigError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : "Gagal membuat analisa AI";
    console.error("[ai-summary] generation failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
