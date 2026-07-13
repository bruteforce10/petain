"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScrapeRunSummary } from "@terramap/types";
import { fetchScrapeRuns } from "@terramap/supabase";
import { EmptyState } from "@terramap/ui";
import { ScrapeRunList } from "@/components/dashboard/ScrapeRunList";
import { ScrapeRunDetail } from "@/components/dashboard/ScrapeRunDetail";
import { supabase } from "@/lib/supabase/client";

export function DashboardClient() {
  const [runs, setRuns] = useState<ScrapeRunSummary[] | null>(null);
  const [err, setErr] = useState("");
  // Deep link: the extension's "Lihat Tabel Data" button opens ?run=<id> to jump
  // straight into that scrape's detail/table. Read it once at init (SSR-safe:
  // the runs list is still null on first render, so the output is "Loading…"
  // either way and there's no hydration mismatch).
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("run"),
  );

  const loadRuns = useCallback(() => {
    fetchScrapeRuns(supabase)
      .then((data) => {
        setErr("");
        setRuns(data);
      })
      .catch((e) => setErr(e?.message ?? "Failed to load"));
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const selected = runs?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Riwayat Scraping</h1>
        <p className="text-sm text-muted-foreground">
          Data kompetitor hasil scraping dari extension Petain
        </p>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {selected ? (
        <ScrapeRunDetail
          run={selected}
          onBack={() => setSelectedId(null)}
          onChanged={loadRuns}
          onDeleted={() => {
            setSelectedId(null);
            loadRuns();
          }}
        />
      ) : runs == null && !err ? (
        <p className="text-muted-foreground">Memuat…</p>
      ) : runs && runs.length === 0 ? (
        <EmptyState
          title="Belum ada hasil scraping"
          hint="Gunakan extension untuk scrape Google Maps, Shopee, atau Tokopedia."
        />
      ) : runs ? (
        <ScrapeRunList
          runs={runs}
          onOpen={(r) => setSelectedId(r.id)}
          onChanged={loadRuns}
        />
      ) : null}
    </div>
  );
}
