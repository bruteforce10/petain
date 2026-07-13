---
name: Petain
description: Tool riset bisnis lokal — data pasar per kecamatan, langsung dari Google Maps
colors:
  hijau-rimba: "#00372E"
  teal-kedalaman: "#055748"
  hijau-sinyal: "#01C07A"
  mint-sorot: "#91FFB4"
  kuning-penanda: "#FFD53E"
  ivory-peta: "#FAFAF0"
  abu-lapangan: "#EEEEE4"
  krem-dasar: "#FBFAF3"
  pasir-hangat: "#FAECDC"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 3.8vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.14em"
rounded:
  media: "14px"
  tile: "15px"
  card: "24px"
  card-lg: "28px"
  pill: "9999px"
spacing:
  stack-gap: "12px"
  card-pad: "24px"
  card-pad-lg: "32px"
  section-y: "64px"
  section-y-lg: "96px"
components:
  button-primary:
    backgroundColor: "{colors.hijau-rimba}"
    textColor: "{colors.ivory-peta}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-buy:
    backgroundColor: "{colors.mint-sorot}"
    textColor: "{colors.hijau-rimba}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.hijau-rimba}"
    rounded: "{rounded.pill}"
    padding: "14px 20px"
  chip-check:
    backgroundColor: "{colors.mint-sorot}"
    textColor: "{colors.hijau-rimba}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  badge-value:
    backgroundColor: "{colors.kuning-penanda}"
    textColor: "{colors.hijau-rimba}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  card-surface:
    backgroundColor: "{colors.ivory-peta}"
    textColor: "{colors.hijau-rimba}"
    rounded: "{rounded.card}"
    padding: "24px"
  card-invert:
    backgroundColor: "{colors.hijau-rimba}"
    textColor: "{colors.ivory-peta}"
    rounded: "{rounded.card-lg}"
    padding: "32px"
---

# Design System: Petain

## 1. Overview

**Creative North Star: "Peta Presisi"**

Sistem visual Petain meminjam jiwa dari fitur andalannya: polygon kecamatan. Batas selalu tegas, data selalu menempel ke lokasi, tidak ada yang samar. Setiap halaman diperlakukan seperti peta yang digambar analis: hijau rimba sebagai tinta utama di atas kertas ivory, garis-garis tipis sebagai batas wilayah, dan sorotan mint hanya pada titik yang memang perlu ditunjuk. Kepribadiannya profesional, presisi, analitis — pengunjung harus merasa *yakin & aman* sebelum mengeluarkan Rp45.000.

Sistem ini secara eksplisit menolak tiga hal dari PRODUCT.md: **SaaS startup generik** (gradient ungu-biru, jargon Inggris, hero metrics kosong), **tool scraper murahan** (vibe "cepat kaya", spammy), dan **korporat kaku** (formal dingin ala bank). Kredibilitas dibangun lewat kerapian dan bukti produk asli, bukan lewat hype maupun formalitas.

**Key Characteristics:**
- Satu keluarga hijau (Rimba → Sinyal → Mint) di atas netral hangat keluarga ivory — tidak ada warna di luar peta ini.
- Tipografi satu keluarga (Inter) dengan kontras bobot ekstrem: 400 untuk isi, 700–800 untuk klaim.
- Kepadatan tenang: satu gagasan dominan per fold, angka spesifik selalu terlihat (6.695 kecamatan, Rp45.000).
- Batas (border 1px) adalah alat struktur utama; bayangan adalah pengecualian yang harus beralasan.
- Bukti produk asli (screenshot dashboard, laporan) adalah imagery utama — bukan ilustrasi abstrak.

## 2. Colors: Palet Peta Lapangan

Palet peta seorang surveyor: tinta hijau pekat di atas kertas lapangan hangat, dengan mint sebagai penunjuk temuan.

