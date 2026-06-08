"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScrapeRunSummary } from "@terramap/types";
import { fetchScrapeRuns } from "@terramap/supabase";
import { EmptyState } from "@terramap/ui";
import { ScrapeRunList } from "@/components/dashboard/ScrapeRunList";
import { ScrapeRunDetail } from "@/components/dashboard/ScrapeRunDetail";
import { supabase } from "@/lib/supabase/client";

export function DashboardClient({ email }: { email: string }) {
  const router = useRouter();
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

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const selected = runs?.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 bg-gray-50">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scrape history</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
        <button className="text-sm text-gray-500 underline" onClick={logout}>
          logout
        </button>
      </header>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

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
        <p className="text-gray-500">Loading…</p>
      ) : runs && runs.length === 0 ? (
        <EmptyState
          title="No scrape runs yet"
          hint="Use the extension to scrape Google Maps, Shopee, or Tokopedia."
        />
      ) : runs ? (
        <ScrapeRunList
          runs={runs}
          onOpen={(r) => setSelectedId(r.id)}
          onChanged={loadRuns}
        />
      ) : null}
    </main>
  );
}
