# Agent AI Chat — Design

Tanggal: 2026-07-11 · Status: disetujui untuk implementasi (permintaan langsung user)

## Tujuan

Menu baru "Agent AI" di area login web Petain: chat tanya-jawab sederhana dengan
LLM (Gemini), mendukung lampiran gambar dan file teks. Versi pertama sengaja
minimal: tanpa penyimpanan riwayat di database, tanpa streaming.

## Keputusan produk

- **Nama menu**: "Agent AI" (ikon `Bot`), route `/agent-ai`, di nav
  `DashboardShell` setelah Kalkulator HPP.
- **Bahasa UI**: Indonesia, konsisten dengan halaman lain.
- **Riwayat**: hanya di state client (hilang saat refresh). Cukup untuk v1.
- **Streaming**: tidak — respons penuh dengan indikator loading, mengikuti pola
  `/api/hpp-ai` yang sudah ada.

## Lampiran file

Diizinkan (validasi di client dan server, single source di
`lib/ai/chatAttachments.ts`):

- Gambar: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- Teks: `text/plain` (.txt), `text/markdown` (.md), `text/csv` (.csv),
  `application/json` (.json)
- Dokumen: `application/pdf` (didukung native oleh Gemini)

Ditolak: ppt/pptx, doc/docx, xls/xlsx, dan tipe lain di luar daftar.
Browser sering memberi `file.type` kosong untuk .md/.csv — fallback ke pemetaan
ekstensi. Batas: 3 lampiran per pesan, ±4 MB per file (6.000.000 karakter
base64, sama dengan batas `/api/hpp-ai`).

## Arsitektur

```
app/agent-ai/page.tsx            server component: auth Supabase + DashboardShell
app/agent-ai/AgentAiClient.tsx   state chat, kirim request, error handling
components/agent/ChatMessageBubble.tsx  bubble user/model + preview lampiran
components/agent/ChatComposer.tsx       textarea + tombol lampir + kirim
app/api/agent-ai/route.ts        POST: validasi, auth, panggil Gemini
lib/ai/chatAttachments.ts        aturan lampiran (client-safe, diuji unit)
lib/ai/agentChat.ts              system prompt + mapping pesan → contents Gemini
lib/ai/gemini.ts                 + callGeminiChat (teks polos, multi-turn)
proxy.ts                         + /agent-ai ke daftar route terproteksi
```

## Kontrak API

`POST /api/agent-ai`

```json
{
  "messages": [
    {
      "role": "user" | "model",
      "text": "string",
      "attachments": [{ "name": "a.png", "mimeType": "image/png", "data": "<base64>" }]
    }
  ]
}
```

Respons sukses: `{ "reply": "string" }`. Error: `{ "error": "pesan Indonesia" }`
dengan status 400 (validasi), 401 (belum login), 500 (`AiConfigError`),
502 (kegagalan Gemini) — pola sama dengan `/api/hpp-ai`.

Batas server: ≤ 30 pesan, teks ≤ 8.000 karakter/pesan, pesan terakhir harus
`role: "user"`. Client mengirim ulang seluruh riwayat setiap request (dipangkas
ke 20 pesan terakhir).

## Mapping ke Gemini

- Gambar & PDF → `inlineData` (base64 + mimeType).
- File teks → di-decode server-side menjadi text part berformat
  `File: <nama>\n---\n<isi>` agar tidak bergantung dukungan mime `inlineData`.
- System prompt: asisten Petain berbahasa Indonesia untuk analisa pasar/UMKM,
  jawaban ringkas.
- `callGeminiChat` baru: tanpa `responseSchema`/`responseMimeType` (teks polos),
  berbagi endpoint, env, dan penanganan error dengan `callGeminiJson`.

## UI/UX

Mengikuti gaya dashboard: `Card` dengan `border-border/70`, aksen
`primary`/brand hijau, teks muted. Satu kartu chat tinggi penuh
(`max-w-3xl` di tengah): area pesan scrollable (bubble user = primary,
bubble AI = muted, avatar ikon), empty state dengan chip saran pertanyaan,
composer di bawah (textarea auto-grow, Enter kirim / Shift+Enter baris baru,
tombol paperclip, chip lampiran bisa dihapus, preview thumbnail gambar),
indikator loading titik beranimasi, banner error merah dapat ditutup.

## Testing

- Unit (bun test): aturan `chatAttachments` (mime, ekstensi fallback, ukuran,
  jumlah) dan mapping `buildGeminiContents` di `agentChat`.
- Verifikasi akhir: `npm run check` (lint + typecheck + test + build) di
  `apps/web`.

## Di luar scope v1

Persistensi riwayat (Supabase), streaming token, markdown rendering penuh,
multi-sesi/percakapan tersimpan, PPT/Office parsing.