### Primary
- **Hijau Rimba** (#00372E): Tinta utama sekaligus permukaan komitmen. Semua heading, teks penting, tombol primer, dan section "berat" (cara kerja, kartu harga, CTA penutup) memakai warna ini. Di atas Ivory Peta kontrasnya ≈13:1 — inilah suara brand.

### Secondary
- **Hijau Sinyal** (#01C07A): Penanda tekstual — highlight span di headline, ceklis, kicker. Hanya untuk teks/ikon kecil di atas terang; jangan sebagai teks isi panjang.
- **Mint Sorot** (#91FFB4): Penunjuk aksi & bukti — tombol beli, chip ceklis, glow tipis di belakang artefak produk. Selalu berpasangan dengan teks Hijau Rimba (kontras ≈11:1). Porsinya kecil; kelangkaannya yang membuatnya menunjuk.

### Tertiary
- **Kuning Penanda** (#FFD53E): Label mikro bermuatan nilai — badge "HEMAT 70%", "BEST VALUE", bintang testimoni. Tidak pernah lebih besar dari sebuah badge.

### Neutral
- **Ivory Peta** (#FAFAF0): Kertas utama — background body, kartu, teks di atas Hijau Rimba. Bukan putih murni; hangatnya bagian dari identitas.
- **Krem Dasar** (#FBFAF3): Latar section bernapas (solusi, perbandingan, harga).
- **Abu Lapangan** (#EEEEE4): Permukaan redup — section fitur, track toggle, `--muted` di dashboard.
- **Pasir Hangat** (#FAECDC): Momen emosional tunggal (section masalah); satu-satunya penyimpangan hangat yang diizinkan, maksimal satu section per halaman.
- **Teal Kedalaman** (#055748): Tinta isi — body text di semua permukaan terang (≈8:1 di atas Ivory Peta). Juga `--muted-foreground` dan `--accent` di dashboard.

### Named Rules
**The Satu Hijau Rule.** Hanya keluarga Rimba–Sinyal–Mint yang boleh tampil di permukaan web. `--color-brand: #16a34a` (warisan labs di `globals.css`) dikarantina — jangan dipakai di permukaan baru; migrasikan pemakaian lama ke Hijau Rimba/Sinyal saat tersentuh.
**The Mint Menunjuk Rule.** Mint Sorot hanya pada momen aksi (beli) dan bukti (ceklis, temuan). Kalau mint mulai jadi dekorasi latar, ia berhenti menunjuk.
**The Kertas Ivory Rule.** Background halaman selalu keluarga ivory (#FAFAF0/#FBFAF3), bukan abu-abu netral dingin. `bg-gray-50` (#F9FAFB) di landing saat ini adalah drift — ganti ke Ivory Peta saat tersentuh.

## 3. Typography

**Display & Body Font:** Inter (fallback: ui-sans-serif, system-ui) — satu keluarga untuk semuanya, dimuat via `next/font` sebagai `--font-inter`.
**Mono Font:** SFMono-Regular / Consolas (hanya untuk data teknis bila perlu).

**Character:** Netral-presisi ala dokumen analis; kepribadian datang dari kontras bobot yang berani (400 ↔ 800), ukuran yang terukur, dan tracking rapat yang konsisten — bukan dari font display dekoratif. Inter adalah komitmen identitas yang dipertahankan.

### Hierarchy
- **Display** (700, clamp(2rem, 5vw, 3.5rem), lh 1.1, tracking -0.03em): Headline hero & section besar. Highlight satu frasa dengan Hijau Sinyal, sisanya Hijau Rimba.
- **Headline** (800, clamp(1.9rem, 3.8vw, 2.8rem), lh 1.12, tracking -0.03em): Judul section fitur/harga.
- **Title** (800, 26px, lh 1.15, tracking -0.025em): Judul kartu fitur & langkah.
- **Body** (400, 16px, lh 1.625): Teks isi — warna Teal Kedalaman di permukaan terang, maksimal 65–75ch.
- **Label** (700, 13px, tracking 0.14em, UPPERCASE): Kicker & label mikro. Lihat The Satu Kicker Rule.

### Named Rules
**The Angka Presisi Rule.** Angka selalu spesifik dan menonjol: "6.695 kecamatan", "Rp45.000", "1–2 menit". Angka bulat kosong ("ribuan pengguna") dilarang — presisi adalah kepribadian.
**The Satu Kicker Rule.** Label uppercase ber-tracking maksimal SATU per halaman sebagai kicker yang disengaja. Eyebrow di atas setiap section adalah scaffolding AI — pola "FITUR 01/02/03" di setiap kartu dihapus saat tersentuh; penomoran hanya sah untuk urutan nyata (4 langkah Cara Kerja).
**The Tracking Floor Rule.** Letter-spacing display tidak pernah lebih rapat dari -0.04em; standar sistem -0.03em.

## 4. Elevation

Doktrin sistem ini **struktural, bukan atmosferik**: pemisahan dibangun dengan border 1px `rgba(0,55,46,0.08–0.2)` dan pergantian lapisan warna (Ivory → Krem → Abu → Hijau Rimba), bukan dengan bayangan. Bayangan adalah pengecualian yang harus beralasan: satu bayangan ketat diizinkan di bawah artefak produk nyata (screenshot, kartu harga) sebagai "kaca di atas peta" — bukan dekorasi kartu teks. Glow lebar-lembut yang masih ada di landing (mis. `0 30px 60px -34px`) adalah warisan yang ditertibkan setiap kali section disentuh.

### Shadow Vocabulary
- **Artifact float** (`box-shadow: 0 24px 50px -28px rgba(0,55,46,0.35)`): Satu-satunya bayangan besar yang sah — khusus screenshot produk & kartu harga. Maksimal satu jenis per section.
- **Press feedback** (`box-shadow: 0 4px 12px -4px rgba(0,55,46,0.3)`): Respons state kecil (toggle aktif, tombol hover). Blur ≤12px.

### Named Rules
**The Garis Dulu Rule.** Sebelum menambah bayangan, tanya: bisakah border 1px atau pergantian warna permukaan melakukan tugas yang sama? Hampir selalu bisa.
**The No Ghost-Card Rule.** Border 1px + bayangan lebar pada elemen yang sama dilarang. Pilih satu.

## 5. Components

Rasa komponen: **kokoh & meyakinkan** — pill solid yang mantap, respons hover kecil sebagai konfirmasi, bukan atraksi.

### Buttons
- **Shape:** Pill penuh (9999px), padding 14px 28px, teks 14–15px semibold/bold.
- **Primary:** Hijau Rimba solid + teks Ivory Peta. Hover: naik halus (-2px) + opacity 90%.
- **Buy (CTA transaksi):** Mint Sorot + teks Hijau Rimba extrabold — hanya untuk aksi membeli, satu per viewport.
- **Ghost:** Border 1px rgba(0,55,46,0.2), teks Hijau Rimba; hover bg rgba(0,55,46,0.05).
- **Focus:** `focus-visible` ring 2px Hijau Sinyal offset 2px — wajib di semua varian (saat ini belum ada; tambahkan saat tersentuh).

### Chips
- **Chip ceklis:** Mint Sorot pill, teks Hijau Rimba bold 15px, ikon ✓ extrabold — menandai bukti/keuntungan.
- **Badge nilai:** Kuning Penanda pill, teks Hijau Rimba extrabold 10–12px uppercase — "HEMAT 70%", "BEST VALUE".

### Cards / Containers
- **Corner Style:** 24px standar (radius shadcn `--radius: 1.5rem`), 28px untuk kartu hero (harga); langit-langit 28px — jangan lebih bulat.
- **Background:** Putih/Ivory di atas section berwarna; Hijau Rimba untuk kartu komitmen (harga).
- **Border:** 1px rgba(0,55,46,0.08) sebagai struktur default (lihat Elevation).
- **Internal Padding:** 24px, 32px untuk kartu besar.

### Inputs / Fields
- **Style:** Bg Ivory Peta, border 1px rgba(0,55,46,0.12), radius 14–20px (skala shadcn), teks Hijau Rimba.
- **Focus:** Border menguat ke Hijau Sinyal + ring 2px; placeholder Teal Kedalaman (bukan abu pudar).
- **AI input box:** varian khusus dengan padding 24px 28px, radius 20px.

### Navigation
- **Landing:** Sticky top, backdrop-blur, border-bottom 1px rgba(0,55,46,0.08); link 14px Hijau Rimba (hover opacity 70%); CTA pill Hijau Rimba di kanan.
- **Dashboard:** Header putih h-56px; item nav pill — aktif = bg `--primary` (Hijau Rimba) teks ivory, idle = Teal Kedalaman hover bg Abu Lapangan; ikon Lucide 16px.

### Bingkai Browser (signature)
Screenshot produk dibingkai kartu ber-radius 26px dengan tiga titik jendela dan padding 22px — bukti produk asli ditampilkan seperti perangkat sungguhan. Latar bingkai memakai tint keluarga palet (mint muda / pasir), bayangan mengikuti aturan Artifact float.

### Tabel Perbandingan (signature)
Grid "Manual vs Petain": kolom Petain diberi tint mint sangat muda (#ECFDF3/#F6FEF9) + teks hijau tua; kolom manual teks abu (#9CA3AF). Border antar baris 1px rgba(0,55,46,0.08). Ini pola argumen visual khas Petain — data yang berbicara.

## 6. Do's and Don'ts

### Do:
- **Do** pakai Hijau Rimba (#00372E) sebagai tinta & permukaan komitmen — halaman harus terasa "ditandatangani" warna ini.
- **Do** tulis body text dengan Teal Kedalaman solid (#055748, ≈8:1) di permukaan terang; di atas Hijau Rimba pakai Ivory Peta minimal alpha 70% untuk ukuran body (di bawah itu gagal AA — label langkah /50 saat ini gagal, perbaiki saat tersentuh).
- **Do** tampilkan bukti produk asli (screenshot dashboard, laporan HTML) dalam Bingkai Browser — imagery utama sistem ini.
- **Do** pertahankan angka spesifik di headline & badge (6.695, Rp45.000) — The Angka Presisi Rule.
- **Do** struktur dengan border 1px & lapisan warna dulu; bayangan hanya untuk artefak produk (The Garis Dulu Rule).
- **Do** hormati `prefers-reduced-motion`: marquee, cycling badge, dan progress line berhenti; ganti dengan crossfade/statis.

### Don't:
- **Don't** tampil seperti "SaaS startup generik": gradient ungu-biru, jargon Inggris, hero metrics kosong, template landing yang semua orang pakai (anti-referensi PRODUCT.md, verbatim).
- **Don't** tampil seperti "tool scraper murahan": vibe cepat-kaya, stiker diskon menumpuk, countdown palsu, klaim tanpa bukti — bahaya terbesar brand ini.
- **Don't** tampil seperti "korporat kaku": formal dingin ala bank/asuransi; bahasa tetap membumi ("kamu").
- **Don't** pakai `--color-brand` #16a34a di permukaan web baru — The Satu Hijau Rule.
- **Don't** pakai `bg-gray-50` atau abu netral dingin sebagai latar halaman — keluarga ivory adalah kertasnya.
- **Don't** taruh eyebrow uppercase di atas setiap section, atau penomoran "FITUR 01" sebagai scaffolding — maksimal satu kicker disengaja per halaman (The Satu Kicker Rule).
- **Don't** tambah emoji baru sebagai ikon fitur/CTA (🔍🎯🚀). Migrasikan ke ikon garis Lucide (sudah ada di dependencies) agar sejalan dengan "profesional, presisi, analitis".
- **Don't** pasangkan border 1px + bayangan lebar di elemen yang sama (ghost-card), dan jangan pernah gradient text (`background-clip: text`).
- **Don't** melebihi radius 28px pada kartu/section, dan jangan gunakan z-index arbitrer (pakai skala: dropdown → sticky → modal → toast → tooltip).
