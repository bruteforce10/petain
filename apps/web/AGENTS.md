# apps/web — Agent Notes

## Design Context

Baca dua file ini sebelum mengerjakan UI apa pun di app ini:

- [PRODUCT.md](./PRODUCT.md) — strategi: register `brand` (landing-first), platform `web`, pengguna utama pemilik UMKM, positioning "data, bukan feeling", belief ladder legitimasi-dulu, kepribadian profesional–presisi–analitis, anti-referensi (SaaS generik / scraper murahan / korporat kaku).
- [DESIGN.md](./DESIGN.md) — sistem visual: North Star "Peta Presisi", palet Peta Lapangan (Hijau Rimba `#00372E` di atas Ivory Peta `#FAFAF0`, aksen Mint Sorot `#91FFB4`), Inter tunggal dengan kontras bobot 400↔800, elevation struktural (border dulu, bukan bayangan).

Pendukung: `.impeccable/live/config.json` (konfigurasi live mode) dan `.impeccable/design.json` (sidecar token untuk panel live). Perintah `$impeccable` membaca semuanya otomatis dari cwd `apps/web`.
