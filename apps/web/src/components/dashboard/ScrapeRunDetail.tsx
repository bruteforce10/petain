"use client";

import { useEffect, useState } from "react";
import type { PlaceRow, ProductRow, ScrapeRunSummary } from "@terramap/types";
import {
  fetchPlacesByRun,
  fetchProductsByRun,
  renameScrapeRun,
  deleteScrapeRun,
} from "@terramap/supabase";
import { ProductTable, EmptyState } from "@terramap/ui";
import { PlaceTable } from "./PlaceTable";
import { AreaAnalysis } from "./AreaAnalysis";
import { AiSummary } from "./AiSummary";
import { supabase } from "@/lib/supabase/client";

export interface ScrapeRunDetailProps {
  run: ScrapeRunSummary;
  onBack: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

export function ScrapeRunDetail({ run, onBack, onChanged, onDeleted }: ScrapeRunDetailProps) {
  const [places, setPlaces] = useState<PlaceRow[] | null>(null);
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(run.title);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (run.source === "gmaps") {
      fetchPlacesByRun(supabase, run.id)
        .then((data) => {
          if (!active) return;
          setErr("");
          setPlaces(data);
        })
        .catch((e) => {
          if (active) setErr(e?.message ?? "Failed to load places");
        });
    } else {
      fetchProductsByRun(supabase, run.id)
        .then((data) => {
          if (!active) return;
          setErr("");
          setProducts(data);
        })
        .catch((e) => {
          if (active) setErr(e?.message ?? "Failed to load products");
        });
    }
    return () => {
      active = false;
    };
  }, [run.id, run.source]);

  async function saveRename() {
    const next = title.trim();
    if (!next || next === run.title) {
      setRenaming(false);
      setTitle(run.title);
      return;
    }
    setBusy(true);
    try {
      await renameScrapeRun(supabase, run.id, next);
      onChanged();
      setRenaming(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Rename failed");
      setTitle(run.title);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      `Delete folder "${run.title}" and all rows inside it? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteScrapeRun(supabase, run.id);
      onDeleted();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  const loading = run.source === "gmaps" ? places == null : products == null;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <button
          className="text-sm text-gray-500 underline disabled:opacity-50"
          onClick={onBack}
          disabled={busy}
        >
          ← Back
        </button>
        {renaming ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <button
              className="rounded bg-brand px-3 py-1 text-sm text-white disabled:bg-gray-400"
              onClick={saveRename}
              disabled={busy}
            >
              Save
            </button>
            <button
              className="text-sm text-gray-500 underline"
              onClick={() => {
                setRenaming(false);
                setTitle(run.title);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h2 className="flex-1 text-lg font-semibold">{run.title}</h2>
            <button
              className="text-sm text-gray-500 underline disabled:opacity-50"
              onClick={() => setRenaming(true)}
              disabled={busy}
            >
              Rename
            </button>
            <button
              className="text-sm text-red-600 underline disabled:opacity-50"
              onClick={handleDelete}
              disabled={busy}
            >
              Delete
            </button>
          </>
        )}
      </header>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {run.status === "failed" && (
        <EmptyState
          title="Scrape failed"
          hint={
            run.row_count > 0
              ? `Saved ${run.row_count} rows before failing.`
              : "No rows were saved."
          }
        />
      )}

      {loading && !err && <p className="text-gray-500">Loading…</p>}

      {!loading && run.source === "gmaps" && places &&
        (places.length === 0 ? (
          <EmptyState title="No places" hint="This run did not capture any results." />
        ) : (
          <div className="space-y-6">
            <AiSummary key={run.id} runId={run.id} placeCount={places.length} />
            <Section title="Area analysis" count={places.length}>
              <AreaAnalysis rows={places} />
            </Section>
            <Section title="Places" count={places.length}>
              <PlaceTable rows={places} title={run.title} />
            </Section>
          </div>
        ))}

      {!loading && run.source !== "gmaps" && products &&
        (products.length === 0 ? (
          <EmptyState title="No products" hint="This run did not capture any results." />
        ) : (
          <Section title="Products" count={products.length}>
            <ProductTable rows={products} />
          </Section>
        ))}
    </section>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {count}
        </span>
      </h3>
      {children}
    </section>
  );
}
