"use client";

import { useMemo, useState } from "react";
import type { ScrapeRunSummary, ScrapeSource } from "@terramap/types";
import { renameScrapeRun, deleteScrapeRun, deleteScrapeRuns } from "@terramap/supabase";
import { supabase } from "@/lib/supabase/client";

const SOURCE_LABELS: Record<ScrapeSource, string> = {
  gmaps: "Google Maps",
  shopee: "Shopee",
  tokopedia: "Tokopedia",
};

const STATUS_STYLES: Record<ScrapeRunSummary["status"], string> = {
  running: "bg-amber-100 text-amber-700",
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

type SortKey = "title" | "source" | "created_at" | "status" | "row_count";
type SortDir = "asc" | "desc";

export interface ScrapeRunListProps {
  runs: ScrapeRunSummary[];
  onOpen: (run: ScrapeRunSummary) => void;
  /** Refresh the list after a rename/delete. */
  onChanged: () => void;
}

export function ScrapeRunList({ runs, onOpen, onChanged }: ScrapeRunListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...runs].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title, "id");
          break;
        case "source":
          cmp = SOURCE_LABELS[a.source].localeCompare(SOURCE_LABELS[b.source]);
          break;
        case "created_at":
          cmp = a.created_at.localeCompare(b.created_at); // ISO 8601 sorts lexically
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "row_count":
          cmp = a.row_count - b.row_count;
          break;
      }
      return cmp * dir;
    });
  }, [runs, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numbers and dates feel more useful highest-first by default.
      setSortDir(key === "created_at" || key === "row_count" ? "desc" : "asc");
    }
  }

  const selectedIds = sorted.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = sorted.length > 0 && selectedIds.length === sorted.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map((r) => r.id)));
  }

  function startEdit(r: ScrapeRunSummary) {
    setErr("");
    setEditingId(r.id);
    setEditTitle(r.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
  }

  async function saveEdit(r: ScrapeRunSummary) {
    const next = editTitle.trim();
    if (!next || next === r.title) {
      cancelEdit();
      return;
    }
    setBusy(true);
    try {
      await renameScrapeRun(supabase, r.id, next);
      onChanged();
      cancelEdit();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengganti nama.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(r: ScrapeRunSummary) {
    if (!window.confirm(`Hapus "${r.title}" beserta semua datanya? Tidak bisa dibatalkan.`)) return;
    setBusy(true);
    setErr("");
    try {
      await deleteScrapeRun(supabase, r.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selectedIds.length) return;
    if (
      !window.confirm(
        `Hapus ${selectedIds.length} folder beserta semua datanya? Tidak bisa dibatalkan.`,
      )
    )
      return;
    setBusy(true);
    setErr("");
    try {
      await deleteScrapeRuns(supabase, selectedIds);
      setSelected(new Set());
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  function sortTh(label: string, key: SortKey, right = false) {
    const active = sortKey === key;
    return (
      <th className={`px-3 py-2 font-medium ${right ? "text-right" : ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""} ${
            active ? "text-gray-900" : "hover:text-gray-900"
          }`}
        >
          {label}
          <span className="text-[10px] text-gray-400">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm">
          <span className="font-medium text-gray-700">{selectedIds.length} dipilih</span>
          <button
            onClick={deleteSelected}
            disabled={busy}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Hapus terpilih
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={busy}
            className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
          >
            Batal pilih
          </button>
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Pilih semua"
                  className="h-4 w-4 cursor-pointer accent-brand"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              {sortTh("Title", "title")}
              {sortTh("Source", "source")}
              {sortTh("Created", "created_at")}
              {sortTh("Status", "status")}
              {sortTh("Rows", "row_count", true)}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r) => {
              const isSelected = selected.has(r.id);
              const isEditing = editingId === r.id;
              return (
                <tr
                  key={r.id}
                  className={`${isSelected ? "bg-brand/5" : "hover:bg-gray-50"} ${
                    isEditing ? "" : "cursor-pointer"
                  }`}
                  onClick={() => {
                    if (!isEditing) onOpen(r);
                  }}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${r.title}`}
                      className="h-4 w-4 cursor-pointer accent-brand"
                      checked={isSelected}
                      onChange={() => toggleOne(r.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="w-full min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(r);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          disabled={busy}
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(r)}
                          disabled={busy}
                          className="rounded bg-brand px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={busy}
                          className="text-xs text-gray-500 underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="line-clamp-2 max-w-md font-medium text-brand">{r.title}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{SOURCE_LABELS[r.source]}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    {fmtDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.row_count}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {!isEditing && (
                      <span className="inline-flex gap-3">
                        <button
                          onClick={() => startEdit(r)}
                          disabled={busy}
                          className="text-xs text-gray-500 underline hover:text-brand disabled:opacity-50"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => deleteOne(r)}
                          disabled={busy}
                          className="text-xs text-red-600 underline hover:text-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
